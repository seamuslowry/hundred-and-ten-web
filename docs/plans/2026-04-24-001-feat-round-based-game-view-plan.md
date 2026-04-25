---
title: "feat: Rebuild game page around round-based API"
type: feat
status: completed
date: 2026-04-24
origin: docs/brainstorms/round-based-game-view-requirements.md
deepened: 2026-04-24
---

# feat: Rebuild game page around round-based API

## Overview

Switch the game page from the flat `StartedGame` endpoint to the round-based `SpikeGame` spike endpoint, and rebuild the UI to match the mockup (`mockup.svg`). The mockup organizes the game view around rounds: active round always expanded at top, past completed rounds in compact/expandable form below, with bid history, discard visibility, and per-round scores throughout.

---

## Problem Frame

The current game page fetches a flat `StartedGame` object that exposes only the current round's surface state -- no round history, no bid history within a round, no discard visibility. The spike API (`/games/{game_id}/spike`) returns a `SpikeGame` with a `rounds[]` array where each round carries bid history, discards, trick details with winners, and per-round scores. This plan implements the frontend switch to that API and the UI rebuild to expose the richer data. (see origin: `docs/brainstorms/round-based-game-view-requirements.md`)

---

## Requirements Trace

- R1. Fetch from spike endpoint instead of current endpoint
- R2. TypeScript types for spike response
- R3. Replace `getGame()` and `StartedGame` with spike equivalents
- R4. Player name resolution unchanged (`getGamePlayers()`)
- R5. Action submission unchanged (`/actions` endpoint, re-fetch after)
- R6. Active round displays: phase, dealer, bidder+amount, active player, trump
- R7. Bid history panel
- R8. Hand display (self=cards, others=count)
- R9. Discards section (self=cards, others=count)
- R10. Tricks display (current + completed tricks)
- R11. Phase controls (bid, trump, discard, play) with mockup labels
- R12. Past rounds in reverse chronological order
- R13. Compact view: round number, dealer, bidder+bid, scores
- R14. Expanded view: full round detail
- R15. No-bidder round variant
- R16. Cumulative game scores visible at game level
- R17. Per-round scores in expanded completed rounds
- R18. Completed game state with winner and final scores

---

## Scope Boundaries

- No dark mode changes (separate concern, `game-view-polish-requirements.md` R1-R3)
- No responsive two-column desktop layout (deferred per origin doc)
- No changes to lobby, auth, or non-game views
- No changes to action submission endpoints
- No suggestion/hints integration (component stays unwired)
- No games search/list page changes
- No player avatars/pictures

### Deferred to Follow-Up Work

- Two-column responsive layout for large screens: separate iteration after round structure is stable
- Player avatar display in game view: separate iteration

---

## Context & Research

### Relevant Code and Patterns

- **API client pattern**: `apiFetch<T>(path)` in `lib/api/client.ts` -- auth-aware fetch with 10s timeout, 401 retry
- **Domain API pattern**: functions in `lib/api/games.ts` return typed promises, one function per endpoint
- **Type definitions**: centralized in `lib/api/types.ts` -- string literal unions for enums, discriminated unions for polymorphic types
- **Hook pattern**: `usePolling` → `useGameState` → props to components. Polling via `setTimeout` chain with exponential backoff
- **State derivation**: `useGameState` uses "adjust state during render" pattern (not `useEffect`) for polling control. ESLint bans `setState` inside `useEffect`
- **Component pattern**: named exports, props interfaces inline, PascalCase. Phase-conditional rendering via `{phase === "X" && <Component />}`
- **SpikeTrick is structurally identical to existing Trick type** -- `TrickArea` and `TrickHistory` need no prop interface changes
- **StartedGame/CompletedGame/getGame audit**: exclusively used in game page chain (`lib/api/types.ts` definition, `lib/api/games.ts`, `lib/hooks/use-game-state.ts`, `components/game/game-board.tsx` + `use-game-state.test.ts`). No other consumers. Safe to remove
- **`getGamePlayers()` is defined but unused**: exists in `lib/api/games.ts` but is not called anywhere in the codebase. First-time integration requires handling the async fetch lifecycle

