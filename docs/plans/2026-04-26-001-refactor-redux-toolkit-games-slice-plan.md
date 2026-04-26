---
title: "refactor: Migrate game state to Redux Toolkit (PR 1 of 3)"
type: refactor
status: completed
date: 2026-04-26
deepened: 2026-04-26
origin: docs/brainstorms/state-management-redux-toolkit-requirements.md
---

# refactor: Migrate game state to Redux Toolkit (PR 1 of 3)

## Overview

Introduce Redux Toolkit as the project's state management layer and migrate **game state** out of `useGameState` / `usePolling` / route-local `useState` into a single Redux store. Auth and lobbies stay where they are; this PR establishes the store, the games slice, the typed hooks, and the patterns that PR 2 (lobbies/players) and PR 3 (auth) will follow.

PR 1 ships using simple "set whole game" semantics. The action endpoint's `Event[]` response is intentionally ignored; we re-fetch the game after each action exactly as today, just routed through a thunk instead of a callback. The slice is shaped using feature-folder layout (`store/games/`) so PR 2 just adds a parallel `store/lobbies/` folder.

---

## Problem Frame

Game state today is scattered:

- `lib/hooks/use-game-state.ts` derives 13 pieces of state from a single polled fetch.
- `routes/games/$gameId.tsx` adds three more local `useState`s and threads `onActionComplete: refetch` through `GameBoard`.
- `components/game/game-board.tsx` adds two more (`actionInFlight`, `actionError`) plus the `performAction` call.
- `lib/hooks/use-polling.ts` contains bespoke polling, focus-refetch, online-refetch, and exponential-backoff logic that gets re-instantiated per consumer.

The result is prop drilling, per-route duplication, and no single place to observe state changes. The architecture also has no entry point for the planned websocket transport — every component would have to be wired up individually. (see origin: `docs/brainstorms/state-management-redux-toolkit-requirements.md`)

---

## Requirements Trace

- R1. Game state is owned by a single Redux store; route components read it via selectors.
- R2. `useGameState` and the game-specific use of `usePolling` are removed by end of PR 1.
- R3. `routes/games/$gameId.tsx` reads game data exclusively from selectors; the `onActionComplete` / `refetch` props to `GameBoard` are removed.
- R4. The action → state-update path is reduced to: thunk POSTs the action, then re-fetches the game and dispatches `gameLoaded(game)`. No bespoke refetch wiring per component.
- R5. Existing visible behavior is preserved: 3-second polling cadence when waiting for opponents, polling halts on my turn or game completion, tab-focus and online-recovery refetch, exponential backoff on failure, error and stale states surfaced to UI. Action errors remain local to `GameBoard`, separate from fetch/sync errors.
- R6. The store shape supports the future websocket phase. A formal sequence-ordering rule is defined for the WS PR (see Key Technical Decisions §5).
- R7. Tests for game state are replaced by selector and slice tests *plus* explicit cross-layer behavioral parity tests on the route page, with equivalent visible-behavior coverage.
- R8. `npm run build`, `npx tsc --noEmit`, and `npm run lint` pass.

---

## Scope Boundaries

- Lobbies, lobby-game-start polling, and player search remain on their existing `useState` + hook pattern. They migrate in PR 2.
- Auth stays on `AuthContext`. It migrates (optionally) in PR 3.
- No event-sourcing reducer. The `Event[]` response from action endpoints is discarded in PR 1; `applyEvent` and `eventsReceived` are introduced when the WS transport lands.
- No `lastSequence` / sequence-ordering implementation in PR 1 (see Key Technical Decisions §5).
- No optimistic updates. The acting player still waits for the server response before the UI updates.
- No replacement of `lib/api/client.ts` or `lib/api/games.ts`. Thunks call the existing typed endpoint functions.
- `useSuggestions` is left alone in PR 1. Its single internal `myTurn` prop is sourced from a selector at the call site; full migration is deferred to PR 2.

### Deferred to Follow-Up Work

