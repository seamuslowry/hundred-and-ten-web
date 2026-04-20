---
title: "fix: Game View Polish — Dark Mode, Game Context, Trick History, Responsive Layout"
type: fix
status: active
date: 2026-04-19
origin: docs/brainstorms/game-view-polish-requirements.md
---

# fix: Game View Polish — Dark Mode, Game Context, Trick History, Responsive Layout

## Overview

Five pre-merge defects and gaps in the game view: no dark mode support (hardcoded light-mode colors throughout), missing bidding context (standing bid + current bidder), no trump display after trump selection, no trick history, and a fixed-width layout that wastes large-screen real estate. All required data already exists in the game state; this is entirely a UI and styling change.

## Problem Frame

The game UI was built primarily for light mode and a narrow mobile viewport. Now that the app is SSR-ready and heading toward merge, these gaps degrade real playability: dark mode is completely illegible, players have no context during bidding or after trump is selected, and the layout is worse on large screens than on mobile. (See origin: `docs/brainstorms/game-view-polish-requirements.md`)

## Requirements Trace

- R1–R3: Dark mode — all game components legible, semantic colors preserved, using `dark:` Tailwind variants
- R4–R5: Bidding context — standing bid value and current leading bidder visible during BIDDING phase
- R6: Trump display — trump suit shown persistently during DISCARD and TRICKS phases
- R7–R8: Trick history — completed tricks visible, collapsed by default with toggle, scroll-contained
- R9–R11: Responsive layout — expands on md+, two-column at lg+, mobile unchanged

## Scope Boundaries

- No API changes, no game rule changes, no data model changes
- No changes to lobby, auth, or non-game views
- No new animations unless they fall naturally out of layout
- Accessibility beyond color contrast is out of scope
- No dark mode toggle UI — system `prefers-color-scheme` only

## Context & Research

### Relevant Code and Patterns

- `app/globals.css` — Tailwind v4 CSS-first config; `--background`/`--foreground` CSS vars with `@media (prefers-color-scheme: dark)` already on `body`. No `dark:` component variants exist anywhere.
- `components/game/game-status-bar.tsx` — pure display component (no `'use client'`); receives `phase`, `myTurn`, `isStale`, `activePlayerId`. Does not receive `bid_amount`, `bidder_player_id`, or `trump`.
- `components/game/game-board.tsx` — the central orchestrator; already has `started` (full `StartedGame`) available. Passes a subset of props to children. This is where new props originate.
- `components/game/trick-area.tsx` — shows only `tricks[tricks.length - 1]` (current trick). Has a `playerNames?: Map<string, string>` prop that is never passed. History is invisible.
- `lib/api/types.ts` — `StartedGame` has: `bid_amount: number | null`, `bidder_player_id: string | null`, `trump: SelectableSuit | null` (`"HEARTS" | "DIAMONDS" | "CLUBS" | "SPADES"`), `tricks: Trick[]`, `players: PlayerInRound[]`.
- `components/game/card.tsx`, `card-labels.ts` — suit symbol map (`SUIT_SYMBOL`) already defined; trump display can reuse it.
- `app/games/[gameId]/game-page.tsx` — layout: `<main className="mx-auto max-w-2xl p-4">`. No responsive breakpoints.

### Institutional Learnings

- `docs/solutions/best-practices/use-client-directive-ssr-migration-2026-04-19.md` — New display-only components (no hooks, no event handlers) should be server components — omit `'use client'`. Components added here that are purely display (e.g., `TrumpBadge`, `TrickHistory`) should follow this rule.

### External References

- Tailwind v4 dark mode: `dark:` variant responds to `prefers-color-scheme: dark` by default with no config changes. No `@custom-variant` needed for media-query-based dark mode. Source confirmed from `node_modules/tailwindcss/dist/lib.js`.

## Key Technical Decisions

