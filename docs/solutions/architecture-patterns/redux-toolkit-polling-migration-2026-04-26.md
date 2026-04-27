---
title: Redux Toolkit Migration from Custom Polling Hooks in a React SPA
date: 2026-04-26
category: docs/solutions/architecture-patterns
module: store/games
problem_type: architecture_pattern
component: tooling
severity: high
applies_when: >
  Migrating custom polling hooks to Redux Toolkit in a React SPA where a future
  WebSocket architecture will invert cache-invalidation responsibilities — making
  RTK Query a poor fit — and where action errors must be distinguished from
  fetch/sync errors to preserve accurate UI staleness signals.
tags:
  - redux-toolkit
  - state-management
  - react
  - typescript
  - polling
  - migration
  - error-handling
  - thunks
---

# Redux Toolkit Migration from Custom Polling Hooks in a React SPA

## Context

`hundred-and-ten-web` had game state scattered across three custom hooks (`useGameState`, `usePolling`, route-local `useState`) with `onActionComplete: refetch` prop-drilled from route down to leaf components. There was no single seam for a future websocket transport. This document captures the architectural decisions made during PR 1 of a 3-PR Redux Toolkit migration, including the sharp edges found by code review and why several seemingly obvious approaches were rejected.

The future architecture is **websocket-driven event-sourcing**: WS pushes state deltas; polling is only a bootstrap and fallback. This shapes every decision below — particularly the choice against RTK Query.

---

## Guidance

### 1. Thunks-only — skip RTK Query when your transport is websocket-bound

RTK Query's value (cache invalidation, mutation lifecycle, background refetching) maps cleanly to a REST-cache world. If the production target is websocket-driven event-sourcing, RTK Query creates a double source of truth: the RTK Query cache and the WS event stream will fight over ownership of the same data. Use plain `createAsyncThunk` for fetch and action thunks; the polling phase and the WS phase share the same `fetchGame.fulfilled` write path with no architecture change required.

RTK Query was explicitly evaluated and rejected during planning; TanStack Query and Zustand were also considered. Redux Toolkit with plain thunks was chosen because Redux DevTools are genuinely valuable for debugging an event stream ("what did the WS deliver and in what order?"), and the thunk-only model composes cleanly with the planned `eventsReceived` reducer in a later WS PR.

### 2. Separate error channels: fetch errors vs. action errors

Keep two distinct error surfaces:

- `errors[gameId]` in the Redux slice — written **only** by `fetchGame.rejected`. Signals "data may be stale."
- `actionError` in component-local state — written only by action thunk catch paths. Signals "your command failed."

Action thunks must **never** dispatch into the slice's error channel. If they do:
1. A failed bid (action failure, data is fresh) triggers the stale-data badge — misleading, the data is not stale
2. The next successful poll dispatches `fetchGame.fulfilled`, which clears `errors[gameId]` — silently clobbering the action failure message while the user may still be reading it

The separation is also architecturally load-bearing: when the WS transport arrives, the action error channel stays component-local (command acknowledgement UX), and the fetch/sync channel becomes the WS disconnect/resync indicator — without any refactor. (session history)

### 3. Put dedup state in Redux, not a module-level Set