### Institutional Learnings

- **Async handler safety** (`docs/solutions/best-practices/react-async-handler-memoization-and-prop-consistency-2026-04-21.md`): All async handlers must use `useCallback` with `catch {}`. Match optional/required across layered prop interfaces
- **API field display guards** (`docs/solutions/ui-bugs/game-ui-rendering-and-style-fixes-2026-04-19.md`): Use field nullability as display condition, not phase gates. `bidder_player_id` is only populated after bidding concludes
- **Frontend validation boundary** (`docs/solutions/best-practices/discard-stage-ux-improvements-2026-04-22.md`): Only disable buttons for structural reasons (in-flight, missing input). Backend is authoritative for game rules
- **Dealer bid rule** (`docs/solutions/ui-bugs/dealer-bid-at-current-value-disabled-2026-04-21.md`): Thread role-specific rules as explicit props (e.g., `canMatchCurrentBid`). Name props for the rule, not the role
- **Responsive sidebar**: use `block lg:hidden` / `hidden lg:block` on a single render site, never render the same component from two places

---

## Key Technical Decisions

- **Replace, don't wrap**: Switch `getGame()` → `getSpikeGame()` directly rather than wrapping the old function. The audit confirmed no external consumers
- **Hook returns derived active round**: `useGameState` extracts `activeRound`, `completedRounds`, `hand`, `phase`, `myTurn` from the `SpikeGame` response so components stay presentation-focused
- **Reuse existing phase controls**: `BidControls`, `TrumpSelector`, `DiscardControls`, `TrickArea`, `TrickHistory`, `Hand`, `Card` all have compatible interfaces. Only data sources change, not component contracts (except "Shoot the Moon" label). `ScoreBoard` gains a `playerNames` prop for name resolution
- **Player name resolution via route-level state**: `getGamePlayers()` is called in the route component alongside game data. Use `useState` + `useEffect` (or a small `usePlayerNames` wrapper) to fetch once on mount and on gameId change. Pass the resulting `Map<string, string>` down to GameBoard, ScoreBoard, and RoundHistory. Loading: show truncated IDs until names resolve (non-blocking)
- **Refactor GameBoard, don't replace it**: `GameBoard` keeps its role as active-round orchestrator. New components slot in alongside existing ones
- **Route handles page layout**: `$gameId.tsx` arranges the vertical flow (ScoreBoard → GameBoard → RoundHistory), keeping concerns separated
- **Simple expand/collapse for past rounds**: `useState<Set<number>>` for tracking which round indices are expanded. No animations -- consistent with existing `TrickHistory` accordion pattern
- **Cumulative scores at top of page**: ScoreBoard rendered above the active round in a single-column layout. Desktop sidebar removed (two-column deferred)

---

## Open Questions

### Resolved During Planning

- **[R3] Which views reference StartedGame?**: Only the game page chain (4 source + 2 test files). Safe to remove entirely
- **[R11] Bid validation changes?**: None. `BidControls` props (`currentBid`, `canMatchCurrentBid`) map directly from `SpikeActiveRound` fields. Only label change ("60" → "Shoot the Moon")
- **[R8-R9] Mobile hand/discard display?**: Existing responsive patterns sufficient. Other players' hands/discards are already compact counts
- **[R12-R14] Expand/collapse animation?**: No animations. Simple show/hide via state toggle, matching `TrickHistory` pattern

### Deferred to Implementation