- Lobbies + players slices, replacement of `useLobbyGameStart` and route-local lobby `useState`: **PR 2**.
- Auth slice and conversion of `AuthContext` to a Redux-backed wrapper: **PR 3** (optional).
- Event reducers, websocket client, gap detection, and resync triggering: **WS PR**.
- **Backend prerequisite for WS PR:** server adds a sequence number to `Game` (and to event payloads) so the client can detect ordering and gaps. Flagged here so it surfaces in roadmap conversations before WS PR planning starts.

---

## Context & Research

### Relevant Code and Patterns

- `lib/hooks/use-game-state.ts` — current game-state hook; its derivations become selectors.
- `lib/hooks/use-polling.ts` — generic polling hook; the game-specific use is replaced by a thin polling controller in PR 1, but the file stays until PR 2 because `useLobbyGameStart` still depends on it.
- `lib/api/games.ts:performAction` — POSTs game actions and returns `ApiEvent[]`. **PR 1 discards the events** and re-fetches the game.
- `lib/api/games.ts:getGame` — the bootstrap and resync endpoint.
- `routes/games/$gameId.tsx` — route component that consumes game state; rewritten to use selectors and dispatch a thunk.
- `components/game/game-board.tsx` — currently calls `performAction` directly; rewritten to dispatch an action thunk.
- `main.tsx` — app entry point; receives the `<Provider store={store}>` wrapper.

### Institutional Learnings

- **"Adjust state during render" pattern** (`docs/solutions/best-practices/react-async-handler-memoization-and-prop-consistency-2026-04-21.md`): today's `lastGameKey` toggle in `lib/hooks/use-game-state.ts:74-79` exists to satisfy the project's ESLint rule against `setState` in `useEffect`. The new hook computes `enabled` as a pure derivation from selectors each render — no `setState` during render needed, so no `lastGameKey` workaround required.
- **Always `catch` in async handlers**: `try/finally` without `catch` causes unhandled rejections.
- **Memoize derived selectors**: use `createSelector` for selectors that return derived arrays/objects, otherwise components re-render on every store update.

### External References

- Redux Toolkit official guide: `createSlice`, `createAsyncThunk`, `extraReducers`, `configureStore`.
- React-Redux v9 hooks: `useSelector`, `useDispatch`. Use the typed wrappers per Redux Toolkit's TypeScript guide.

---

## Key Technical Decisions

1. **Thunks-only, no RTK Query in PR 1.** RTK Query's value (cache invalidation, mutation lifecycle, polling helpers) is exactly what we deliberately don't need given the WS-driven future. Adding it now creates a second source of truth for game state. PR 1 uses plain `createAsyncThunk` for `fetchGame`. RTK Query may be revisited if the API surface grows substantially.

2. **Action endpoint events are discarded in PR 1.** `performAction` returns `Event[]`, but PR 1 ignores it and re-fetches via a follow-up `getGame` call inside the same thunk. The deeper rationale: applying events client-side requires `applyEvent(game, event)` to faithfully reproduce backend mutations across all event types. Any divergence between client-side application and the canonical GET-returned shape becomes a silent bug. Re-fetching trades one HTTP request for guaranteed consistency, and defers `applyEvent` to when the WS PR makes it strictly necessary (and when backend event semantics are stable enough to mirror).

3. **Polling lives in a thin controller hook, not in the slice.** A `useGamePolling(gameId)` hook scoped to the route component that needs it. The hook calls `usePolling` internally and dispatches `fetchGame` thunks. The slice has no opinion on cadence. *Note: two simultaneous `useGamePolling(gameId)` calls (e.g., two components mounting the hook for the same id) would produce duplicate polling. This is acceptable in PR 1 because no route mounts the hook twice. Middleware-driven polling can be introduced later if cross-route observation becomes a need.*

4. **`gameLoaded` is the single write-path action for game data.** Both the polling controller and the action thunks dispatch it. The future WS PR's `eventsReceived` action plugs in next to it (see §5).

5. **Sequence ordering is a WS-PR concern; backend support is a prerequisite.** PR 1 does not implement `lastSequence` or any sequence-ordering check. When `eventsReceived` is added in the WS PR, two reducers will write to `byId[gameId]` with fundamentally different semantics — `gameLoaded` is snapshot-shaped (idempotent, "newer is what server returned"), `eventsReceived` is delta-shaped (order-dependent, "next-sequence required"). Without ordering rules, snapshots can clobber deltas and deltas can apply to stale snapshots. **Prerequisite for WS PR (added to backlog now):** the backend must include a monotonic sequence number on `Game` snapshots and on each event payload, so the client can compare them. The WS PR will then add `lastSequence: Record<string, number>` and reject out-of-order writes. Documenting the prerequisite in PR 1 surfaces it in roadmap conversations before WS PR planning.

