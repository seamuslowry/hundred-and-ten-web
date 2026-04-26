# State Management Refactor (Redux Toolkit) — Requirements

**Date:** 2026-04-26
**Status:** Ready for planning
**Scope:** Standard, incremental migration

## Problem

The app's state management has grown organically and is starting to fight us in two specific ways, with a third concern about future architecture:

1. **Scattered `useState` and prop drilling.** Route components own a lot of server-derived state locally (e.g., `routes/lobbies/$lobbyId.tsx` keeps `lobby`, `playerDetails`, `loading`, `error`, `actionLoading` as separate `useState`s; `routes/games/$gameId.tsx` threads game data and refresh callbacks through `GameBoard` and friends). Each route fetches and stores its own copy of data the rest of the app could share.
2. **Hard-to-reason action flows.** Bid → trump-selection → discard → tricks sequences depend on action endpoints returning `Event[]` and the client re-fetching to see the result. Optimistic updates, refresh callbacks, and "did the active player change?" checks (see `lib/hooks/use-game-state.ts:74-79`) are tangled across hooks and components.
3. **Future websockets.** The next architectural step is a websocket transport that pushes game/lobby state deltas to clients. Polling should become a fallback for bootstrap, reconnect, and detected gaps. Without a single canonical store, every websocket message would have to find and update N component-local `useState` setters.

Today's `useGameState` + `usePolling` + per-route `useState` works, but it does not scale to a websocket-driven architecture and is already producing incidental complexity.

## Goal

Move authoritative state for **games**, **lobbies**, and **players** out of route components and ad-hoc hooks into a single, structured store, in a way that:

- removes prop drilling and per-route duplication of server data,
- centralizes the action → state-update flow,
- gives us one obvious place to plug in websocket events later,
- and is incremental — each migration step ships independently.

## Non-Goals

- Implementing websocket transport. WS is the *reason* this refactor matters, but the WS client, reconnect logic, gap detection, and event reducers are out of scope for this work. They get their own brainstorm/plan.
- Building a generic event-sourcing engine. Event reducers (`applyEvent`) are explicitly deferred to the WS phase.
- Optimistic updates. The acting player's REST response already returns the resulting events synchronously, so optimistic UI is not required and is out of scope.
- Replacing the API client (`lib/api/client.ts`) or the typed endpoint modules (`lib/api/games.ts`, `lobbies.ts`, `players.ts`). Those stay.
- Replacing TanStack Router or any other framework choice.

## Decision: Redux Toolkit

We are committing to **Redux Toolkit** (with **RTK Query** used minimally for bootstrap and resync queries).

### Why Redux Toolkit over the alternatives

The brainstorm evaluated three options:

- **Redux Toolkit + RTK Query** — chosen.
- **TanStack Query + Zustand/Context** — strong fit for server-cache-with-action-invalidation apps, but the planned WS architecture inverts that model: actions don't trigger refetches; events deliver deltas. A large fraction of TanStack Query's value prop (mutation lifecycle, automatic invalidation) would go unused.
- **Zustand only** — viable, but loses Redux's first-class devtools (action log, time-travel) which are particularly valuable when debugging "the WS sent these N events in this order — why does the UI think it's still my turn?"

The decisive factors for Redux Toolkit:

1. The future WS model is essentially event-sourced. Redux's "dispatch action → reducer applies it" is literally event sourcing.
2. The acting player's REST response (`Event[]`) and future WS messages (`Event[]`) can funnel into the **same** action (`eventsReceived`), giving us one event-application path with two transports.
3. Redux DevTools genuinely earn their carrying cost when debugging an event stream.
4. Familiarity: stated preference of the maintainer; reduces onboarding friction.

### Why not the prevailing-default critique

The community default for *server state* has shifted to TanStack Query. That critique applies most strongly to apps where actions invalidate caches and trigger refetches. This app is moving deliberately away from that pattern toward server-pushed deltas, so the default doesn't fit. This is a deliberate choice with eyes open, not an "I prefer what I know" choice.

## Store Shape (target)

```
store/
├── index.ts              # configureStore, typed hooks (useAppSelector, useAppDispatch)
├── slices/
│   ├── auth-slice.ts     # { user, status }
│   ├── lobbies-slice.ts  # { byId, loadingIds, errors }
│   ├── games-slice.ts    # { byId, lastSequence, loadingIds, errors }
│   └── players-slice.ts  # { byId } — cached profiles for names/avatars
├── api/
│   └── api-slice.ts      # RTK Query endpoints used for bootstrap + resync only
├── events/
│   ├── apply-event.ts    # (game, event) => game — DEFERRED to WS phase
│   └── event-middleware.ts  # DEFERRED to WS phase
└── transports/
    ├── rest-actions.ts   # thunks for bid/play/discard/selectTrump
    └── ws-client.ts      # DEFERRED to WS phase
```