- Exact responsive breakpoints for new components -- follow existing `md:` / `lg:` conventions and adjust during implementation
- Whether `CompletedGame` type should be fully removed or retained as a stub for future search page -- implementer should remove and note in commit

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
Page Layout ($gameId.tsx)
┌─────────────────────────────┐
│  ← Back to lobbies          │
│  Game Name                  │
├─────────────────────────────┤
│  ScoreBoard (cumulative)    │
│  Player1: 45  Player2: 30  │
├─────────────────────────────┤
│  GameBoard (active round)   │
│  ┌─────────────────────────┐│
│  │ RoundHeader             ││
│  │ Phase | Dealer | Bidder ││
│  │ Trump | Active Player   ││
│  ├─────────────────────────┤│
│  │ BidHistoryPanel         ││
│  │ P1: Pass, P2: 15, ...  ││
│  ├─────────────────────────┤│
│  │ OtherPlayersHands       ││
│  │ P2: 4 cards  P3: 5     ││
│  ├─────────────────────────┤│
│  │ Phase Controls          ││
│  │ (Bid/Trump/Discard/Play)││
│  ├─────────────────────────┤│
│  │ DiscardArea             ││
│  │ Your discards | Others  ││
│  ├─────────────────────────┤│
│  │ TrickArea + TrickHistory││
│  └─────────────────────────┘│
├─────────────────────────────┤
│  RoundHistory               │
│  ┌ Round 3 ──────────── ▼ ┐ │
│  │ Dealer: P4  Bidder: P2 │ │
│  │ @ 15  Scores: ...      │ │
│  └────────────────────────┘ │
│  ┌ Round 2 ──────────── ▶ ┐ │
│  │ (compact)              │ │
│  └────────────────────────┘ │
└─────────────────────────────┘
```

**Data flow:**

```
getSpikeGame() → usePolling → useGameState
  ├── game.scores → ScoreBoard
  ├── activeRound → GameBoard
  │     ├── .status → phase controls + RoundHeader
  │     ├── .hands[playerId] → Hand (self cards)
  │     ├── .hands (others) → OtherPlayersHands
  │     ├── .bid_history → BidHistoryPanel
  │     ├── .discards → DiscardArea
  │     ├── .tricks → TrickArea + TrickHistory
  │     └── .bid_amount, .dealer_player_id, etc → RoundHeader
  └── completedRounds → RoundHistory
        └── per-round → CompletedRoundView (compact/expanded)
