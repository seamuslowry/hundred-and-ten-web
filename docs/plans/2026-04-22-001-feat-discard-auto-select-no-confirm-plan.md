---
title: "feat: Auto-select non-trump cards and remove discard confirmation"
type: feat
status: completed
date: 2026-04-22
---

# feat: Auto-select non-trump cards and remove discard confirmation

## Overview

Two UX improvements to the discard stage:
1. Remove the two-click confirmation flow — discard fires immediately on first button press.
2. When the discard stage begins, pre-select all non-trump cards so the player only needs to manually deselect any they want to keep.

Trump cards are never auto-selected. Trump rules for this feature: the trump suit from `started.trump`, the Ace of Hearts, and the Joker are always trump regardless of the elected suit.

## Problem Frame

The current discard UI requires two clicks (Discard → Confirm), which adds friction without meaningful protection since the action can't be undone anyway. Separately, in a typical hand most cards are not trump and the player wants to discard them — auto-selecting non-trump cards makes the common case zero-effort.

A future backend enhancement will expose per-card trump status and relative value, removing the need for client-side trump logic. That work is explicitly out of scope here.

## Requirements Trace

- R1. Clicking "Discard N cards" once submits the discard action — no confirmation step.
- R2. On entering the discard stage, all non-trump cards in the player's hand are pre-selected.
- R3. Trump determination: Joker (`suit === "JOKER"`), Ace of Hearts (`number === "ACE" && suit === "HEARTS"`), and any card whose suit matches `started.trump` are trump.
- R4. The player can still manually toggle individual cards before submitting.
- R5. `started.trump` must be passed from `GameBoard` into `DiscardControls`.

## Scope Boundaries

- No changes to `Hand` or `Card` rendering components beyond what prop changes require.
- No server-side changes; no change to the `DISCARD` action payload shape.
- No per-card "trump indicator" visual — that belongs with the future backend enhancement.
- No changes to any other phase (BIDDING, TRICKS, TRUMP_SELECTION).

## Context & Research

### Relevant Code and Patterns

- `components/game/discard-controls.tsx` — primary change target; contains `confirming` state and empty initial selection
- `components/game/game-board.tsx:146–154` — DISCARD phase block; wires `hand`, `disabled`, `onDiscard` to `DiscardControls`; `started.trump` already available on `started` at line 102 (passed to `GameStatusBar`)
- `components/game/hand.tsx` — `cardEquals` exported, used for selection equality; `selectedCards` is a controlled prop
- `lib/api/types.ts` — `Card` shape (`number: CardNumber`, `suit: Suit`); `SelectableSuit` is `"HEARTS"|"DIAMONDS"|"CLUBS"|"SPADES"` (no `"JOKER"` — Joker uses `Suit`)
- `components/game/bid-controls.tsx` — nearby pattern for a controls component with a single-action button and no confirmation

### Institutional Learnings

- **Phase-gated rendering**: The DISCARD block already gates on `phase === "DISCARD" && myTurn`, which is the established pattern. No change needed — `started.trump` is guaranteed to be set when the DISCARD block renders (see `docs/solutions/ui-bugs/game-ui-rendering-and-style-fixes-2026-04-19.md`).
- **Async handler safety**: `doAction` in `game-board.tsx` already wraps with `try/catch/finally` and resets `actionInFlight`. `DiscardControls.onDiscard` is a synchronous callback into `doAction` — no additional error handling needed in the controls component.
- **Role-specific rules**: No role-based variation in discard rules for this feature — the trump logic applies uniformly.

## Key Technical Decisions

- **`isTrump` utility location**: Inline in `discard-controls.tsx` as a module-level function rather than a shared `lib/utils` file. There is no existing `card-utils` module and no other consumer yet. When the backend exposes trump status, this function becomes dead code and is trivially deleted. Creating a shared utility for a single use site that is planned for removal is premature.
- **Auto-selection initialization**: Use `useState(() => cards.filter(c => !isTrump(c, trump)))` (lazy initializer) rather than `useEffect`. The lazy initializer runs once at mount, which is exactly when the discard stage begins. `useEffect` would add an extra render and conflicts with ESLint rules in this repo.
- **`trump` prop type**: `SelectableSuit | null` — matches `started.trump` from `StartedGame`. The `isTrump` function handles `null` safely (no trump-suit match, but Joker and Ace of Hearts are still trump).
- **No visual change to trump cards**: Auto-selection is purely a default state; no disabled/locked treatment for trump cards. Players can still manually select trump cards to discard if they choose — the backend enforces real rules.

## Open Questions

### Resolved During Planning