6. **Action errors stay local to `GameBoard`; slice errors are fetch-only.** Two distinct error sources have two distinct meanings: poll/sync failures mean "your view of the world might be broken" (drives `selectIsStale`, drives the stale badge); action failures mean "your last command didn't take effect" (stays in `GameBoard`'s local `actionError` state, exactly as today). The slice's `errors` map is **never** written from action thunk failures. This preserves R5 (action failures don't trigger the stale badge) and matches today's division.

7. **`Record<string, Game>` indexing is kept** even though only one game is in view at a time. Defensive future-proofing for multi-game scenarios (recent-games sidebar, multi-tab, etc.); the marginal complexity is low and the structure aligns with PR 2's lobbies slice.

8. **`extraReducers` keyed on thunk lifecycle, not explicit loading actions.** `createAsyncThunk` provides `pending` / `fulfilled` / `rejected` action types automatically. The slice's `extraReducers` use those to manage loading state, eliminating the need for `gameLoadingStarted` / `gameLoadingFinished` actions. This also avoids the `loadingIds: string[]` duplicate-add bug that arises when a manual refresh fires concurrently with a background poll.

9. **Selectors are colocated with the slice in `store/games/selectors.ts`.** Memoized with `createSelector` where they return derived arrays/objects. Single-consumer selectors (`selectWinner`, `selectPhase`, `selectGameLoading`, `selectGameError`, `selectIsStale`) are inlined at their call sites rather than promoted to named selectors.

10. **Auth interop without migrating auth.** Components read `playerId` from `useAuth()` at the call site and pass it to thunks as a payload arg — `dispatch(fetchGame({ playerId, gameId }))`. PR 3 will introduce an auth slice; the thunk signature remains stable across that change (callers switch from `useAuth` to `useAppSelector(selectPlayerId)` without touching thunks).

11. **Concurrency dedup via `createAsyncThunk`'s `condition` option.** `performGameAction` uses `condition` keyed on `gameId` to prevent two concurrent action thunks for the same game (e.g., rapid double-clicks across mount/remount cycles). `GameBoard`'s local `actionInFlight` already prevents double-click within one mount; the thunk-level guard catches the cross-mount case.

12. **Feature-folder layout under `store/games/`.** Slice, thunks, and selectors colocate per domain. PR 2 adds `store/lobbies/`, PR 3 adds `store/auth/`. No `slices/` or `transports/` subdirectories — small SPA, three domains total.

---

## Open Questions

### Resolved During Planning

All major planning questions resolved. See Key Technical Decisions for: RTK Query vs thunks (§1), event handling in PR 1 (§2), polling timer placement (§3), error semantics (§6), state-shape choice (§7), auth interop (§10), concurrency dedup (§11), and directory layout (§12).

### Deferred to Implementation

- **Selector memoization granularity.** Whether selectors that look trivial (`selectActiveRound`) need `createSelector` depends on referential-equality observations during component wiring; resolve in U2/U3.
- **Whether `useSuggestions` becomes a no-op wrapper or stays as-is.** Currently takes `myTurn` as a prop. If migration to a selector is trivial during PR 1, do it; otherwise leave for PR 2.

---

## Output Structure

```
store/
├── index.ts              # configureStore, RootState, AppDispatch
├── hooks.ts              # typed useAppSelector, useAppDispatch
└── games/
    ├── slice.ts          # gamesSlice + extraReducers; exports gameLoaded action
    ├── thunks.ts         # fetchGame, performGameAction
    └── selectors.ts      # selectGameById, selectActiveRound, selectMyTurn, selectMyHand,
                          # selectCompletedRounds — only multi-consumer or memoized selectors
```

PR 2 will add `store/lobbies/{slice,thunks,selectors}.ts`. PR 3 will add `store/auth/`. The WS PR will add `store/ws-client.ts` at the top level.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```text
                       ┌─────────────────────────────────────┐
                       │           Redux Store               │
                       │                                     │
                       │   gamesSlice                        │
                       │   ├── byId: { [gameId]: Game }      │
                       │   ├── loading: { [id]: boolean }    │  ◄── managed by extraReducers
                       │   └── errors: { [id]: string|null } │  ◄── fetch/sync errors only
                       └────────────▲──────────▲─────────────┘
                                    │          │
                                    │          │ dispatched by extraReducers
              dispatch              │          │ (fetchGame.pending/fulfilled/rejected)
              ─────────             │          │
                                    │          │
   ┌────────────────────────────────┴──┐  ┌────┴─────────────────────────────┐
   │ Polling Controller                │  │ Action Thunk                     │
   │ useGamePolling(gameId)            │  │ store/games/thunks.ts            │
   │ - usePolling internally           │  │                                  │
   │ - fetcher dispatches fetchGame    │  │ performGameAction:               │
   │ - selectMyTurn / selectIsComplete │  │  1. POST performAction(...)      │
   │   from store control enabled flag │  │  2. Discard Event[] response     │
   └────────────────────▲──────────────┘  │  3. dispatch(fetchGame(...))     │
                        │                 │  4. Errors stay LOCAL in caller  │
                        │ uses            └──────────────▲───────────────────┘
                        │                                │
        ┌───────────────┴───────────────┐                │ dispatch(performGameAction({...}))
        │ routes/games/$gameId.tsx      │                │
        │ - useAppSelector(selectGame…) │────────────────┘
        │ - useGamePolling(gameId)      │
        │ - hands props to GameBoard    │
        └───────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │ components/game/game-board    │
        │ - useAppDispatch              │
        │ - actionError (local useState)│  ◄── action errors live HERE, not in slice
        │ - dispatches performGameAction│
        │ - no onActionComplete prop    │
        └───────────────────────────────┘
```

Key shape: **one slice write path** (`gameLoaded`, dispatched by `extraReducers` from `fetchGame.fulfilled`) and **two callers** (polling controller for stale data, action thunk via re-fetch). Action *errors* are deliberately not in the slice — they remain local to `GameBoard` so the stale badge only fires when the displayed game data may genuinely be stale. When WS lands, a third write path (`eventsReceived`) is added with explicit ordering rules; the backend prerequisite is documented in Scope Boundaries.

---

## Implementation Units

- U1. **Add Redux Toolkit, scaffold store, and create games slice**

**Goal:** Install Redux Toolkit and React-Redux, create the store with typed hooks, register the games slice with reducers and `extraReducers` skeletons, define selectors, and wire `<Provider>` into `main.tsx`. Combined unit because configureStore needs at least one real reducer to type cleanly, and the slice is the smallest reducer that earns its keep.

**Requirements:** R1, R6, R7, R8.

**Dependencies:** None.

**Files:**
- Modify: `package.json` (add `@reduxjs/toolkit`, `react-redux`)
- Modify: `package-lock.json`
- Create: `store/index.ts` (configureStore, RootState, AppDispatch)
- Create: `store/hooks.ts` (typed `useAppSelector`, `useAppDispatch`)
- Create: `store/games/slice.ts` (slice + extraReducers — extraReducers stub for fetchGame, filled in U2)
- Create: `store/games/selectors.ts` (selectors)
- Modify: `main.tsx` (wrap `<RouterProvider>` in `<Provider store={store}>`)
- Test: `store/games/__tests__/slice.test.ts`

**Approach:**
- State shape: `{ byId: Record<string, Game>, loading: Record<string, boolean>, errors: Record<string, string | null> }`. No `lastSequence` (Key Technical Decisions §5).
- Reducer: `gameLoaded(state, action: { gameId, game })` populates `byId` and clears `errors[gameId]`. **Note:** `gameLoaded` only fires from successful fetches (via `extraReducers` on `fetchGame.fulfilled` in U2), so clearing the error on success is correct — slice errors only represent fetch errors.
- `extraReducers` skeleton in this unit: stubs that will be filled when `fetchGame` lands in U2. The skeleton lets the slice compile.
- Selectors:
  - `selectGameById(state, gameId)` → `Game | undefined`
  - `selectActiveRound(state, gameId)` → `ActiveRound | null` (returns null when active is `WON`)
  - `selectCompletedRounds(state, gameId)` → `CompletedRound[]` (memoized)
  - `selectMyTurn(state, gameId, playerId)` → `boolean`
  - `selectMyHand(state, gameId, playerId)` → `Card[]` (memoized; falls back to `[]` when value is a number or missing)
  - Single-consumer derivations (`selectWinner`, `selectPhase`, `selectGameLoading`, `selectGameError`, `selectIsStale`) are **inlined at call sites in U5**, not exported here.
- `isActiveRound` type guard from `lib/hooks/use-game-state.ts:20-22` becomes a private helper inside the slice file.

**Patterns to follow:**
- Filename convention: kebab-case bare names without `.ts` extensions in import paths (matches `lib/api/client`, `lib/firebase`).
- Test fixtures in `lib/hooks/__tests__/use-game-state.test.ts:36-127` port directly. Once `useGameState` is deleted in U4, those fixtures live here.

**Test scenarios:**
- Happy path: `gameLoaded` populates `byId[gameId]` and clears `errors[gameId]`.
- Happy path: `selectMyTurn` returns true when `activePlayerId === playerId`, false otherwise (one combined test covering both branches).
- Edge case: `selectMyHand` returns the array when `hands[playerId]` is `Card[]`; returns `[]` when value is a number or missing (one combined test, three asserted branches).
- Edge case: `selectActiveRound` returns `null` when `game.active.status === 'WON'`.
- Edge case: selectors return safe defaults (`undefined` for game, `null` for activeRound, `[]` for hand/completedRounds) when `byId[gameId]` is undefined — don't throw.
- Memoization: `selectCompletedRounds` returns referentially-equal arrays across no-op state updates (asserts `createSelector` is wired correctly).

**Verification:**
- All slice tests pass.
- `npm run build`, `npx tsc --noEmit`, and `npm run lint` pass.
- App renders without errors (manual smoke check via `npm run dev`).

---

- U2. **Create `fetchGame` and `performGameAction` thunks**

**Goal:** Replace the `await performAction(...); await onActionComplete()` pattern with `createAsyncThunk` calls that POST and then re-fetch. Single generic thunk for actions; no per-action wrappers.

**Requirements:** R4, R5.

**Dependencies:** U1.

**Files:**
- Create: `store/games/thunks.ts` (thunks)
- Modify: `store/games/slice.ts` (fill in `extraReducers` for `fetchGame.pending` / `fulfilled` / `rejected`)
- Test: `store/games/__tests__/thunks.test.ts`

**Approach:**
- `fetchGame({ playerId, gameId })`: calls `getGame(playerId, gameId)`. Uses `createAsyncThunk` so the slice's `extraReducers` automatically: set `loading[gameId] = true` on pending, dispatch `gameLoaded` on fulfilled, set `errors[gameId] = message` on rejected. `loading[gameId] = false` is set in both fulfilled and rejected branches. **Errors stay in the slice for fetch failures only.**
- `performGameAction({ playerId, gameId, action })`: calls `performAction(playerId, gameId, action)`, **discards the `ApiEvent[]` return value**, then dispatches `fetchGame({ playerId, gameId })` and awaits its completion. Single thunk that all four action types use; call sites construct the typed `GameAction` payload directly:
  ```text
  dispatch(performGameAction({ playerId, gameId, action: { type: 'BID', amount: 25 } }))
  ```
- Concurrency dedup: `performGameAction` uses `createAsyncThunk`'s `condition` option keyed on `gameId` — if a `performGameAction` for the same gameId is already in flight, the second call is dropped. This is a safety net; `GameBoard`'s local `actionInFlight` is the primary guard.
- **Error handling for re-fetch failure (Adversarial Finding 1a):** if `performAction` succeeds but the follow-up `fetchGame` rejects, the action thunk *resolves successfully* (the user's action did succeed server-side). The fetch failure lands in the slice's `errors[gameId]` via `fetchGame.rejected`'s extraReducer; the polling controller will retry on its next tick. `GameBoard`'s `actionError` stays null because the action itself succeeded.
- **Action POST failure:** thunk rejects with the error message. **Action errors are NOT dispatched into the slice's `errors` map.** `GameBoard` catches the rejection and sets its local `actionError`, exactly as today.
- The thunks call `lib/api/games.ts` directly — do not move that file or change its signatures.

**Patterns to follow:**
- Mock `@/lib/api/games` in tests (see `lib/hooks/__tests__/use-game-state.test.ts:10-12` for the existing pattern).
- Thunk tests use `configureStore` with the games reducer to assert end-state. Mock the api functions; assert state after thunk completion.

**Test scenarios:**
- Happy path: `fetchGame` populates `byId[gameId]` via `gameLoaded` and sets `loading[gameId]` false.
- Happy path: `fetchGame` rejection sets `errors[gameId]` and clears `loading[gameId]`; `byId[gameId]` is preserved if previously loaded.
- Happy path: `performGameAction` calls `performAction` once and `getGame` once, in that order.
- Happy path: a successful `performGameAction` results in `byId[gameId]` reflecting the post-action game state from the re-fetch.
- Error path: `performGameAction` rejects when `performAction` throws; no `getGame` call is made; **the slice's `errors[gameId]` is unchanged** (action errors don't pollute slice errors).
- Error path: `performAction` succeeds but follow-up `getGame` rejects — `performGameAction` thunk **resolves successfully** (action completed); `errors[gameId]` is set by `fetchGame.rejected`. (Verifies Adversarial Finding 1a.)
- Concurrency: two concurrent `performGameAction` calls for the same gameId — only one network call to `performAction` is made (the second is dropped by `condition`). (Verifies Adversarial Finding 1b.)
- Concurrency: two concurrent `fetchGame` calls for the same gameId both resolve correctly (last-write-wins on `byId[gameId]`); `loading[gameId]` returns to false.
- Edge case: `performGameAction` for a different gameId does not affect other games' state.

**Verification:**
- All thunk tests pass.

---

- U3. **Create `useGamePolling` controller hook**

**Goal:** Replace the polling logic currently inside `useGameState` (`lib/hooks/use-game-state.ts:32-79`) with a thin hook that drives `fetchGame` based on selectors. This hook is the only PR 1 caller of `usePolling` for game data.

**Requirements:** R1, R5.

**Dependencies:** U2.

**Files:**
- Create: `lib/hooks/use-game-polling.ts`
- Test: `lib/hooks/__tests__/use-game-polling.test.ts`

**Approach:**
- Signature: `useGamePolling({ gameId, interval = 3000 }): { refetch: () => Promise<void> }`.
- Reads `playerId` from `useAuth()` and `myTurn` / `isCompleted` from selectors.
- Calls `usePolling` internally with:
  - `fetcher: () => dispatch(fetchGame({ playerId, gameId })).unwrap()`
  - `enabled: !!playerId && !myTurn && !isCompleted`
  - `interval`
- Returns `refetch` for manual refresh. Manual refresh fires `fetchGame` directly even when `enabled` is false (today's `refetch()` behavior preserved).
- No `lastGameKey` workaround needed — `enabled` is a pure derivation each render, no `setState` during render. Cleaner than today.
- Memoize the `fetcher` with `useCallback` keyed on `[playerId, gameId, dispatch]`.
- Returns no game data — components read game state from selectors directly.

**Patterns to follow:**
- `lib/hooks/use-lobby-game-start.ts` is the closest existing pattern.

**Test scenarios:**
- Happy path: hook calls `usePolling` with a fetcher, the configured interval, and `enabled: true` when authenticated and not on my turn.
- Happy path: when the store reports `myTurn === true`, `enabled` flips to `false` (port from `use-game-state.test.ts:371-387`).
- Happy path: when the store reports `isCompleted === true`, `enabled` flips to `false`.
- Edge case: when `playerId` is empty (unauthenticated), `enabled` is `false` and no fetch occurs (port from `use-game-state.test.ts:407-423`).
- Happy path: `refetch` triggers an immediate `fetchGame` dispatch even when `enabled` is `false` (manual refresh while paused on my turn).
- StrictMode: hook rendered under React 19 Strict Mode causes at most one in-flight `fetchGame` thunk persisting after the double-mount; no leaked entries in `loading` map. (Verifies Adversarial Finding 8.)

**Verification:**
- All hook tests pass.
- Existing `usePolling` tests in `lib/hooks/__tests__/use-polling.test.ts` continue to pass unchanged.

---

- U4. **Migrate route + GameBoard, delete `useGameState`, port behavioral parity tests**

**Goal:** Replace `useGameState` with `useGamePolling` + selectors in the route. Replace `performAction` + `onActionComplete` with `dispatch(performGameAction(...))` in `GameBoard`. Delete `useGameState` and its tests. Port the existing test suite as cross-layer behavioral parity tests on the route page.

**Requirements:** R1, R2, R3, R5, R7.

**Dependencies:** U3.

**Files:**
- Modify: `routes/games/$gameId.tsx`
- Modify: `components/game/game-board.tsx`
- Modify: `routes/games/__tests__/game-page.test.tsx` (expanded with behavioral parity tests)
- Modify: `lib/hooks/use-suggestions.ts` (no signature change; callers source `myTurn` from selector — see Approach)
- Delete: `lib/hooks/use-game-state.ts`
- Delete: `lib/hooks/__tests__/use-game-state.test.ts`

**Approach:**
- `routes/games/$gameId.tsx`:
  - Remove import of `useGameState`.
  - `useGamePolling({ gameId, interval: 3000 })` for polling lifecycle and `refetch`.
  - Read game data via `useAppSelector(s => selectGameById(s, gameId))` and the multi-consumer selectors. Inline the single-consumer derivations:
    - `winner`: `game?.active.status === 'WON' ? { id: game.active.winnerPlayerId, type: 'human' } : null`
    - `phase`: `activeRound?.status ?? null`
    - `isCompleted`: `game?.active.status === 'WON'`
    - `loading`: `useAppSelector(s => s.games.loading[gameId] ?? false)`
    - `error`: `useAppSelector(s => s.games.errors[gameId] ?? null)`
    - `isStale`: `error !== null && game !== undefined`
  - Use `playerId` from `useAuth()` for the selectors that need it.
  - Keep `playerNames` Map and `isRefreshing` as local `useState` — per-component UI state, not server state.
  - Drop the `onActionComplete` prop from the `<GameBoard>` invocation.
- `components/game/game-board.tsx`:
  - Remove `onActionComplete` from `GameBoardProps`.
  - Replace `await performAction(...); await onActionComplete()` with `await dispatch(performGameAction({ playerId, gameId, action })).unwrap()`.
  - Keep `actionInFlight` and `actionError` as local `useState` — per-component UI state, action errors stay local (Key Technical Decisions §6).
  - Read `myTurn`, `isStale`, `hand`, `winner`, `isCompleted`, `activeRound` from props passed by the route.
- `lib/hooks/use-suggestions.ts`: signature unchanged. The route component passes `myTurn` from `useAppSelector(selectMyTurn(...))` instead of from `useGameState`. *Note: this introduces a minor timing change — `myTurn` may now re-render on auth state changes that today were insulated by `useGameState`. Side effect is at most one extra idempotent `getSuggestions` call during auth token refresh. Documented; not addressed.* (Adversarial Finding 7.)
- Test file expansion: port the assertions in `lib/hooks/__tests__/use-game-state.test.ts` as **route-level cross-layer parity tests** in `routes/games/__tests__/game-page.test.tsx`. Wrap rendered component in `<Provider store={...}>`, mock `@/lib/api/games`. Each parity test asserts visible behavior end-to-end (auth → polling → thunk → slice → selector → UI re-render). This is the only place the full pipeline is exercised; without it, the per-layer unit tests would not catch a regression that crosses layers.

**Patterns to follow:**
- Existing `routes/games/__tests__/game-page.test.tsx` for current test patterns.
- Build a small `renderWithStore` helper for the test file.

**Test scenarios:**
- Happy path: rendering the game page with a loaded game shows the score board, game board, and round history.
- Happy path: clicking a bid button dispatches `performGameAction` and the resulting re-fetch updates the displayed bid.
- Happy path: the manual refresh button triggers `refetch` and re-renders with new data.
- Happy path: navigating away from the page stops polling (cleanup runs; no further `getGame` calls).
- Edge case: an in-flight action shows the loading state on the action button.
- Error path: a failing action shows `actionError` in `GameBoard` and **does NOT trigger the stale badge** (verifies Key Technical Decisions §6 — action errors stay local; Adversarial Finding 4).
- Error path: a failing fetch shows the stale badge but no action error message (verifies the inverse — fetch errors don't leak into action error UI).
- Error path: `performAction` succeeds but the re-fetch fails — the action button clears (action succeeded), the stale badge appears (re-fetch failed), and `actionError` is null (verifies Adversarial Finding 1a).
- Concurrency: rapid double-click on a bid button results in one `performAction` call to the network, not two.
- Behavioral parity (ported from `use-game-state.test.ts`): myTurn flip → polling halts; isCompleted → polling halts; unauthenticated → no polling; activeRound null when WON; correct hand extraction across array/number/missing cases. Each as a route-level test asserting visible behavior, not internal state.
- Integration: dispatching `performGameAction` does not cause the polling controller to fire an extra fetch (the thunk's internal re-fetch is the only fetch).

**Verification:**
- All route tests pass, including ported parity tests.
- `grep -r "useGameState" --include="*.ts" --include="*.tsx"` returns zero results.
- `grep -r "use-game-state" --include="*.ts" --include="*.tsx"` returns zero results.
- `npm run build`, `npx tsc --noEmit`, and `npm run lint` pass.
- Full test suite passes: `npm run test`.
- Manual smoke check: full game flow (bid → trump → discard → trick) works end-to-end.

---

## System-Wide Impact

- **Interaction graph:** Action dispatches and polling fan into one place (the games slice via `extraReducers`). The polling controller observes selector state and self-disables on `myTurn` / `isCompleted` flips. Future WS messages plug in next to action thunks.
- **Error propagation:** Two distinct channels by design. Action failures stay local to `GameBoard` (`actionError`). Polling/fetch failures land on the slice and surface via `selectIsStale`. The two channels never interfere — this matches today's behavior.
- **Unchanged invariants:** `lib/api/client.ts`, `lib/api/games.ts`, `lib/firebase.ts`, `components/auth/*`, all lobby code, all routes other than `routes/games/$gameId.tsx`, and `lib/hooks/use-polling.ts` remain untouched.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Selector re-render storms if memoization is missed. | `createSelector` for derived array/object selectors; U1 test asserts `selectCompletedRounds` referential identity stability across no-op state updates. |
| Two state-management patterns coexist between PR 1 and PR 2 (Redux for games, useState for lobbies). | Acceptable for one merge cycle. If PR 2 stalls more than ~2 weeks, prioritize PR 2 as blocking work; do not regress PR 1. New game-adjacent state goes in Redux from PR 1's merge forward; new lobby-adjacent state continues in `useState` until PR 2. |
| WS PR encounters ordering bugs not visible in PR 1. | Sequence-ordering rule documented in Key Technical Decisions §5; backend prerequisite (sequence numbers on `Game` and events) flagged in Scope Boundaries → Deferred to Follow-Up Work to surface in roadmap. |

---

## Documentation / Operational Notes

- Update `AGENTS.md` to add `store/` to Project Structure (one-line entry: `store/` for Redux slices, thunks, selectors, and typed hooks). Do this in U1 or U4.
- After merge, PR 2 mirrors the PR 1 conventions: feature folder per domain (`store/lobbies/`), thunks-only, selectors colocated, polling controller hook per route that needs polling.

---

## Sources & References

- **Origin document:** `docs/brainstorms/state-management-redux-toolkit-requirements.md`
- Related code: `lib/hooks/use-game-state.ts` (replaced), `lib/hooks/use-polling.ts` (kept until PR 2).
- Recent related plans: `docs/plans/2026-04-25-001-feat-lobby-game-start-redirect-plan.md` — established the `useLobbyGameStart` polling pattern this PR's polling controller is modeled after.
- Related learnings: `docs/solutions/best-practices/react-async-handler-memoization-and-prop-consistency-2026-04-21.md` — the "adjust state during render" pattern is no longer needed in the new hook because `enabled` is a pure derivation.