A module-level `Set<string>` for action deduplication persists across Vitest test runs in the same worker (module is cached; `vi.clearAllMocks()` doesn't re-execute module initializers). Tests that run sequentially in the same worker see leftover entries and get spurious `ConditionError` cancellations that look like logic bugs.

Use `actionInFlight: Record<string, boolean>` in the slice, managed by `performGameAction.pending/fulfilled/rejected` extraReducers. It resets cleanly between test runs, is visible in Redux DevTools, and can be inspected by selectors or the `condition` callback.

The module-level `Set` was the initial implementation (session history); code review caught it.

### 4. Place type guards beside the types they guard

Pure domain predicates (`isActiveRound`, `isWonGame`) belong in `lib/api/types.ts` alongside the union types they narrow. Putting them in `store/games/slice.ts` — even with a re-export — creates a misleading dependency: selectors and route components would import from the store to get a predicate that has no Redux knowledge requirement. It also means the stale comment referencing a deleted file (`lib/hooks/use-game-state.ts`) silently persists.

See also: `docs/solutions/integration-issues/spike-game-openapi-breaking-change-2026-04-25.md` — same convention applied at the API layer.

### 5. Guard the loading spinner with `!game`, not just `loading`

`fetchGame.pending` fires on every poll cycle (every 3 seconds), setting `loading[gameId] = true`. Without checking whether game data is already in state, a full-page spinner replaces live game content on every poll.

The old `usePolling` initialized its internal `loading` state to `true` only once (on first mount with `enabled=true`). Redux `createAsyncThunk` fires `pending` on every dispatch — a different semantics.

### 6. Include `hasError` in the polling-enabled condition

After an action succeeds but the subsequent re-fetch fails: `performAction` resolved, `fetchGame` rejected. The cached snapshot still has `myTurn = true` (the old game state). Without `hasError` in the enabled condition, polling evaluates `!myTurn = false` and disables itself permanently — no self-recovery, no error message, the game silently freezes.

Adding `hasError` forces polling back on when there's a sync error, regardless of what the stale snapshot says about `myTurn`.

### 7. Catch `ConditionError` explicitly, not just `instanceof Error`

When RTK's `condition` option cancels a dispatched thunk (dedup fires), **no actions are dispatched to the store** (no `pending`, no `rejected` extraReducers run). However, calling `.unwrap()` on the returned promise still throws — it re-throws the serialized `ConditionError` object: `{ name: 'ConditionError', message: 'Aborted due to condition callback returning false.' }`. This is a plain object, not an `Error` instance (`instanceof Error` is `false`). Without an explicit guard, the UI shows "Action failed" when nothing actually failed.

### 8. Delete dead "future use" exports

A `gameLoaded` action exported as "for future WS use" with the same mutations as `fetchGame.fulfilled`'s extraReducer duplicated inline is a maintainability trap: two write paths that must stay in sync, and a misleading public API. Remove it; add it back when the WS transport actually exists and needs it. The comment "TODO(ws-pr)" in the source is sufficient for intent. (session history)

### 9. Use `TypedUseSelectorHook` for `useAppSelector`

A hand-written selector wrapper `<T>(selector: (state: RootState) => T): T => useSelector(selector)` drops the `equalityFn` overload. Callers who need shallow-equal comparison must fall back to the untyped `useSelector`. Use the RTK-recommended pattern instead.

---

## Why This Matters

**Error channel separation** is the highest-impact decision. Conflating fetch errors and action errors produces misleading UI (stale badge fires on a failed bid) and a silent clobber bug (the next poll erases the action error). The separation is also the load-bearing seam for the WS migration: command acknowledgement stays local; sync state lives in the store; no refactor needed when WS arrives.

**Module-level Set dedup** is the sharpest test-isolation hazard. It fails silently: tests pass locally when run in isolation, fail in CI when run in suite order, and the failure looks like a logic bug rather than a module-caching issue.

**The `!game` loading guard** is the most common first-implementation mistake with RTK polling. It causes a visible regression (spinner every three seconds) that is obvious in manual testing but easy to miss in unit tests that don't simulate poll cycles.

**`hasError` in the enabled condition** is a correctness issue that only surfaces in a specific failure sequence (action success → re-fetch failure). Without it the game silently stops updating with no user-visible error after that sequence. This sequence is hard to cover in standard unit tests.

---

## When to Apply

- Any Redux Toolkit migration in a SPA that currently uses custom polling hooks
- Any slice that manages both background-sync state and user-action state for the same entity
- Any thunk that uses RTK's `condition` option for deduplication
- Any migration where the future transport is websocket/event-sourcing rather than REST polling
- When adding background-fetch infrastructure to a Redux slice

---

## Examples

### Error channel separation — action thunk must not dispatch fetch-error action

```ts
// WRONG: action failure taints the fetch-error channel
export const performGameAction = createAsyncThunk(
  'games/performAction',
  async ({ gameId, action }, { dispatch, rejectWithValue }) => {
    try {
      await api.postAction(gameId, action);
      await dispatch(fetchGame({ gameId }));
    } catch (err) {
      dispatch(gameError({ gameId, error: String(err) })); // ← wrong channel
      return rejectWithValue(err);
    }
  }
);

// CORRECT: action failure stays local; only fetchGame.rejected writes slice errors
export const performGameAction = createAsyncThunk(
  'games/performAction',
  async ({ gameId, action }, { dispatch, rejectWithValue }) => {
    try {
      await api.postAction(gameId, action);
      await dispatch(fetchGame({ gameId }));
    } catch (err) {
      return rejectWithValue(err); // component catches this, sets local actionError
    }
  }
);
```

### Module-level Set vs. Redux state for dedup

```ts
// WRONG: persists across Vitest test runs in the same worker
const inFlight = new Set<string>();
export const performGameAction = createAsyncThunk(
  'games/performAction',
  async ({ gameId }, { rejectWithValue }) => {
    if (inFlight.has(gameId)) return rejectWithValue('in flight');
    inFlight.add(gameId);
    try { /* ... */ } finally { inFlight.delete(gameId); }
  }
);

// CORRECT: slice state — resets per store instance, visible in DevTools
// In slice extraReducers:
builder
  .addCase(performGameAction.pending, (s, a) => {
    s.actionInFlight[a.meta.arg.gameId] = true;
  })
  .addCase(performGameAction.fulfilled, (s, a) => {
    s.actionInFlight[a.meta.arg.gameId] = false;
  })
  .addCase(performGameAction.rejected, (s, a) => {
    s.actionInFlight[a.meta.arg.gameId] = false;
  });

// In thunk, use RTK's condition option.
// { state: RootState } as the third type arg is required — without it,
// getState() returns unknown and getState().games is a type error.
export const performGameAction = createAsyncThunk<
  void,
  { gameId: string; action: GameAction },
  { state: RootState }
>(
  'games/performAction',
  async ({ gameId, action }, { dispatch }) => { /* ... */ },
  {
    condition: ({ gameId }, { getState }) =>
      !getState().games.actionInFlight[gameId],
  }
);
```

### Loading guard — spinner on every poll vs. first load only

```tsx
// WRONG: spinner fires every 3s poll
if (loading) return <FullPageSpinner />;

// CORRECT: spinner only on initial load (no data yet)
if (loading && !game) return <FullPageSpinner />;
```

### Polling enabled condition — with self-recovery after failed re-fetch

```ts
// WRONG: permanently disabled after action-success + fetch-failure sequence
const enabled = !!playerId && !myTurn && !isCompleted;

// CORRECT: hasError forces polling back on so the client self-recovers
const myTurn   = useAppSelector(s => selectMyTurn(s, gameId, playerId)); // from selector
const hasError = useAppSelector(s => (s.games.errors[gameId] ?? null) !== null);
const enabled  = !!playerId && (!myTurn || hasError) && !isCompleted;
```

### Catching ConditionError from RTK dedup

```ts
try {
  await dispatch(performGameAction({ gameId, action })).unwrap();
} catch (err) {
  // RTK doesn't export a ConditionError class; object inspection is the only option.
  // .unwrap() re-throws action.error (serialized via miniSerializeError), which preserves name.
  if (err && typeof err === 'object' && (err as { name?: string }).name === 'ConditionError') {
    return; // dedup fired, not a real failure
  }
  setActionError(err instanceof Error ? err.message : typeof err === 'string' ? err : 'Action failed');
}
```

### Type guard placement

```ts
// WRONG: pure domain predicate inside the Redux slice
// store/games/slice.ts
export function isActiveRound(active: ActiveGameState): active is ActiveRound {
  return active.status !== 'WON';
}

// CORRECT: lives in lib/api/types.ts beside the union it narrows
// lib/api/types.ts
export type ActiveGameState = ActiveRound | WonInformation;

export function isActiveRound(active: ActiveGameState): active is ActiveRound {
  return active.status !== 'WON';
}
```

### `TypedUseSelectorHook` — preserve the equality-function overload

```ts
// WRONG: drops equalityFn overload
export const useAppSelector = <T>(selector: (state: RootState) => T): T =>
  useSelector(selector);

// CORRECT: delegate fully, all overloads preserved
import { useSelector, type TypedUseSelectorHook } from 'react-redux';
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

### Feature-folder layout

```
store/
├── index.ts              # configureStore, RootState, AppDispatch
├── hooks.ts              # useAppSelector, useAppDispatch
└── games/
    ├── slice.ts          # GamesState, extraReducers
    ├── selectors.ts      # selectGameById, selectActiveRound, etc.
    └── thunks.ts         # fetchGame, performGameAction
```

PR 2 adds `store/lobbies/`, PR 3 adds `store/auth/`. Not a `slices/` + `transports/` split (those are horizontal layers; feature folders co-locate related concerns).

---

## Related

- `docs/solutions/best-practices/react-async-handler-memoization-and-prop-consistency-2026-04-21.md` — the hook-layer version of stuck loading state; `actionInFlight` / `hasError` are the Redux-slice analogs of the `isRefreshing` stuck-state risk documented there. Also: the ESLint `setState`-in-`useEffect` constraint documented there explains why the old `useGameState` needed the `lastGameKey` workaround — the new `useGamePolling` avoids it entirely by reading from selectors.
- `docs/solutions/integration-issues/spike-game-openapi-breaking-change-2026-04-25.md` — prevention rule 3 ("write one named type guard per branch") is the API-migration origin of the same "type guards in `lib/api/types.ts`" convention applied here at the Redux layer.
- PR 25: `refactor/redux-toolkit-games-slice` — the implementation this document describes