- **Media-query dark mode (no class toggle):** `dark:` utilities work out of the box in Tailwind v4 with `prefers-color-scheme`. No `@custom-variant`, no JS toggle, no layout-level client component needed. Keeps the fix minimal and avoids adding a `'use client'` boundary.
- **Extend `GameStatusBar` props rather than new components:** Bidding context and trump display fit naturally in `GameStatusBar` — it already handles phase-aware display. Adding props is lower complexity than a new component alongside it.
- **Separate `TrickHistory` component:** Trick history is distinct enough (toggle state, scroll container, full list) that it warrants its own component rather than cramming into `TrickArea`. `TrickArea` stays focused on the current trick.
- **`TrickHistory` needs `'use client'`** for collapse toggle state (`useState`). `TrickArea` stays server component.
- **Two-column layout in `game-page.tsx`:** The responsive grid belongs at the page level, not inside `GameBoard`. At lg+: left column = main game controls; right column = scores, status info. `GameBoard` internal layout stays `flex flex-col`.
- **Player names — IDs only:** `PlayerInRound` (confirmed in `lib/api/types.ts`) only has `id` and `type` — no display name field. The `playerNames` map will map `player_id → player_id.slice(0, 8)` (truncated ID). There are no human-readable names available from the game state. This is consistent with the existing convention in `trick-area.tsx` and `game-status-bar.tsx`.
- **ScoreBoard stays inside GameBoard:** For all screen sizes, `ScoreBoard` remains inside `GameBoard`. At lg+, the right sidebar shows `ScoreBoard` via a conditional `lg:hidden`/`lg:block` approach — `ScoreBoard` is hidden inside `GameBoard` at lg+ and shown in the sidebar instead. This avoids double-rendering or moving the component.

## Open Questions

### Resolved During Planning

- **What is the trump field name?** `started.trump: SelectableSuit | null` — confirmed in `lib/api/types.ts`.
- **What is the current bidder field?** `started.bidder_player_id` (leading bidder) + `started.bid_amount` (leading bid). The current *active* bidder is `active_player_id`, already surfaced as `activePlayerId` in `GameStatusBar`.
- **Does Tailwind v4 need config for dark mode?** No — `dark:` works automatically with `prefers-color-scheme`. No `@custom-variant` needed.
- **Where does trick history toggle state live?** In `TrickHistory` component itself (`useState`), keeping `GameBoard` and parent components stateless for this feature.

### Deferred to Implementation

- Exact `dark:` color choices per component surface — implementer should match semantic intent (e.g., `dark:bg-gray-800` for white panels, `dark:text-gray-100` for dark text) without introducing new hues.
- Column proportions for the two-column large-screen layout (e.g., `lg:grid-cols-[1fr_300px]` vs equal columns) — decide based on visual feel during implementation.
- Whether `bid_amount: 0` (pass) should display as "Pass" or "0" — treat as implementation detail; "Pass" is more readable.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

**Props flow after changes:**

```
game-page.tsx
  └── GameBoard (started, completed, ...)
        ├── GameStatusBar (phase, myTurn, isStale, activePlayerId,
        │                  bidAmount, bidderPlayerId, trump)         ← new props
        ├── TrumpBadge / trump display in GameStatusBar (trump)      ← new section
        ├── TrickArea (tricks=[last], playerNames)                   ← playerNames now wired
        ├── TrickHistory (tricks=all-but-last, playerNames)          ← new component
        └── [controls: BidControls | TrumpSelector | Hand | DiscardControls]

game-page.tsx layout at lg+:
  ┌─────────────────────────┬──────────────────┐
  │  Left: GameBoard        │  Right: sidebar  │
  │  (status, tricks,       │  (ScoreBoard,    │
  │   hand, controls)       │   trump display) │
  └─────────────────────────┴──────────────────┘
```

## Implementation Units

- [ ] **Unit 1: Dark mode — game components**

**Goal:** Add `dark:` Tailwind variants to all game components so they are legible under `prefers-color-scheme: dark`.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Modify: `components/game/game-board.tsx`
- Modify: `components/game/game-status-bar.tsx`
- Modify: `components/game/score-board.tsx`
- Modify: `components/game/trick-area.tsx`
- Modify: `components/game/hand.tsx`
- Modify: `components/game/card.tsx`
- Modify: `components/game/bid-controls.tsx`
- Modify: `components/game/trump-selector.tsx`
- Modify: `components/game/discard-controls.tsx`
- Modify: `components/game/suggestion-toggle.tsx`