```

---

## Implementation Units

- U1. **Spike API types and client function**

**Goal:** Add TypeScript types matching the spike endpoint's OpenAPI schema and a client function to fetch from it.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `lib/api/types.ts`
- Modify: `lib/api/games.ts`
- Test: `lib/api/__tests__/client.test.ts`

**Approach:**
- Add types to `lib/api/types.ts`: `SpikeGame`, `SpikeActiveRound`, `SpikeCompletedRound`, `SpikeCompletedNoBiddersRound`, `SpikeBid`, `SpikeRound` (discriminated union on `status`). Reuse existing `Card`, `SelectableSuit`, `PlayerInGame`, `Trick` types where shapes match (SpikeTrick is structurally identical to Trick -- alias or reuse directly)
- Add `getSpikeGame(playerId: string, gameId: string): Promise<SpikeGame>` to `lib/api/games.ts` hitting `GET /players/{playerId}/games/{gameId}/spike`
- Keep `getGame()` intact in this unit -- removal happens in U6

**Patterns to follow:**
- Type definition style in `lib/api/types.ts`: interfaces with explicit field types, discriminated unions for polymorphic responses
- Client function style in `lib/api/games.ts`: `apiFetch<SpikeGame>(path)` pattern

**Test scenarios:**
- Happy path: `getSpikeGame` calls `apiFetch` with correct path `/players/{playerId}/games/{gameId}/spike`
- Happy path: `getSpikeGame` returns typed `SpikeGame` response

**Verification:**
- `npx tsc --noEmit` passes with new types
- New client function exists and is importable

---

- U2. **Update useGameState hook for round-based data**

**Goal:** Switch the hook from `getGame()` to `getSpikeGame()` and derive active round state, hand, phase, and polling control from the rounds-based response.

**Requirements:** R1, R3, R4, R5, R6, R8

**Dependencies:** U1

**Files:**
- Modify: `lib/hooks/use-game-state.ts`
- Test: `lib/hooks/__tests__/use-game-state.test.ts`

**Approach:**
- Replace `getGame()` import with `getSpikeGame()`
- Derive `activeRound` by finding the round in `game.rounds[]` whose status is one of `BIDDING`, `TRUMP_SELECTION`, `DISCARD`, `TRICKS` (use status-based find, not positional assumption on array order). If no round matches, `activeRound` is null (game is over)
- Extract hand: `activeRound?.hands[playerId]` -- if it's `Card[]`, use it; if it's a number (shouldn't happen for self), fall back to empty array
- Derive `myTurn`: `activeRound?.active_player_id === playerId`
- Derive `phase`: `activeRound?.status ?? null`
- Derive `isCompleted`: `!!game.winner` (defensive -- handles both `null` and `undefined` if API omits the field)
- Derive `completedRounds`: all rounds except the active one, cast to completed types
- Polling control: poll when `!myTurn && !isCompleted && !!playerId` -- same logic, different derivation path. Continue using the "adjust state during render" pattern (not `useEffect`)
- Return shape adds `activeRound`, `completedRounds`, `isCompleted`, `winner`. Removes `started`, `completed` (old types)

**Execution note:** Update tests in the same unit since mock data shapes must change to match the new API response structure.

**Patterns to follow:**
- "Adjust state during render" for polling control (`docs/solutions/best-practices/react-async-handler-memoization-and-prop-consistency-2026-04-21.md`)
- Type guard pattern: structural check (`Array.isArray(hands[playerId])`) for hand extraction
- Spy-wrapping mock pattern for `usePolling` assertions

**Test scenarios:**
- Happy path: Hook fetches from spike endpoint via `getSpikeGame`
- Happy path: Hand extracted from `activeRound.hands[playerId]` when value is `Card[]`
- Happy path: `phase` derived from `activeRound.status`
- Happy path: `myTurn` is true when `activeRound.active_player_id === playerId`
- Happy path: `isCompleted` is true when `game.winner` is set
- Happy path: `completedRounds` contains exactly the non-active rounds, preserving order, with correct count
- Happy path: `completedRounds` includes both `SpikeCompletedRound` and `SpikeCompletedNoBiddersRound` variants
- Edge case: `activeRound` is null when all rounds have status COMPLETED or COMPLETED_NO_BIDDERS
- Edge case: `activeRound` is null when `game.winner` is undefined (field absent, not just null)
- Edge case: Hand falls back to empty array when `hands[playerId]` is missing or not an array
- Happy path: Polling enabled when not player's turn and game not completed
- Happy path: Polling disabled when it is player's turn
- Happy path: Polling disabled when game is completed
- Integration: Game transitions from active to completed during polling (rounds[] changes from having an active round to all-completed)

**Verification:**
- All existing hook tests updated and passing with new mock shapes
- `npx tsc --noEmit` passes
- Hook returns `activeRound`, `completedRounds`, `isCompleted` alongside existing fields

---

- U3. **New round-display components**

**Goal:** Create the new UI components needed by the mockup that don't exist today: bid history panel, discard area, other players' hand counts, and round header.

**Requirements:** R6, R7, R8, R9

**Dependencies:** U1 (types)

**Files:**
- Create: `components/game/bid-history-panel.tsx`
- Create: `components/game/discard-area.tsx`
- Create: `components/game/other-players-hands.tsx`
- Create: `components/game/round-header.tsx`
- Create: `components/game/__tests__/bid-history-panel.test.tsx`
- Create: `components/game/__tests__/discard-area.test.tsx`
- Create: `components/game/__tests__/other-players-hands.test.tsx`
- Create: `components/game/__tests__/round-header.test.tsx`

**Approach:**

`BidHistoryPanel`: Takes `bidHistory: SpikeBid[]` and a `playerNames: Map<string, string>` for display. Renders a labeled list of bids (e.g., "Player 1: Pass", "Player 2: Fifteen"). Pass = amount 0. Use word labels for bid amounts to match mockup (15→"Fifteen", 20→"Twenty", 25→"Twenty Five", 30→"Thirty", 60→"Shoot the Moon").

`DiscardArea`: Takes `discards: Record<string, Card[] | number>`, `playerId: string`, `playerNames: Map<string, string>`. Shows the current player's discarded cards (reuse `Card` component in read-only mode) and other players' discard counts. Only renders when discards map is non-empty.

`OtherPlayersHands`: Takes `hands: Record<string, Card[] | number>`, `playerId: string`, `playerNames: Map<string, string>`. Shows hand counts for all players other than self (e.g., "Player 2: 4 cards").

`RoundHeader`: Takes phase, dealer, bidder, bid amount, trump, active player, playerId, playerNames, and also `onRefresh?`, `isRefreshing?`, `isStale?` for connection status. Replaces `GameStatusBar` for the active round context display. Shows phase badge, "Dealer: Name", "Bidder: Name @ Amount" (with "(pending)" during bidding when `bidder_player_id` is null), "Trump: Suit", "Player N's Turn" / "Your turn" with refresh button, and "Reconnecting..." stale indicator. Use field nullability as display conditions, not phase gates (per institutional learning). Carries forward all `GameStatusBar` UX: refresh button when not your turn, stale indicator, "Your turn" pill.

**Patterns to follow:**
- Component style: named exports, inline props interfaces, Tailwind utilities
- Touch targets: `min-h-[44px]` on interactive elements
- Player display: resolve via `playerNames.get(id)` with fallback to `id.slice(0, 8)`
- Field display guards: nullability checks, not phase gates (`docs/solutions/ui-bugs/game-ui-rendering-and-style-fixes-2026-04-19.md`)

**Test scenarios:**

BidHistoryPanel:
- Happy path: Renders each bid with player name and amount label
- Happy path: Pass (amount 0) displayed as "Pass"
- Edge case: Empty bid history renders nothing or "No bids yet"
- Happy path: Player names resolved from map, fallback to truncated ID

DiscardArea:
- Happy path: Shows current player's discarded cards using Card component when discards[playerId] is Card[]
- Happy path: Shows other players' discard counts (e.g., "Player 2: 2 cards")
- Edge case: Renders nothing when discards map is empty
- Edge case: Handles player with zero discards

OtherPlayersHands:
- Happy path: Shows hand count for each player other than self
- Happy path: Excludes current player from the list
- Happy path: Resolves player names from map with fallback to truncated ID
- Edge case: Handles single-player case (only self, no others)

RoundHeader:
- Happy path: Displays phase, dealer name, and "Your turn" pill when active player matches playerId
- Happy path: Shows bidder and bid amount when both are non-null
- Happy path: Shows trump suit when trump is non-null
- Edge case: Bidder shows "(pending)" when `bidder_player_id` is null during BIDDING phase
- Happy path: Shows "Waiting for Player N" with refresh button when not player's turn
- Happy path: Shows "Reconnecting..." indicator when `isStale` is true
- Happy path: Refresh button calls `onRefresh` and shows refreshing state

BidHistoryPanel bid-amount-to-label mapping:
- Happy path: 15 → "Fifteen", 20 → "Twenty", 25 → "Twenty Five", 30 → "Thirty", 60 → "Shoot the Moon", 0 → "Pass" — each value verified individually

**Verification:**
- All new components render without errors
- `npx tsc --noEmit` passes
- Tests cover happy paths and edge cases for all four components

---

- U4. **Rebuild GameBoard for active round**

**Goal:** Update `GameBoard` to consume round-based data from the updated `useGameState` hook and wire up the new components alongside existing phase controls.

**Requirements:** R6, R7, R8, R9, R10, R11, R16, R18

**Dependencies:** U2, U3

**Files:**
- Modify: `components/game/game-board.tsx`
- Modify: `components/game/bid-controls.tsx`
- Modify: `components/game/score-board.tsx`
- Modify: `routes/games/$gameId.tsx`
- Test: `routes/games/__tests__/game-page.test.tsx`

**Approach:**

`GameBoard` prop interface change: Replace `started: StartedGame | null` and `completed: CompletedGame | null` with `gameId: string`, `activeRound: SpikeActiveRound | null`, `isCompleted: boolean`, `winner: PlayerInGame | null`, `hand: Card[]`, `scores: Record<string, number>`. Keep `myTurn`, `playerId`, `onActionComplete`, `onRefresh`, `isRefreshing`, `isStale`. Add `playerNames: Map<string, string>`. The `gameId` prop is required because `performAction(playerId, gameId, action)` needs the game ID -- the old code got this from `started.id`, but `SpikeActiveRound` does not carry the game ID.

Layout change:
- When `isCompleted` and `winner`: render game-over banner with winner name and ScoreBoard
- When `activeRound` exists: render RoundHeader → BidHistoryPanel → OtherPlayersHands → phase controls → DiscardArea → TrickArea/TrickHistory → read-only Hand
- Phase controls remain: `BidControls` (BIDDING + myTurn), `TrumpSelector` (TRUMP_SELECTION + myTurn), `DiscardControls` (DISCARD + myTurn), selectable `Hand` (TRICKS + myTurn)
- Data mapping: `activeRound.bid_amount` → BidControls.currentBid, `activeRound.dealer_player_id === playerId` → `canMatchCurrentBid`, `activeRound.trump` → DiscardControls.trump, `activeRound.tricks` → TrickArea/TrickHistory

`BidControls` label change: Rename the 60 bid button from "60" to "Shoot the Moon" to match mockup. Use a label map for the rendering loop rather than a simple `{value}` display.

`ScoreBoard` change: Add optional `playerNames?: Map<string, string>` prop. When provided, resolve player IDs to names for display. Falls back to truncated ID (`id.slice(0, 8)`) when map is absent or player not found.

`doAction` guard update: Change from `if (!started || actionInFlight)` to `if (!activeRound || actionInFlight)`. Use `gameId` prop (not `started.id`) in the `performAction` call.

Route file (`$gameId.tsx`) changes:
- Destructure new fields from `useGameState`: `activeRound`, `completedRounds`, `isCompleted`, `winner`, `scores`
- Add player name resolution: call `getGamePlayers(playerId, gameId)` in a `useEffect` on mount and gameId change. Store the resulting `Player[]` in state, build `Map<string, string>` from `player.id → player.name`. This is a first-time integration -- handle loading (show truncated IDs until names resolve) and error (fall back to truncated IDs permanently)
- Remove the `lg:grid` two-column layout. Single column: ScoreBoard (cumulative scores, with playerNames) → GameBoard (active round) → RoundHistory (U5)
- Pass `gameId`, `playerNames`, and new state props to `GameBoard`

**Patterns to follow:**
- Async handler safety: `useCallback` + `try/catch/finally` for `doAction` and `handleRefresh`
- Optional/required prop consistency across layers (`docs/solutions/best-practices/react-async-handler-memoization-and-prop-consistency-2026-04-21.md`)
- Frontend validation boundary: disable only for structural reasons (`docs/solutions/best-practices/discard-stage-ux-improvements-2026-04-22.md`)

**Test scenarios:**
- Happy path: GameBoard renders RoundHeader and BidHistoryPanel when activeRound is provided
- Happy path: BidControls renders when phase is BIDDING and myTurn is true
- Happy path: TrumpSelector renders when phase is TRUMP_SELECTION and myTurn is true
- Happy path: DiscardControls renders when phase is DISCARD and myTurn is true
- Happy path: TrickArea renders when phase is TRICKS
- Happy path: Game over view renders when isCompleted is true with winner name
- Happy path: "Shoot the Moon" label appears on 60 bid button (verify in bid-controls unit test)
- Edge case: GameBoard returns null when activeRound is null and isCompleted is false (loading/transitional state)
- Error path: doAction sets error message when performAction throws
- Error path: doAction prevents double-submission when actionInFlight is true
- Integration: Action submission calls performAction with gameId prop and triggers refetch via onActionComplete
- Happy path: ScoreBoard displays player names from playerNames map
- Happy path: Route fetches player names on mount and passes Map to children

**Verification:**
- Game page renders with mock spike data in tests
- Phase-specific controls appear for correct phases
- Game over view shows winner
- `npm run build` succeeds

---

- U5. **Completed round views with expand/collapse**

**Goal:** Show past completed rounds below the active round in compact form with expand/collapse to reveal full detail.

**Requirements:** R12, R13, R14, R15, R17

**Dependencies:** U1 (types), U3 (shared components like BidHistoryPanel)

**Files:**
- Create: `components/game/completed-round-view.tsx`
- Create: `components/game/round-history.tsx`
- Modify: `routes/games/$gameId.tsx`
- Create: `components/game/__tests__/completed-round-view.test.tsx`
- Create: `components/game/__tests__/round-history.test.tsx`

**Approach:**

`CompletedRoundView`: Takes a single `SpikeCompletedRound | SpikeCompletedNoBiddersRound`, round index, `expanded: boolean`, `onToggle: () => void`, and `playerNames`.

Compact view (default): horizontal divider with expand arrow, round number label, dealer name, bidder + bid amount (or "No bids"), per-round score summary.

Expanded view: full round detail -- reuse `BidHistoryPanel` for bid history, show all hands as card lists (completed rounds reveal all cards), show all discards as card lists, show tricks via `TrickArea`/`TrickHistory` pattern, show per-round scores, show trump suit. For no-bidder rounds, show "No bids" and initial hands only.

`RoundHistory`: Takes `completedRounds` array and `playerNames`. Manages expand/collapse state via `useState<Set<number>>` (set of expanded round indices). Renders rounds in reverse chronological order (most recent completed first). Maps each round to `CompletedRoundView`.

Route wiring: `$gameId.tsx` renders `<RoundHistory>` below `<GameBoard>`, passing `completedRounds` and `playerNames`.

**Patterns to follow:**
- Expand/collapse: `TrickHistory` uses a boolean toggle; use `Set<number>` for multiple independent toggles
- Touch targets: expand/collapse arrow button at `min-h-[44px]`
- Card display: reuse `Card` component in read-only mode for revealed hands/discards

**Test scenarios:**

CompletedRoundView:
- Happy path: Compact view shows round number, dealer, bidder, and bid amount
- Happy path: Compact view shows "No bids" for `SpikeCompletedNoBiddersRound`
- Happy path: Compact view shows per-round scores
- Happy path: Clicking expand arrow calls onToggle
- Happy path: Expanded view shows bid history, hands, discards, tricks, trump, and scores
- Happy path: No-bidder expanded view shows initial hands and no tricks section
- Edge case: Scores display handles negative values (bidder who failed gets -bid)

No-bidder expanded view specifics:
- Happy path: Expanded no-bidder view omits discard section, trump display, and tricks section
- Happy path: Expanded no-bidder view shows initial hands for all players

RoundHistory:
- Happy path: Renders rounds in reverse chronological order (most recent completed first)
- Happy path: All rounds start collapsed by default
- Happy path: Expanding one round does not affect others (independent toggle via Set)
- Edge case: Empty completedRounds array renders nothing or a placeholder

**Verification:**
- Completed rounds appear below active round in the game page
- Expand/collapse toggles individual rounds independently
- Expanded view shows all revealed data (hands, discards, bids, tricks, scores)

---

- U6. **Remove old types and verify build**

**Goal:** Remove the old flat game types and client function that the spike endpoint replaces. Verify the build passes.

**Requirements:** R3

**Dependencies:** U2, U4 (all consumers updated)

**Files:**
- Modify: `lib/api/types.ts`
- Modify: `lib/api/games.ts`
- Modify: `lib/hooks/use-game-state.ts` (remove stale imports if any)
- Modify: `components/game/game-board.tsx` (remove stale imports if any)
- Remove: `components/game/game-status-bar.tsx` (replaced by `round-header.tsx` in U3)
- Remove: `components/game/__tests__/game-status-bar.test.tsx`

**Approach:**
- Remove `StartedGame` interface from `lib/api/types.ts`
- Remove `CompletedGame` interface (audit confirmed no external consumers)
- Remove `Game` type alias (dead code)
- Remove `SelfInRound`, `OtherPlayerInRound`, `PlayerInRound` if no longer used (hand data now comes from `hands` map, not player objects)
- Remove `getGame()` function from `lib/api/games.ts`
- Remove `isStartedGame` type guard from `use-game-state.ts` if no longer used
- Remove `GameStatusBar` component and its test file (replaced by `RoundHeader` in U3)
- Clean up any dangling imports across the game page chain

**Patterns to follow:**
- Verify no remaining imports of removed types via TypeScript compiler

**Test expectation:** none -- this is a removal/cleanup unit. Verification is the build.

**Verification:**
- `npx tsc --noEmit` passes with no errors
- `npm run build` succeeds and produces `dist/` with `index.html`
- No dangling imports of `StartedGame`, `CompletedGame`, `getGame`, or `Game` remain in source files

---

## System-Wide Impact

- **Interaction graph:** Action submission (`performAction`) is unchanged -- POST to `/actions`, re-fetch game state. The re-fetch now hits the spike endpoint. No callbacks, middleware, or observers affected
- **Error propagation:** `apiFetch` error handling (ApiError, TimeoutError, 401 retry) applies unchanged to the spike endpoint. `usePolling` backoff behavior unchanged
- **State lifecycle risks:** None new. The hook replaces state entirely on each fetch (no patching). Polling control logic changes derivation source but not behavior
- **API surface parity:** The spike endpoint is the sole new API surface. Action, suggestion, and player endpoints are unchanged
- **Unchanged invariants:** `performAction`, `getSuggestions`, `getGamePlayers`, `usePolling`, `useAuth`, `apiFetch` -- all unchanged. Lobby and auth views untouched. Firebase auth flow untouched

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Spike endpoint not promoted to main path before other consumers need it | Frontend hits `/spike` path for now. Client function URL is a single-line change when promoted |
| Completed round expanded view is data-heavy on games with many rounds | Expand/collapse defaults to compact. Only expanded rounds render full card grids |
| Player name resolution adds an extra API call | Already the current behavior via `getGamePlayers()`. No regression |
| Type removal breaks future search page | Search page doesn't exist yet. Search endpoint types can be re-added when that page is built |
| Mock data in tests becomes more complex (nested rounds structure) | Invest in well-structured mock factories; this complexity is inherent to the richer API |

---

## Sources & References

- **Origin document:** [docs/brainstorms/round-based-game-view-requirements.md](docs/brainstorms/round-based-game-view-requirements.md)
- **Mockup:** [mockup.svg](mockup.svg)
- **Spike API spec:** OpenAPI at `/openapi.json` (locally running spike branch)
- Related learnings: `docs/solutions/best-practices/react-async-handler-memoization-and-prop-consistency-2026-04-21.md`, `docs/solutions/ui-bugs/game-ui-rendering-and-style-fixes-2026-04-19.md`, `docs/solutions/best-practices/discard-stage-ux-improvements-2026-04-22.md`, `docs/solutions/ui-bugs/dealer-bid-at-current-value-disabled-2026-04-21.md`