`lastSequence` is included in `games-slice` from PR 1 onward as a forward-looking field, even though it isn't read until the WS phase. This avoids a later schema break.

## Migration Order

Three independently shippable PRs. Each is mergeable on its own; later PRs do not depend on the order of files within earlier PRs except where noted.

### PR 1 — Games slice

**Scope:**

- Add Redux Toolkit and `react-redux` as dependencies.
- Add `<Provider store={store}>` at the app root in `main.tsx`.
- Create `store/index.ts`, `store/slices/games-slice.ts`, and typed `useAppSelector` / `useAppDispatch` hooks.
- Create `store/api/api-slice.ts` with `getGame` as the only endpoint initially. Bootstrap via `useGetGameQuery` dispatches `gameLoaded(game)` into the games slice (or RTK Query owns the cache for now and we read from `useGetGameQuery`'s result — see open question below).
- Convert game actions (`bid`, `play`, `selectTrump`, `discard`) to thunks in `store/transports/rest-actions.ts` that POST and dispatch `gameLoaded` with the resulting game state. **Use "set whole game" semantics now**; the REST response will be re-fetched after the action and dispatched as a full replacement. Event reducers come later.
- Replace `useGameState` with selectors (`selectGameById`, `selectActiveRound`, `selectMyTurn`, `selectMyHand`, `selectIsCompleted`, `selectWinner`, `selectPhase`).
- Update `routes/games/$gameId.tsx` and game components to read from selectors and dispatch thunks. Remove the `onActionComplete` / `refetch` prop drilling through `GameBoard`.
- Keep polling for now: a thin "resync" trigger replaces `usePolling` for the game query, calling RTK Query's `refetch` on an interval. Polling does not go away in PR 1; it just lives in one place.

**What gets deleted in PR 1:**

- `lib/hooks/use-game-state.ts`
- The game-related portions of `lib/hooks/use-polling.ts` usage (the file may stay if `useLobbyGameStart` still uses it; deleted in PR 2).

**What stays untouched in PR 1:**

- Auth (still on `AuthContext`).
- Lobby state (still local `useState` in `routes/lobbies/*`).
- `lib/api/client.ts`, `lib/api/games.ts`, etc.

### PR 2 — Lobbies and players slices

**Scope:**

- Add `lobbies-slice.ts` and `players-slice.ts`.
- Add `getLobby`, `getLobbyPlayers`, `searchPlayers` endpoints to the api slice.
- Convert lobby actions (`joinLobby`, `inviteToLobby`, `startGame`, lobby creation) to thunks.
- Replace `useLobbyGameStart` with a selector + a small "is this lobby's game live yet?" subscription (still polled until WS lands).
- Update `routes/lobbies/index.tsx`, `routes/lobbies/$lobbyId.tsx`, `routes/lobbies/new.tsx`, and lobby components to read from selectors.

**What gets deleted in PR 2:**

- `lib/hooks/use-lobby-game-start.ts`
- `lib/hooks/use-suggestions.ts` if it can be expressed as a derived query/thunk (open question — see below).
- `lib/hooks/use-polling.ts` if no remaining consumer.
- Local lobby/player `useState` in route components.

### PR 3 — Auth slice (optional)

**Scope:**

- Move auth state (`user`, `loading`) into `auth-slice.ts`.
- Wrap `onAuthStateChanged` from `lib/firebase.ts` in a small subscription that dispatches `authChanged(user)` actions.
- `signIn` / `signOut` / `getToken` become thunks or remain on a context wrapper that dispatches into the slice.
- `useAuth` becomes `useAppSelector(s => s.auth)`.

**This PR is optional.** Auth on Context already works and isn't a pain point. Migrating gets us a single mental model and devtools visibility into auth events, but it's defensible to leave it on Context indefinitely.

## Behavior That Must Not Change

- Polling cadence (3s for games, 5s for lobby-game-start) and tab-focus / network-recovery refetch behavior, until WS replaces them.
- Exponential backoff on poll failure (currently in `lib/hooks/use-polling.ts:67-71`).
- Auth gating (`RequireAuth` semantics, redirect on sign-out).
- All visible UI behavior — error states, loading states, action loading flags shown on buttons.
- API request shape and authorization. The store calls the same `lib/api/*` functions that exist today.

## Success Criteria

- `useGameState`, `useLobbyGameStart`, `usePolling` are deleted by end of PR 2.
- No route component contains a `useState` for server-fetched data (lobby, game, players, suggestions).
- `routes/games/$gameId.tsx` reads game data exclusively from selectors; the `onActionComplete` / `refetch` props to `GameBoard` are removed.
- The action → state-update path is reduced to: thunk POSTs, dispatches `gameLoaded(updatedGame)`, components re-render. No bespoke refetch wiring per component.
- A new contributor reading the code can answer "where does game state live?" in one sentence ("the games slice in `store/slices/games-slice.ts`").
- WS integration in a future PR adds **only** an event-application reducer and a WS client that dispatches `eventsReceived`. No component changes required.
- Existing tests pass: `lib/api/__tests__/`, `routes/games/__tests__/`, plus the polling and game-state hook tests are replaced by selector and slice tests.
- Build (`npm run build`) and typecheck (`npx tsc --noEmit`) pass.

## Risks and Open Questions

### Risks

- **Two patterns coexist between PRs.** During PR 1 only games are in Redux; lobbies are still in `useState`. This is intentional and limited to one or two PR cycles, but reviewers should expect mixed patterns mid-migration.
- **Suggestions hook (`use-suggestions.ts`) is awkward to port.** It's tied to "is it currently my turn?" and refetches on turn change. Not a blocker; we can leave it as a hook that reads from selectors but keeps its own internal state for the suggestion list.
- **RTK Query + slice double-storage.** If `useGetGameQuery` keeps the game in RTK Query's cache *and* `gameLoaded` puts it in the games slice, we have two sources of truth. The recommended pattern is to either (a) use RTK Query as the cache and have selectors read from `api.endpoints.getGame.select(...)`, or (b) use thunks instead of RTK Query and own the cache fully in the slice. **PR 1 must pick one.**
- **Bundle size.** Redux Toolkit + react-redux ≈ 13KB gzipped on top of current bundle. Acceptable for the value, but worth a note.
- **Devtools in production.** The Redux devtools should be disabled in production builds (`configureStore` does this by default in non-dev mode, but verify).

### Open Questions (to resolve in planning)

1. **RTK Query as cache, or thunks-only?** See "double-storage" risk above. The simplest answer is probably "thunks only for PR 1; consider RTK Query when the API surface grows" — but worth deciding explicitly.
2. **Where does the polling timer live in the new world?** Options: (a) a `pollingMiddleware` keyed off "currently mounted game IDs"; (b) a thin `usePollGame(gameId)` hook that components mount, which dispatches resync thunks on an interval; (c) RTK Query's `pollingInterval` if we go with option (a) above. Decide in planning.
3. **Should `useSuggestions` migrate, stay as-is, or be deleted?** It's not server state in the same sense — it's a per-turn fetch tied to UI. Leaving it as a hook is fine; the question is whether it should read `myTurn` from a selector.
4. **Auth migration in this stream or defer?** PR 3 is optional. Decide once PR 1 and PR 2 are merged.

## Dependencies / Prerequisites

- `@reduxjs/toolkit` and `react-redux` added to `package.json` in PR 1.
- No backend changes required.
- No environment variable changes required.

## Out of Scope (deferred for later)

- **Websocket transport.** Separate brainstorm/plan. Will introduce `events/apply-event.ts`, `events/event-middleware.ts`, `transports/ws-client.ts`, plus reconnection, gap detection (via `lastSequence`), and resync triggering.
- **Optimistic updates.** Not needed given the synchronous `Event[]` REST response on actions.
- **Server-side rendering or persistence.** Pure SPA, in-memory store; matches existing architecture.
- **Cross-device state sync beyond what the backend already provides.**

## Outside This Product's Identity

- Multi-game state machines beyond the current Hundred and Ten flow. The store is shaped for one game type; a future card-game-agnostic engine would be its own design exercise.
- Replay / time-travel as a user-facing feature. Devtools time-travel is for developers; user-facing replay is a separate product question.

## Handoff to Planning

This document captures **what** to build. Planning should address:

- Concrete file diffs and new file scaffolding for PR 1.
- Test plan: which existing tests survive, which are rewritten, which are added.
- The "RTK Query vs thunks-only" decision (see open question 1).
- Polling-timer placement (see open question 2).
- Migration of suggestions hook (see open question 3).