**Approach:**
- For each component, identify every hardcoded light-mode surface: `bg-white`, `bg-gray-50`, `bg-blue-50`, `bg-yellow-50`, `bg-green-50`, `bg-red-50`, `text-gray-900`, `text-gray-500`, `border-gray-200`, etc.
- Add `dark:` companion class for each — dark backgrounds, lighter text, adjusted border tones.
- Preserve semantic hues (amber = suggestions, blue = primary, yellow = winning, red = error, green = game over, purple = Joker). Only brightness adjusts.
- Cards (`card.tsx`) need careful treatment: selected/suggested/default states all have distinct light backgrounds that need dark equivalents.
- `app/globals.css` body already handles `--background`/`--foreground` — no change needed there.

**Patterns to follow:**
- Tailwind `dark:` variant — no config change required (Tailwind v4 default)
- Existing color semantics across `bid-controls.tsx`, `card.tsx`, `suggestion-toggle.tsx`

**Test scenarios:**
- Test expectation: none — pure styling, no behavioral logic. Visual verification: toggle OS dark mode and confirm all game view surfaces are legible. Semantic color meanings (amber suggestions, blue primary, yellow winning, etc.) remain recognizable in dark mode.

**Verification:**
- With OS dark mode on, all game view text is readable, no white panels on near-black backgrounds, semantic colors recognizable.

---

- [ ] **Unit 2: GameStatusBar — bidding context and trump display**

**Goal:** Surface current standing bid (value + leading bidder) during BIDDING phase, and trump suit during DISCARD/TRICKS phases, in `GameStatusBar`.

**Requirements:** R4, R5, R6

**Dependencies:** None (props added in this unit; GameBoard wiring in Unit 3)

**Files:**
- Modify: `components/game/game-status-bar.tsx`

**Approach:**
- Add props: `bidAmount?: number | null`, `bidderPlayerId?: string | null`, `trump?: SelectableSuit | null`
- During BIDDING phase: if `bidAmount` is non-null and > 0, render a row showing "Current bid: {amount}" and "Leading: {bidderPlayerId.slice(0,8)}{' (you)' if matches local player}". If `bidAmount` is null or 0, render "No bids yet".
- During DISCARD and TRICKS phases: render trump suit symbol and name (e.g., "♥ Hearts") using `SUIT_SYMBOL` from `card-labels.ts` and a readable suit name map.
- `GameStatusBar` stays a server component (no `'use client'` needed — props only, no event handlers).
- Import `SelectableSuit` type from `lib/api/types.ts`.

**Patterns to follow:**
- Existing pill/badge pattern in `game-status-bar.tsx` (blue/gray pill for turn indicator)
- `SUIT_SYMBOL` from `components/game/card-labels.ts`
- Player ID truncation: `.slice(0, 8)` with "(you)" suffix

**Test scenarios:**
- Test expectation: none — pure display component with no stateful logic. Verify manually: during BIDDING with no bids, "No bids yet" shows; with a bid of 20 by another player, "Current bid: 20 / Leading: abc12345" shows; with your own bid, "(you)" appended; trump shows correct symbol + name during DISCARD/TRICKS.

**Verification:**
- All four states render correctly: no bids, other player leading, local player leading, trump display.

---

- [ ] **Unit 3: GameBoard — wire new props to GameStatusBar and TrickArea**

**Goal:** Pass `bid_amount`, `bidder_player_id`, and `trump` from `started` to `GameStatusBar`. Build the `playerNames` map and pass it to `TrickArea`.

**Requirements:** R4, R5, R6, R7

**Dependencies:** Unit 2 (GameStatusBar props interface defined)

**Files:**
- Modify: `components/game/game-board.tsx`