- **Should trump cards be locked/undiscardable in the UI?** No — the backend enforces authorization. UI checks are cosmetic. Players can select trump cards manually; the server rejects invalid discards. (see `docs/solutions/ui-bugs/dealer-bid-at-current-value-disabled-2026-04-21.md`)
- **Is `started.trump` always set during DISCARD phase?** Yes — the server sets trump before transitioning to DISCARD. The existing `GameStatusBar` displays trump during DISCARD confirming this.

### Deferred to Implementation

- **What happens if `cards` or `trump` change while the discard UI is mounted?** The lazy `useState` initializer only runs once. If the hand or trump changes mid-discard (unlikely given game flow), the selection would be stale. Defer — this edge case is not realistically reachable with current game logic.

## Implementation Units

- [ ] **Unit 1: Add `isTrump` utility and auto-selection to `DiscardControls`; remove confirmation**

**Goal:** Replace empty selection init with trump-aware pre-selection; collapse two-click flow to one click.

**Requirements:** R1, R2, R3, R4, R5

**Dependencies:** None

**Files:**
- Modify: `components/game/discard-controls.tsx`
- Modify: `components/game/game-board.tsx`
- Create: `components/game/__tests__/discard-controls.test.tsx`

**Approach:**
- Add `trump: SelectableSuit | null` to `DiscardControlsProps`
- Add module-level `isTrump(card: Card, trump: SelectableSuit | null): boolean` — returns true for Joker, Ace of Hearts, or card whose suit matches `trump`
- Change `useState<CardType[]>([])` to `useState<CardType[]>(() => cards.filter(c => !isTrump(c, trump)))` 
- Remove `confirming` state, `setConfirming` calls, and the `if (!confirming)` branch in `handleDiscard`
- Simplify `handleDiscard` to call `onDiscard(selected)` directly
- Remove the Cancel button and the conditional red/blue button color classes — button is always blue
- Simplify button label to always show `Discard N card(s)` (no "Confirm" prefix)
- In `game-board.tsx`, add `trump={started.trump}` to the `<DiscardControls>` JSX

**Patterns to follow:**
- `components/game/bid-controls.tsx` — single-action button, no confirmation
- `components/game/hand.tsx:cardEquals` — existing card equality helper

**Test scenarios:**
- Happy path: renders with a mixed hand (2 trump, 3 non-trump) — non-trump cards are pre-selected, trump cards are not
- Happy path: clicking "Discard N cards" once calls `onDiscard` with the currently selected cards (no second click needed)
- Happy path: toggling a card off and then clicking discard calls `onDiscard` with the updated selection
- Happy path: toggling a trump card on and clicking discard includes it in the `onDiscard` call
- Edge case — Joker is always trump: hand includes Joker with `trump = "HEARTS"` — Joker is not pre-selected
- Edge case — Ace of Hearts is always trump: hand includes Ace of Hearts with `trump = "CLUBS"` — Ace of Hearts is not pre-selected
- Edge case — trump suit card: hand includes Five of Hearts with `trump = "HEARTS"` — not pre-selected
- Edge case — trump null: `trump = null` — only Joker and Ace of Hearts are exempt from pre-selection; all other cards are pre-selected
- Edge case — all trump hand: all cards are trump — no cards pre-selected, discard button disabled (selected.length === 0)
- Edge case — all non-trump hand: all cards are non-trump — all cards pre-selected
- Error path: `disabled={true}` — discard button is disabled regardless of selection

**Verification:**
- `npm run build` passes without type errors
- All new tests pass under `npx vitest run`
- Manual: entering discard phase shows non-trump cards highlighted; one click submits

## System-Wide Impact

- **Interaction graph:** Only `game-board.tsx` → `DiscardControls` is affected. No other component passes to or depends on `DiscardControls`.
- **Error propagation:** Unchanged — `onDiscard` delegates to `doAction` in `game-board.tsx` which handles errors.
- **State lifecycle risks:** None — `confirming` state is removed entirely; no lingering state across renders.
- **API surface parity:** None — the `{ type: "DISCARD", cards }` payload shape is unchanged.
- **Unchanged invariants:** All other game phases (BIDDING, TRUMP_SELECTION, TRICKS) are untouched.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `isTrump` logic diverges from server rules | The backend rejects invalid discards — players see an error message. The client logic is cosmetic. Accept the risk; document the known limitation in a comment near `isTrump`. |
| Auto-selection is wrong in edge cases (e.g. double-deck, no trump elected yet) | Gated by `phase === "DISCARD"` which only fires when the game is at the right stage and trump is determined. Low risk. |

## Sources & References

- Related code: `components/game/discard-controls.tsx`, `components/game/game-board.tsx:146–154`
- Institutional: `docs/solutions/ui-bugs/game-ui-rendering-and-style-fixes-2026-04-19.md`, `docs/solutions/best-practices/react-async-handler-memoization-and-prop-consistency-2026-04-21.md`
