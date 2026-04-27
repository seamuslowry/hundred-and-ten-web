---
title: "refactor: Migrate lobbies and players state to Redux Toolkit (PR 2 of 3)"
type: refactor
status: completed
date: 2026-04-26
deepened: 2026-04-26
origin: docs/brainstorms/state-management-redux-toolkit-requirements.md
---

# refactor: Migrate lobbies and players state to Redux Toolkit (PR 2 of 3)

## Overview

PR 2 of a 3-PR Redux Toolkit migration. Extends PR 1's patterns to two more domains (**lobbies** and **players**), removes route-local `useState` for server data in the lobby routes, and deletes orphan suggestion code discovered during planning.

After PR 2, only auth state remains outside Redux. PR 3 (auth) is optional.

A late-stage simplification during the deepening pass restructured this PR significantly: instead of a new `useLobbyPolling` hook + `pollLobbyGameStart` thunk + lobby-side `gameStarted` flag, the lobby detail route **reuses `useGamePolling` directly** with `gameId: lobbyId`. The organizer's `startGame` action and the non-organizer's polling detection both converge on `selectGameById(state, lobbyId) !== undefined` as the navigation signal. Achieving this requires a single behavior change to `usePolling`: removing exponential backoff (404 on a not-yet-started game shouldn't slow polling to 30s intervals).

---

## Problem Frame

After PR 1, game state is in Redux but lobby and player state is still scattered:

- `routes/lobbies/index.tsx` keeps `lobbies`, `loading`, `error` as separate `useState`s; fetches once on mount via `useEffect`
- `routes/lobbies/$lobbyId.tsx` keeps `lobby`, `playerDetails`, `loading`, `error`, `actionLoading` as `useState`s; uses `useLobbyGameStart` for game-start polling; has duplicate fetch logic in two places (`fetchLobby` callback + initial-load effect)
- `routes/lobbies/new.tsx` keeps `submitting`, `error` local to the form (action-style state, fine to keep local)
- `components/lobby/player-search.tsx` keeps `query`, `results`, `loading`, `inviting` as `useState`s; debounced 300ms search-as-you-type
- `lib/hooks/use-lobby-game-start.ts` polls `getGame` every 5s with 404 → "not started" handling

The migration also surfaces **dead code**: `useSuggestions`, `SuggestionToggle`, `getSuggestions`, and the `Suggestion` type have zero consumers anywhere in the codebase.

(see origin: `docs/brainstorms/state-management-redux-toolkit-requirements.md`)

---

## Requirements Trace

- R1. Lobby and player state owned by Redux store; route components read via selectors
- R2. `useLobbyGameStart` is removed by end of PR 2. `usePolling` is **retained and modified** (exponential backoff removed) as a shared primitive consumed by `useGamePolling` (from PR 1) and by the lobby detail route.
- R3. Lobby routes (`routes/lobbies/index.tsx`, `routes/lobbies/$lobbyId.tsx`) read lobby and player data exclusively from selectors; no `useState` for server-fetched data
- R4. Lobby actions (`createLobbyThunk`, `joinLobby`, `invitePlayer`, `startGame`) flow through thunks; no direct API imports in route components. `startGame` dispatches `fetchGame` after the action so the resulting Game lands in the games slice — same pattern as `performGameAction` in PR 1.
- R5. Existing visible behavior preserved: lobby list one-time fetch, lobby detail polling cadence (5s for game-start), player search debounce (300ms), navigation flows (create → detail, start game → game page, organizer invite → refresh)
- R6. Action errors stay local to components (origin component for the action); slice errors are exclusively for fetch/sync failures (mirrors PR 1's error-channel separation)
- R7. Dead suggestion code (`useSuggestions`, `SuggestionToggle`, `getSuggestions`, `Suggestion` type) is deleted
- R8. New route tests added at `routes/lobbies/__tests__/` (`lobby-detail.test.tsx` and `lobby-list.test.tsx`) mirroring the cross-layer behavioral parity pattern from PR 1's `routes/games/__tests__/game-page.test.tsx`. PlayerSearch coverage flows through the lobby-detail integration test.
- R9. `npm run build`, `npx tsc --noEmit`, and `npm run lint` pass
- R10. **`usePolling` no longer applies exponential backoff.** Always polls at the configured `interval`, regardless of success or failure outcome. The `failureCount`/`MAX_BACKOFF` mechanism is removed. Server-overload protection comes from each consumer's chosen interval (3s game, 5s lobby) plus the existing visibility/online refetch handlers.

---

## Scope Boundaries

- Auth stays on `AuthContext`. It migrates (optionally) in PR 3.
- No event-sourcing reducers, no `lastSequence` field on lobbies/players. The WS PR will add ordering rules; players are profile cache (no WS needed); lobbies don't currently emit incremental events.
- No optimistic updates. Action thunks POST then dispatch the resulting state.
- No replacement of `lib/api/client.ts`, `lib/api/lobbies.ts`, or `lib/api/players.ts`. Thunks call the existing typed endpoint functions.
- No backend changes. No new endpoints. No env var changes.
- No polling added to the lobby list (`routes/lobbies/index.tsx`) — preserves today's one-time fetch.
- Form-local UI state (`submitting`, `error` in `new.tsx`; `query`, `inviting` in `player-search.tsx`) stays as local `useState` — these are per-component UI state, same rule as `actionInFlight` in PR 1.
- **No new lobby-specific polling hook.** The lobby detail route uses `useGamePolling` directly with `gameId: lobbyId`. (Earlier draft of this plan introduced `useLobbyPolling` + `useLobbyDetail`; the deepening pass collapsed both.)
- **No `pollLobbyGameStart` thunk.** The lobby route polls via `fetchGame` (the PR 1 thunk). 404 rejections sit in `errors[lobbyId]` invisibly until `fetchGame.fulfilled` clears them when the game appears.

### Deferred for later

(Carried from origin — product/version sequencing.)

- **Websocket transport.** Separate brainstorm/plan. Will introduce `applyEvent`, `eventsReceived` reducer, `ws-client.ts`, plus reconnection, gap detection, and resync triggering.
- **Optimistic updates.** Not needed; action endpoints are synchronous and the re-fetch closes the loop.
- **Server-side rendering or persistence.** Pure SPA, in-memory store.

### Outside this product's identity

(Carried from origin — positioning rejection.)

- **Multi-game state machines beyond Hundred and Ten.** The lobbies/players slices are shaped for this game's flow.
- **Replay / time-travel as a user-facing feature.** Devtools time-travel is for developers only.

### Deferred to Follow-Up Work

- **Auth slice (PR 3, optional).** Not blocking PR 2's value; can land later or never.

---

## Context & Research

### Relevant Code and Patterns

**PR 1 patterns to mirror exactly** (the conventions are now established):

- `store/games/slice.ts` — slice shape with `byId`, `loading`, `actionInFlight` (where applicable), `errors`; `extraReducers` keyed on thunk lifecycle
- `store/games/selectors.ts` — multi-consumer or memoized selectors only; single-consumer derivations inline at call sites
- `store/games/thunks.ts` — `createAsyncThunk` with `{ state: RootState }` type param; `condition` callback reads from slice state for dedup; action thunks `rejectWithValue(message)` and never write to slice errors. **`startGame` will follow the `performGameAction` model: POST + dispatch `fetchGame` after.**
- `lib/hooks/use-game-polling.ts` — thin polling controller hook. **Reused as-is for lobby polling** (with `gameId: lobbyId, interval: 5000`).
- `routes/games/$gameId.tsx` — selectors at top of component; inlined single-consumer derivations; one-time fetch via `useEffect` (the `getGamePlayers` call) alongside polling; `loading && !game` guard. **Direct model for `routes/lobbies/$lobbyId.tsx`** — including the inline composition pattern.
- `components/game/game-board.tsx` — local `actionInFlight` and `actionError`; `ConditionError` guard in catch block
- `routes/games/__tests__/game-page.test.tsx` — `renderWithStore` helper; cross-layer behavioral parity tests; mocked api + auth + router

**PR 2 specific code under migration:**

- `routes/lobbies/index.tsx`, `routes/lobbies/$lobbyId.tsx`, `routes/lobbies/new.tsx`
- `components/lobby/player-search.tsx`, `components/lobby/member-list.tsx`, `components/lobby/lobby-card.tsx` (the latter two are pure presentational; left untouched except for prop sourcing)
- `lib/hooks/use-lobby-game-start.ts` — replaced; route uses `useGamePolling` directly
- `lib/hooks/use-polling.ts` — modified to remove exponential backoff (R10)
- `lib/api/lobbies.ts`, `lib/api/players.ts` — unchanged
- `lib/api/games.ts:getGame` — unchanged; called from `fetchGame` (PR 1 thunk) which is now also the lobby polling fetcher
- `store/games/thunks.ts:startGame` (NEW location) — moves out of `lib/api/lobbies.ts:startGame` API call; the API call stays where it is, but a thunk wrapper joins it. Or: the `startGame` thunk lives in `store/lobbies/thunks.ts` because it's a lobby-context action that happens to start a game (organizationally cleaner). **Decision: lives in `store/lobbies/thunks.ts`** (see §12).

**Dead code to delete in U6** (zero consumers, found during planning):

- `lib/hooks/use-suggestions.ts`
- `components/game/suggestion-toggle.tsx`
- `lib/api/games.ts:getSuggestions`
- `lib/api/types.ts:Suggestion` type

### Institutional Learnings

- `docs/solutions/architecture-patterns/redux-toolkit-polling-migration-2026-04-26.md` — the patterns this PR continues. All 9 guidance points apply.
- `docs/solutions/best-practices/react-async-handler-memoization-and-prop-consistency-2026-04-21.md` — `try/catch/finally` discipline; `useCallback` for stable references.

### External References

None. The codebase has fresh, well-tested Redux patterns from PR 1.

---

## Key Technical Decisions

1. **Mirror PR 1's feature-folder layout.** `store/lobbies/{slice,thunks,selectors}.ts` and `store/players/{slice,selectors}.ts` (no thunks file for players — see §6).

2. **`useSuggestions`, `SuggestionToggle`, `getSuggestions`, `Suggestion` type are deleted as dead code.** Audit during planning confirmed zero consumers.

3. **Lobby list keeps one-time fetch behavior.** `routes/lobbies/index.tsx` calls a `fetchLobbiesList` thunk on mount; no polling.

4. **Lobby polling reuses `useGamePolling` directly.** The route calls `useGamePolling({ gameId: lobbyId, interval: 5000 })`. The poll dispatches `fetchGame({ playerId, gameId: lobbyId })`. While the game doesn't exist (404), the thunk rejects and `errors[lobbyId]` is set in the games slice. The lobby route doesn't read this — it watches `selectGameById(state, lobbyId)` for definedness. When the game starts and a poll succeeds, `fetchGame.fulfilled` populates `byId[lobbyId]` and clears `errors[lobbyId]`. The route's `useEffect` detects the new game and navigates.

5. **`usePolling` exponential backoff removed (R10).** Today's `usePolling` increments `failureCount` on rejection and applies `Math.min(interval * Math.pow(2, failureCount), 30000)` as the next delay. After ~5 minutes of polling a 404, the cadence slows to 30s — unacceptable for "waiting for game to start" UX. Replace with: always use `interval` between polls, regardless of outcome. Remove `failureCount`, `MAX_BACKOFF`. Server-overload protection during real outages comes from (a) each consumer's chosen interval (3s game, 5s lobby), (b) the existing visibility/online refetch only firing on tab-focus or network-recovery (not continuously), and (c) the practical reality that this app's polling load is tiny.

6. **Players slice is a thin profile cache, no thunks of its own.** Players are populated by lobby thunks dispatching `playersUpserted({ players })` after fulfillment. The `searchPlayersThunk` lives in `store/lobbies/thunks.ts` (it's a lobby-context invitation flow). The players slice exposes `playersUpserted` action, `selectPlayerById` selector, and `selectPlayersByIds` (memoized) selector.

7. **Action error channel separation maintained.** Action thunks (`joinLobby`, `invitePlayer`, `createLobbyThunk`, `startGame`, `searchPlayersThunk`) `rejectWithValue(message)` and never dispatch into the lobbies slice's `errors` map. Components catch the rejection with `ConditionError` guard pattern from PR 1 and set local `actionError` state.

8. **`searchPlayersThunk` body order:** `const players = await searchPlayers(...)` → `dispatch(playersUpserted({ players }))` → `return players.map(p => p.id)`. Guarantees the cache is populated before the caller's `.unwrap()` resolves.

9. **Search results list (`PlayerSearch.results`) stays local.** The result IDs are per-search-query UI state; selectors resolve the full Player objects from the players slice.

10. **Single navigation signal: `selectGameById(state, lobbyId) !== undefined`.** Both organizer and non-organizer routes use the same `useEffect` watching this. Achieved by:
    - Non-organizer: `useGamePolling` polls; on game-start, `fetchGame.fulfilled` writes the game; selector becomes defined; navigate.
    - Organizer: `handleStart` calls `dispatch(startGame(...))`. The `startGame` thunk POSTs the start action then **dispatches `fetchGame`**, which writes the game; selector becomes defined; navigate. Same effect, no separate navigation code path. Mirrors `performGameAction` in PR 1.

11. **`fetchGame` rejecting on 404 is acceptable for the lobby use case.** The lobby route does not read `errors[lobbyId]`. The error sits invisibly until `fetchGame.fulfilled` clears it on the next successful poll. Memory cost: tens of bytes per dead lobby entry, bounded by session length. Acceptable.

12. **`startGame` thunk lives in `store/lobbies/thunks.ts`.** Even though it dispatches `fetchGame` (a games-slice thunk), the action originates from the lobby context. Keeping it with other lobby actions matches the shape of PR 2's other thunks (`joinLobby`, `invitePlayer`).

13. **Lobby detail composes inline, no orchestrator hook.** Mirrors PR 1's `routes/games/$gameId.tsx`: `useGamePolling`, `useEffect` dispatching `fetchLobby`, `useAppSelector` reads, `useMemo` for the players Map.

14. **Players Map memoization — explicit ID-array stability.** The route builds `playerIds = useMemo(() => lobby ? [...lobby.invitees, ...lobby.players, lobby.organizer].map(p => p.id) : [], [lobby])`. The `useMemo` keyed on `lobby` is stable across no-op selector reads. Then `selectPlayersByIds(state, playerIds)` receives a stable input array, allowing `createSelector`'s default size-1 cache to work.

---

## Open Questions

### Resolved During Planning

- **What happens to `useSuggestions`?** Deleted. Zero consumers.
- **Lobby list polling?** No, preserve one-time fetch.
- **Need a separate `useLobbyPolling` hook?** No. Reuse `useGamePolling` with `gameId: lobbyId, interval: 5000`. (see §4)
- **Need a `pollLobbyGameStart` thunk?** No. Reuse `fetchGame`. (see §4)
- **Need a `gameStarted` slice flag?** No. The game's *existence* in `state.games.byId[lobbyId]` is the signal. (see §10)
- **How to keep polling cadence stable while waiting for a 404?** Remove exponential backoff from `usePolling`. (see §5, R10)
- **Two navigation triggers — race condition?** No. Both organizer and non-organizer converge on `selectGameById(state, lobbyId) !== undefined`. (see §10)
- **Where does `startGame` thunk live?** `store/lobbies/thunks.ts` — origin context is lobbies. (see §12)
- **`searchPlayers` debounce: in component or thunk?** In component. UI debounce.
- **Players slice has its own thunks?** No. Lobby thunks upsert into the players cache. (see §6)

### Deferred to Implementation

- **Memoization of `selectPlayersByIds` beyond size 1.** Default `createSelector` cache is size 1. Lobby detail's MemberList renders one Map; ship size-1 default. Revisit if PR 3 or later needs size-N.
- **Whether `fetchLobby` and the polling controller can share the loading flag without flicker.** `fetchLobby.pending` toggles `state.lobbies.loading[lobbyId]`. The route's `loading && !lobby` guard prevents the spinner once data is loaded. The polling controller writes to `state.games.loading[lobbyId]` (different slice), which the route does not read. Verify during U4 implementation that no inadvertent coupling exists.

---

## Output Structure

```
store/
├── index.ts              # already exists from PR 1; register lobbies + players reducers
├── hooks.ts              # already exists from PR 1; no changes
├── games/                # already exists from PR 1; untouched
│   ├── slice.ts
│   ├── selectors.ts
│   └── thunks.ts
├── lobbies/              # new in PR 2
│   ├── slice.ts          # LobbiesState; extraReducers for fetchLobby, joinLobby, etc.
│   ├── selectors.ts      # selectLobbyById, selectLobbyList (memoized)
│   └── thunks.ts         # fetchLobby, fetchLobbiesList, createLobbyThunk, joinLobby,
                          #   invitePlayer, startGame, searchPlayersThunk
                          #   Note: no pollLobbyGameStart thunk; lobby polling reuses fetchGame
└── players/              # new in PR 2
    ├── slice.ts          # PlayersState (just byId); playersUpserted reducer
    └── selectors.ts      # selectPlayerById, selectPlayersByIds (memoized)
```

PR 3 adds `store/auth/`. The WS PR adds `store/ws-client.ts`.

---

## Implementation Units

- U1. **Modify `usePolling`: remove exponential backoff**

**Goal:** Replace `usePolling`'s exponential backoff with a simple constant-cadence schedule. The `interval` is the wait between every poll, regardless of success or failure. Drops `failureCount`, `MAX_BACKOFF`, and the backoff calculation.

**Requirements:** R10.

**Dependencies:** None.

**Files:**
- Modify: `lib/hooks/use-polling.ts`
- Modify: `lib/hooks/__tests__/use-polling.test.ts` (replace the backoff-asserting test with a constant-cadence test)

**Approach:**
- Remove `failureCount: useRef(0)`, `MAX_BACKOFF` constant, and the backoff calculation block.
- `scheduleNext()` always uses `interval` for the delay.
- The visibility/online refetch handlers remain unchanged.
- `error` and `isStale` state still reflect the most recent poll outcome (no behavior change there).

**Patterns to follow:**
- The hook's existing structure (`poll` callback, `scheduleNext` recursion) stays the same. Only the delay calculation simplifies.

**Test scenarios:**
- Happy path: hook polls at the configured interval. Three successful polls fire at `interval` ms apart.
- Edge case: hook polls at the same interval after a failure. After a rejection at T=0, the next poll fires at T=interval (not T=2×interval).
- Edge case: repeated failures continue at the constant interval. Five rejections in sequence each fire `interval` ms after the previous.
- Edge case: success after failure resets nothing (no `failureCount` to reset). The next poll fires at `interval`.
- Unchanged behavior: `enabled: false` still tears down the timer. Visibility/online refetch still triggers immediate poll on event.

**Verification:**
- All `usePolling` tests pass (the modified backoff test plus existing visibility/online/enabled tests).
- `useGamePolling` tests still pass (it consumes `usePolling` and doesn't depend on backoff specifics).
- `useLobbyGameStart` tests still pass (will be deleted in U6 anyway).
- `npx tsc --noEmit` and `npm run lint` clean.

---

- U2. **Players slice + lobbies slice scaffolding**

**Goal:** Create the players slice (just `byId` + `playersUpserted` reducer) and the lobbies slice with empty `extraReducers` ready for thunks in U3. Register both reducers in `store/index.ts`.

**Requirements:** R1 (foundation).

**Dependencies:** U1 (independent functionally, but ordering keeps the polling change isolated as the first commit).

**Files:**
- Create: `store/players/slice.ts`
- Create: `store/players/selectors.ts`
- Create: `store/lobbies/slice.ts` (with `extraReducers` stub)
- Create: `store/lobbies/selectors.ts`
- Modify: `store/index.ts` (add `lobbies` and `players` reducers)
- Test: `store/players/__tests__/slice.test.ts`
- Test: `store/lobbies/__tests__/slice.test.ts`

**Approach:**
- `PlayersState`: `{ byId: Record<string, Player> }`. `playersUpserted({ players: Player[] })` reducer merges into `byId`.
- `LobbiesState`: `{ byId: Record<string, Lobby>, list: string[], loading: Record<string, boolean>, listLoading: boolean, errors: Record<string, string | null>, listError: string | null, actionInFlight: Record<string, boolean> }`. **No `gameStarted` field** — the game's existence in the games slice is the signal.
- Selectors:
  - `selectPlayerById(state, playerId): Player | undefined`
  - `selectPlayersByIds(state, ids: string[]): Player[]` (memoized; returns players in input-id order, skipping missing)
  - `selectLobbyById(state, lobbyId): Lobby | undefined`
  - `selectLobbyList(state): Lobby[]` (memoized; returns lobbies in `state.lobbies.list` order)
- Single-consumer derivations (`selectLobbyLoading`, `selectLobbyError`, `selectLobbyActionInFlight`) inline at call sites in U4.

**Patterns to follow:**
- `store/games/slice.ts`, `store/games/selectors.ts` from PR 1 — direct model.

**Test scenarios:**
- Happy path — players slice: `playersUpserted` populates `byId`; subsequent dispatch with overlapping IDs replaces (last-write-wins).
- Happy path — players slice: `selectPlayerById` returns the player when present; returns undefined when missing.
- Edge case — players slice: `selectPlayersByIds` returns players in input-id order; skips IDs missing from cache (no throw, no undefined holes).
- Memoization — players slice: `selectPlayersByIds` returns referentially-equal array across no-op state updates **with the same input array reference**. Add a second test: when called with a *freshly-constructed but equal-valued* array, the result is recomputed (documents the size-1 cache contract).
- Happy path — lobbies slice: initializes to empty state with all fields present.
- Edge case — lobbies slice: `selectLobbyList` returns `[]` when `list` is empty; returns lobbies in the exact order of `list` IDs (skips lobbies missing from `byId`).
- Memoization — lobbies slice: `selectLobbyList` referentially stable across no-op updates.

**Verification:**
- `npx tsc --noEmit` clean.
- `npm run lint` clean.
- All slice tests pass.
- `npm run build` succeeds.

---

- U3. **Lobby thunks (including `startGame` that dispatches `fetchGame`)**

**Goal:** Create all lobby and player thunks. `startGame` POSTs and then dispatches `fetchGame` so the game lands in the games slice. Each thunk that fetches `Player[]` dispatches `playersUpserted`. Wire `extraReducers` for full lifecycle.

**Requirements:** R1, R4, R5, R6.

**Dependencies:** U2.

**Files:**
- Create: `store/lobbies/thunks.ts`
- Modify: `store/lobbies/slice.ts` (replace `extraReducers` stub)
- Test: `store/lobbies/__tests__/thunks.test.ts`

**Approach:**

Thunks to create:

| Thunk | Calls | Side effect | Resolution |
|---|---|---|---|
| `fetchLobbiesList({ playerId })` | `searchLobbies(playerId, { searchText: '', offset: 0, limit: 50 })` | None (lobby members not fetched in list view) | `lobbies` array → `byId` upsert + `list` IDs |
| `fetchLobby({ playerId, lobbyId })` | `getLobby` + `getLobbyPlayers` in parallel via `Promise.all` | `playersUpserted(players)` after fulfillment | Lobby → `byId[lobbyId]` |
| `createLobbyThunk({ playerId, name, accessibility })` | `createLobby` | None | New lobby → `byId[lobby.id]`; returns lobby for caller-side navigate |
| `joinLobby({ playerId, lobbyId })` | `joinLobby` then `fetchLobby` | Re-fetch picks up new player + dispatches `playersUpserted` | Updated lobby in `byId` |
| `invitePlayer({ playerId, lobbyId, inviteeId })` | `invitePlayer` then `fetchLobby` | Re-fetch picks up invitee | Updated lobby in `byId` |
| `startGame({ playerId, lobbyId })` | `startGame` (returns `Event[]` — discarded) **then `dispatch(fetchGame({ playerId, gameId: lobbyId }))`** | Game lands in `state.games.byId[lobbyId]` | Caller-side navigate triggered by selector flip |
| `searchPlayersThunk({ playerId, searchText })` | `searchPlayers` | `playersUpserted(results)` from thunk body before return | Player IDs (caller stores ID list locally) |

Concurrency dedup pattern (same as PR 1):
- For `joinLobby`, `invitePlayer`, `startGame`: `actionInFlight[lobbyId]` flag managed by their pending/fulfilled/rejected extraReducers; `condition` callback rejects when already in flight.
- `fetchLobby` has natural dedup via React effect cleanup; no `condition` needed.
- `searchPlayersThunk` does not dedup; the caller's debounce handles request rate.

Action errors (per PR 1's §6):
- All action thunks use `rejectWithValue(message)` on caught errors. **None dispatch into `errors[lobbyId]`.**
- `fetchLobby`, `fetchLobbiesList` are sync/fetch operations — failures land in the lobbies slice errors via `.rejected` extraReducer.

`extraReducers` lifecycle:

```text
fetchLobby.pending     → loading[lobbyId] = true
fetchLobby.fulfilled   → byId[lobbyId] = lobby; errors[lobbyId] = null; loading[lobbyId] = false
fetchLobby.rejected    → errors[lobbyId] = message; loading[lobbyId] = false

fetchLobbiesList.pending     → listLoading = true
fetchLobbiesList.fulfilled   → byId merged; list = lobby IDs; listError = null; listLoading = false
fetchLobbiesList.rejected    → listError = message; listLoading = false

createLobbyThunk.fulfilled → byId[lobby.id] = lobby

joinLobby.pending          → actionInFlight[lobbyId] = true
joinLobby.fulfilled        → actionInFlight[lobbyId] = false  (fetchLobby dispatched mid-thunk handles byId)
joinLobby.rejected         → actionInFlight[lobbyId] = false

invitePlayer / startGame   → same lifecycle as joinLobby
                              (startGame's fetchGame dispatch writes to games slice, not lobbies slice)

searchPlayersThunk         → no slice fields touched
                             (thunk body dispatches playersUpserted before return)
```

**Patterns to follow:**
- `store/games/thunks.ts:performGameAction` — direct model for `startGame` (POST then dispatch fetch).
- `store/games/thunks.ts:fetchGame` — direct model for `fetchLobby`, `fetchLobbiesList`.

**Test scenarios:**
- Happy path: `fetchLobbiesList` populates `byId` + `list`; `listLoading` cycles true→false; `listError` cleared.
- Happy path: `fetchLobby` populates `byId[lobbyId]`; dispatches `playersUpserted` with the players from `getLobbyPlayers`; both api functions called once each.
- Happy path: `createLobbyThunk` adds the new lobby to `byId`; resolves with the lobby for caller navigation.
- Happy path: `joinLobby` calls `joinLobby` api then `fetchLobby`; `actionInFlight[lobbyId]` cycles true→false.
- Happy path: `invitePlayer` calls `invitePlayer` api then `fetchLobby`; same lifecycle.
- Happy path: `startGame` calls `startGame` api **then dispatches `fetchGame`** which writes to `state.games.byId[lobbyId]`. Verify both: lobbies-slice `actionInFlight` cycles, AND games-slice `byId[lobbyId]` is populated.
- Error path: `startGame` api failure — thunk rejects with message; `fetchGame` is NOT called; `errors[lobbyId]` unchanged in lobbies slice; `errors[lobbyId]` unchanged in games slice.
- Error path: `startGame` api succeeds but `fetchGame` rejects — thunk **resolves successfully** (the action completed server-side); `errors[lobbyId]` set in games slice via `fetchGame.rejected`. (Mirrors `performGameAction` from PR 1.)
- Error path: `joinLobby` api failure — thunk rejects with message; **`errors[lobbyId]` is unchanged** in lobbies slice; `actionInFlight[lobbyId] = false`.
- Concurrency: two concurrent `joinLobby` calls for same lobbyId — only one api call (`condition` drops the second).
- Concurrency: two concurrent `fetchLobby` calls for same lobbyId both resolve correctly; last-write-wins; `loading` returns false; `playersUpserted` dispatched twice (idempotent).
- Isolation: `joinLobby` for lobbyId-A does not affect lobbyId-B state.
- Happy path: `searchPlayersThunk` returns player IDs; players slice has the cached profiles populated *before* the caller's `.unwrap()` resolves (verifies dispatch order from §8).
- Edge case: `searchPlayersThunk` with empty results — `playersUpserted([])` is a no-op; thunk resolves with empty ID array.
- Error path: `searchPlayersThunk` rejection — thunk rejects with message; players slice unchanged.

**Verification:**
- All thunk tests pass.
- TypeScript clean.

---

- U4. **Migrate lobby routes and PlayerSearch component**

**Goal:** Replace all route-local `useState` for server data with selector reads. Wire action thunks. Lobby detail uses `useGamePolling` + selector-based navigation. Compose inline (no orchestrator hook).

**Requirements:** R1, R3, R4, R5, R6.

**Dependencies:** U3.

**Files:**
- Modify: `routes/lobbies/$lobbyId.tsx`
- Modify: `routes/lobbies/index.tsx`
- Modify: `routes/lobbies/new.tsx`
- Modify: `components/lobby/player-search.tsx`

**Approach:**

`routes/lobbies/index.tsx`:
- Replace `useState`-based fetch with `useEffect` that dispatches `fetchLobbiesList({ playerId })`.
- Read `lobbies` from `selectLobbyList`; read `listLoading` and `listError` from inlined `useAppSelector`.
- Apply PR 1 loading-guard pattern: `listLoading && lobbies.length === 0`.
- Invitee partition stays inline.

`routes/lobbies/$lobbyId.tsx` (mirrors `routes/games/$gameId.tsx`):
- `useEffect` on mount: `dispatch(fetchLobby({ playerId, lobbyId }))`.
- `useGamePolling({ gameId: lobbyId, interval: 5000 })` — reuses PR 1's hook directly. The poll dispatches `fetchGame` (against the lobbyId — gets 404 until the game starts).
- Read lobby from `useAppSelector(s => selectLobbyById(s, lobbyId))`.
- Read game from `useAppSelector(s => selectGameById(s, lobbyId))`. **This is the navigation signal.**
- Build `playerIds` with `useMemo` keyed on `lobby` (per §14).
- Read players via `useAppSelector(s => selectPlayersByIds(s, playerIds))`.
- Build `playerDetails` Map via `useMemo` keyed on `players`.
- Inline reads for `loading`, `error`, `actionInFlight` from the lobbies slice.
- **Loading guard:** `if (loading && !lobby) return <Loading />`. Polling does not toggle `loading[lobbyId]` (the polling thunk is `fetchGame`, which writes to the games slice, not lobbies). No flicker.
- **Navigation `useEffect`:** `useEffect(() => { if (game) navigate({ to: '/games/$gameId', params: { gameId: lobbyId } }); }, [game, lobbyId, navigate]);`. Single signal for both organizer and non-organizer.
- `handleJoin`: `await dispatch(joinLobby({ playerId, lobbyId })).unwrap()` with `ConditionError` guard; local `actionError`.
- `handleStart`: `await dispatch(startGame({ playerId, lobbyId })).unwrap()` with `ConditionError` guard. **No explicit navigate call** — the `startGame` thunk's internal `fetchGame` populates the games slice, and the navigation `useEffect` fires.
- Drop the duplicated `useEffect`/`fetchLobby` callback pair from today's code.

`routes/lobbies/new.tsx`:
- Keep `name`, `accessibility`, `submitting`, `error` as local `useState`.
- `handleSubmit` becomes `await dispatch(createLobbyThunk(...)).unwrap()` then `navigate(...)`. `ConditionError` guard.

`components/lobby/player-search.tsx`:
- Keep `query`, `inviting` as local `useState`.
- `results` becomes a local `string[]` (player IDs); resolve via `selectPlayersByIds` with `useMemo`-stabilized IDs.
- 300ms debounce timer stays in component.
- `search()` becomes `dispatch(searchPlayersThunk({ playerId, searchText: query }))` storing returned IDs in local state.
- `handleInvite` becomes `await dispatch(invitePlayer({ ... })).unwrap()` with `ConditionError` guard, then `onInvited()` callback.

**Patterns to follow:**
- `routes/games/$gameId.tsx` — direct model.
- `components/game/game-board.tsx` — `ConditionError` guard pattern.
- PR 1's loading guard.

**Test scenarios:**

This unit's tests are added in U5. **Test expectation: none in U4** — coverage is added in U5.

**Verification:**
- `npx tsc --noEmit` clean.
- `npm run lint` clean.
- Existing `lib/hooks/__tests__/use-lobby-game-start.test.ts` still passes (deleted in U6).
- Manual smoke: lobby list loads; create lobby navigates to detail; join lobby refreshes member list; invite via search adds to invitees; start game navigates to game page (organizer fast path); non-organizer sees redirect when game starts (polling-detected path).

---

- U5. **Add lobby route tests (cross-layer behavioral parity)**

**Goal:** Add two route-level test files. PlayerSearch covered through lobby-detail integration.

**Requirements:** R5, R8.

**Dependencies:** U4.

**Files:**
- Create: `routes/lobbies/__tests__/lobby-detail.test.tsx`
- Create: `routes/lobbies/__tests__/lobby-list.test.tsx`

**Approach:**
- Build `renderWithStore` helper (or extract to a shared util — defer to implementation).
- Mock `@/lib/api/lobbies`, `@/lib/api/players`, `@/lib/api/games` (`getGame` for polling), `@/lib/hooks/use-auth`, and `@tanstack/react-router`'s `useNavigate` + `useParams`.
- Use `vi.useFakeTimers({ shouldAdvanceTime: true })` for polling tests.
- Tests assert visible UI behavior, not internal slice state.

**Test scenarios:**

`lobby-list.test.tsx`:
- Happy path: shows loading state on initial render; renders lobby cards after fetch; partitions invitees first.
- Empty state: renders "No lobbies yet" message when fetch returns `[]`.
- Error path: renders error message when `searchLobbies` rejects.

`lobby-detail.test.tsx`:
- Happy path: shows loading state on first render; renders lobby name, member list, accessibility badge after fetch; resolves member names from the players cache.
- Loading guard: subsequent polls (which dispatch `fetchGame` and may set/clear games-slice errors) do NOT replace the rendered lobby content with the loading state.
- Action — Join: non-member with public lobby clicks Join → `joinLobby` dispatched → re-fetch → updated member list visible.
- Action — Invite: organizer's PlayerSearch query → results appear → clicks Invite → `invitePlayer` dispatched → invitee appears in member list.
- Action — Start (organizer): clicks Start → `startGame` dispatched → `fetchGame` succeeds with the new game → navigation `useEffect` fires → navigates to `/games/$gameId` with `gameId === lobbyId`.
- Polling — game-start detection (non-organizer): polling fires `fetchGame(lobbyId)` every 5s → first 5s gets 404 (no navigate) → `getGame` mock starts returning the game → `fetchGame.fulfilled` writes to games slice → navigation effect fires → navigates.
- Polling — 404 handling: while game not started, `fetchGame` rejections set `errors[lobbyId]` in games slice; lobby route doesn't read that error; UI shows no error indication.
- Polling — constant cadence after failure: 5s interval is preserved across failures (verifies R10 — no exponential backoff).
- Action error semantics: `joinLobby` rejection shows `actionError` locally; `errors[lobbyId]` is unchanged in lobbies slice (mirrors PR 1 §6).
- ConditionError handling: rapid double-click on Start does not show "Action failed" error.
- PlayerSearch debounce: typing in search field does not fire api call until 300ms idle; only the latest value is searched.
- PlayerSearch query length: < 2 chars returns no results without firing api.
- PlayerSearch cache update: invite adds the invitee to the member list using their cached name.

**Verification:**
- All new route tests pass.
- Test count grows by ~12-15 new tests across two files.

---

- U6. **Delete `useLobbyGameStart` and suggestion code; final cleanup**

**Goal:** With all consumers migrated, delete the legacy `useLobbyGameStart` hook and the dead suggestion code. **`usePolling` is retained** (per R2).

**Requirements:** R2, R7.

**Dependencies:** U5.

**Files:**
- Delete: `lib/hooks/use-lobby-game-start.ts`
- Delete: `lib/hooks/__tests__/use-lobby-game-start.test.ts`
- Delete: `lib/hooks/use-suggestions.ts`
- Delete: `components/game/suggestion-toggle.tsx`
- Modify: `lib/api/games.ts` (remove `getSuggestions` function)
- Modify: `lib/api/types.ts` (remove `Suggestion` type)
- Modify: `lib/api/__tests__/games.test.ts` (remove `getSuggestions` tests if any)
- Verify (no change): `lib/hooks/use-polling.ts` and its test file remain (modified in U1, retained as shared primitive)

**Approach:**
- Delete files in the order listed.
- After each deletion, grep the codebase for remaining references and resolve.

**Test expectation:** none — pure deletion. Coverage is provided by U2/U3 (slice/thunks), U5 (route parity tests), and U1 (modified usePolling tests).

**Verification:**
- `grep -r "useLobbyGameStart\|use-lobby-game-start" --include="*.ts" --include="*.tsx"` returns zero results.
- `grep -r "useSuggestions\|use-suggestions\|SuggestionToggle\|suggestion-toggle\|getSuggestions" --include="*.ts" --include="*.tsx"` returns zero results in code (excluding doc files).
- `grep -r "\bSuggestion\b" --include="*.ts" --include="*.tsx"` returns zero results in code.
- `grep -r "usePolling" --include="*.ts" --include="*.tsx"` returns matches **only** in `lib/hooks/use-polling.ts`, `lib/hooks/use-game-polling.ts`, and the lobby detail route file (verifies `usePolling` retained as shared primitive — note: lobby route uses `useGamePolling`, which uses `usePolling` internally, so direct grep matches are fewer).
- `npx tsc --noEmit` clean.
- `npm run lint` clean.
- `npm run test` all green.
- `npm run build` succeeds.

---

## System-Wide Impact

- **Interaction graph:** Lobby thunks fan into the lobbies slice via `extraReducers`. Lobby thunks dispatch `playersUpserted` into the players slice as a side effect. The lobby detail route's polling dispatches `fetchGame` (PR 1's thunk) which writes to the games slice. Both organizer and non-organizer navigate via the same `useEffect` watching `selectGameById(state, lobbyId)`.
- **Error propagation:** Two channels per PR 1's pattern. Action thunk failures stay local. Fetch/sync failures land in the relevant slice (lobbies for `fetchLobby`/`fetchLobbiesList`, games for `fetchGame` polling). The 404 error from polling a not-yet-started game lands in `state.games.errors[lobbyId]` but is not surfaced (lobby route doesn't read it).
- **Loading lifecycle:** `state.lobbies.loading[lobbyId]` is exclusively driven by `fetchLobby.pending/fulfilled/rejected`. The polling controller's `fetchGame` writes to `state.games.loading[lobbyId]`, which the lobby route does not read. Combined with the `loading && !lobby` route guard, the lobby detail page never flickers.
- **Polling cadence behavior change (R10):** `usePolling` no longer applies exponential backoff. This affects PR 1's `useGamePolling` too — transient errors during game polling will retry at 3s instead of backing off to 30s. This is a deliberate UX improvement (faster recovery) and a documented behavior change.
- **Unchanged invariants:** `lib/api/client.ts`, `lib/api/lobbies.ts`, `lib/api/players.ts`, `lib/firebase.ts`, `components/auth/*`, all game routes other than the polling cadence change. The games slice and most games tests are not modified (the polling-cadence-related test in `use-polling.test.ts` is updated; `use-game-polling.test.tsx` may need a backoff-related test removed if any exists).

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Removing exponential backoff increases server load during real outages. | This app's polling is at most 1 req/3s/client; removing backoff doesn't push it past any reasonable threshold. Visibility/online refetch handlers already provide user-driven recovery. If a real outage scenario emerges later, reintroduce backoff with a more conservative shape (e.g., cap at 10s instead of 30s). |
| `fetchGame` rejecting on 404 leaves `errors[lobbyId]` in games slice during the entire wait. | Lobby route doesn't read this error. Cleared by `fetchGame.fulfilled` when the game eventually appears. Memory cost: tens of bytes per dead lobby entry, bounded by session length. |
| Players cache could drift if a lobby thunk fails to dispatch `playersUpserted` after fulfillment. | U3 explicitly asserts `playersUpserted` dispatch after each player-fetching thunk's fulfillment. |
| `selectPlayersByIds` size-1 cache busts if callers don't memoize their input array. | §14 specifies the `useMemo`-keyed-on-lobby pattern; U2 tests verify both stable-input and fresh-input behavior so callers know the contract. |

---

## Documentation / Operational Notes

- After PR 2 merge, the migration's core value is shipped. PR 3 (auth) becomes optional cleanup.
- No deployment, environment variable, or backend changes.
- The `AGENTS.md` Project Structure entry for `store/` (added in PR 1) already mentions PR 2 adds `store/lobbies/` — extend the same line to mention `store/players/` as well.
- After PR 2 ships, update `docs/solutions/architecture-patterns/redux-toolkit-polling-migration-2026-04-26.md` via `/ce-compound-refresh` to capture the new patterns: polling-thunk reuse across domains, the no-backoff-just-interval design, and the "single navigation signal via existing slice data" pattern.

---

## Sources & References

- **Origin document:** `docs/brainstorms/state-management-redux-toolkit-requirements.md`
- **PR 1 plan (sibling, completed):** `docs/plans/2026-04-26-001-refactor-redux-toolkit-games-slice-plan.md`
- **PR 1 PR (merged):** `https://github.com/seamuslowry/hundred-and-ten-web/pull/25`
- Compound learning: `docs/solutions/architecture-patterns/redux-toolkit-polling-migration-2026-04-26.md`
- Related code:
  - `lib/api/lobbies.ts`, `lib/api/players.ts`, `lib/api/games.ts:getGame` — endpoints called by thunks
  - `lib/hooks/use-lobby-game-start.ts` — replaced by direct reuse of `useGamePolling` with `gameId: lobbyId`
  - `lib/hooks/use-polling.ts` — modified in U1 (backoff removed); retained as shared primitive
  - `lib/hooks/use-game-polling.ts` — reused as-is for lobby polling
  - `routes/games/$gameId.tsx`, `components/game/game-board.tsx` — direct models
- Related learnings:
  - `docs/solutions/best-practices/react-async-handler-memoization-and-prop-consistency-2026-04-21.md` — async handler patterns
  - `docs/solutions/integration-issues/spike-game-openapi-breaking-change-2026-04-25.md` — type guard placement