**Approach:**
- Extract `bid_amount`, `bidder_player_id`, `trump`, `players` from `started` (already available in GameBoard as a prop).
- Build `playerNames: Map<string, string>` from `started.players` — map `player_id → display_name` (or truncated ID if no display name field; check `PlayerInRound` type in `lib/api/types.ts`).
- Pass to `GameStatusBar`: `bidAmount={started.bid_amount}`, `bidderPlayerId={started.bidder_player_id}`, `trump={started.trump}`.
- Pass `playerNames` to `TrickArea`.

**Patterns to follow:**
- Existing destructuring pattern in `game-board.tsx`
- `PlayerInRound` type from `lib/api/types.ts` — check for `name` or `display_name` field

**Test scenarios:**
- Test expectation: none — prop threading with no new logic. Verify via integration: game in BIDDING phase renders bid context; game in TRICKS phase renders trump; trick plays show player names.

**Verification:**
- All new props flow through without TypeScript errors. `npm run build` passes.

---

- [ ] **Unit 4: TrickHistory component**

**Goal:** New collapsible component showing all completed tricks (all but the current/last trick).

**Requirements:** R7, R8

**Dependencies:** Unit 3 (playerNames map available)

**Files:**
- Create: `components/game/trick-history.tsx`

**Approach:**
- Accepts props: `tricks: Trick[]` (all tricks including current), `playerNames?: Map<string, string>`, `playerId: string`
- Derives completed tricks: `tricks.slice(0, -1)` — all except the last (current) trick
- If no completed tricks, renders nothing
- Toggle state: `useState(false)` for expanded/collapsed — needs `'use client'`
- Collapsed default: show button "N tricks played ▼" (where N = completed trick count)
- Expanded: scroll-contained list (`max-h-64 overflow-y-auto` or similar) showing each completed trick — trick number, winner, and each play (player name + card label)
- Reuse `SUIT_SYMBOL` and `NUMBER_LABEL` from `card-labels.ts` for card display
- Winning play highlighted (consistent with `trick-area.tsx` yellow highlight)

**Patterns to follow:**
- `components/game/trick-area.tsx` — card display, player name truncation, winning play highlight
- `components/game/card-labels.ts` — `SUIT_SYMBOL`, `NUMBER_LABEL`
- `components/game/discard-controls.tsx` — two-step/toggle UI pattern

**Test scenarios:**
- Happy path: 3 completed tricks render correctly when expanded; collapsed shows "3 tricks played ▼"
- Edge case: 0 completed tricks — component renders nothing (no toggle shown)
- Edge case: 1 completed trick — "1 trick played ▼" with correct singular/plural handling
- Happy path: winning play in each completed trick gets yellow highlight
- Happy path: player names shown from `playerNames` map; falls back to truncated ID if not in map

**Verification:**
- Component renders, toggle works, history is scroll-contained, no layout shift on current trick area.

---

- [ ] **Unit 5: Wire TrickHistory into GameBoard**

**Goal:** Render `TrickHistory` in the game flow during the TRICKS phase, between `TrickArea` and the hand/controls.

**Requirements:** R7, R8

**Dependencies:** Unit 3 (playerNames), Unit 4 (TrickHistory component)

**Files:**
- Modify: `components/game/game-board.tsx`

**Approach:**
- Import `TrickHistory`
- In the TRICKS phase render block, add `<TrickHistory tricks={started.tricks} playerNames={playerNames} playerId={playerId} />` between `TrickArea` and `Hand`
- Show only during TRICKS phase (not DISCARD, BIDDING, etc. — there are no completed tricks in those phases anyway, so the component would render nothing, but be explicit for clarity)

**Patterns to follow:**
- Existing phase-conditional rendering in `game-board.tsx`

**Test scenarios:**
- Test expectation: none — import and render wiring only. Verify via integration during TRICKS phase.

**Verification:**
- TrickHistory appears below TrickArea during TRICKS phase. No TypeScript errors. Build passes.

---

- [ ] **Unit 6: Responsive layout in game-page.tsx**

**Goal:** Replace fixed `max-w-2xl` with a responsive layout: wider single column at md, two-column grid at lg+.

**Requirements:** R9, R10, R11

**Dependencies:** None (independent of other units)

**Files:**
- Modify: `app/games/[gameId]/game-page.tsx`

**Approach:**
- Change `<main className="mx-auto max-w-2xl p-4">` to a responsive container
- At base/mobile: single column, comfortable padding, no width restriction change
- At md (≥768px): expand to `max-w-4xl` or `max-w-5xl` — still single column but uses more width
- At lg (≥1024px): two-column grid. Left column: primary game content (`GameBoard`). Right column: `ScoreBoard` and any persistent info (trump display context). Column proportions: approximately `lg:grid-cols-[1fr_280px]` — main content gets most space, sidebar is fixed-width reference panel.
- Move `ScoreBoard` out of `GameBoard` and into the sidebar at lg breakpoint, OR use a conditional render approach where `ScoreBoard` shows in sidebar at lg+ and inline at smaller sizes. **Simpler approach:** keep `ScoreBoard` inside `GameBoard` for mobile, and accept some duplication or a responsive hide/show at lg. Exact approach is an implementation decision — the requirement is that large screens use the space.
- Mobile layout (< md) must remain unchanged: `max-w-2xl`, single column, existing padding.

**Patterns to follow:**
- Tailwind responsive prefixes (`md:`, `lg:`) — mobile-first
- Existing `p-4` padding convention

**Test scenarios:**
- Test expectation: none — pure layout/styling. Verify visually: mobile viewport unchanged; at 1440px, game content is no longer confined to a 672px column; two-column arrangement visible at lg+; touch targets and hand scroll unaffected on mobile.

**Verification:**
- At 1440px desktop, game view makes meaningful use of width. Mobile layout unchanged. Build passes.

## System-Wide Impact

- **Interaction graph:** All changes are additive prop extensions or layout changes. No new callbacks, middleware, or observers introduced.
- **Error propagation:** No new error paths — all new fields are nullable (`trump: SelectableSuit | null`, `bid_amount: number | null`, `bidder_player_id: string | null`); components handle null gracefully by showing nothing.
- **State lifecycle risks:** `TrickHistory` has local `useState` for collapse toggle — resets to collapsed on game state changes (this is acceptable behavior).
- **API surface parity:** No API changes. `started` already contains all required fields.
- **Integration coverage:** The key cross-layer behavior to verify is the prop thread from `use-game-state` hook → `game-page.tsx` → `GameBoard` → `GameStatusBar`/`TrickArea`/`TrickHistory`. TypeScript compilation verifies the chain; visual review verifies rendering.
- **Unchanged invariants:** Game logic, API calls, auth flow, lobby views, and polling behavior are untouched.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `dark:` color choices make semantic highlights (amber suggestions, yellow winning) harder to distinguish in dark mode | Verify each semantic color has adequate contrast in dark mode. Use darker tinted backgrounds (e.g., `dark:bg-amber-900`) rather than light `dark:bg-amber-50`. |
| Responsive layout breaks on tablets (~768px) where two-column may feel cramped | Set lg (1024px) as the two-column breakpoint, not md. Single-column expands at md without going two-column. |
| `ScoreBoard` duplication if sidebar approach adds a second render | Prefer conditional show/hide (`lg:hidden` / `lg:block`) over rendering twice; or accept inline ScoreBoard stays inside GameBoard for all sizes and the sidebar is reserved for other info |
| `TrickHistory` `useState` means it needs `'use client'` — slightly larger client bundle | Acceptable; it's a small component. Collapsible behavior cannot be done without browser state. |

## Sources & References

- **Origin document:** [docs/brainstorms/game-view-polish-requirements.md](docs/brainstorms/game-view-polish-requirements.md)
- Related code: `components/game/game-board.tsx`, `components/game/game-status-bar.tsx`, `components/game/trick-area.tsx`, `lib/api/types.ts`
- Institutional learning: `docs/solutions/best-practices/use-client-directive-ssr-migration-2026-04-19.md`
- Tailwind v4 dark mode: built-in `prefers-color-scheme` support, no config needed (verified `node_modules/tailwindcss/dist/lib.js`)
