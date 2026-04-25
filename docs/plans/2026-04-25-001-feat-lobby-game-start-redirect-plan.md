---
title: "feat: Redirect lobby players when game starts"
type: feat
status: active
date: 2026-04-25
origin: docs/brainstorms/lobby-game-start-redirect-requirements.md
---

# feat: Redirect lobby players when game starts

## Overview

Add polling to the lobby detail page so non-organizer players are automatically redirected to the game screen when the organizer starts the game. Currently only the organizer navigates to `/games/$gameId` after calling `startGame()` — every other player sees a dead screen.

## Problem Frame

When the organizer starts a game from the lobby detail page (`routes/lobbies/$lobbyId.tsx:91-101`), only they are navigated to the game. Other players viewing the lobby have no mechanism to detect the game has started. The lobby detail page fetches data once on mount and never polls. (see origin: `docs/brainstorms/lobby-game-start-redirect-requirements.md`)

## Requirements Trace

- R1. The lobby detail page polls for game start while the player is viewing it
- R2. When game start is detected, the player is automatically redirected to `/games/$gameId` (where `gameId === lobbyId`)
- R3. Polling reuses the existing `usePolling` hook
- R4. Polling interval is reasonable for a waiting room scenario
- R5. Polling stops once the redirect fires or the player navigates away

## Scope Boundaries

- Lobby list page (`/lobbies`) does not detect game starts
- No SSE or WebSocket implementation
- No visual "game starting" transition — immediate redirect
- No polling for other lobby changes (new players joining, invites)

## Context & Research

### Relevant Code and Patterns

- `lib/hooks/use-polling.ts` — generic polling hook with exponential backoff, tab-focus re-poll, network recovery
- `lib/hooks/use-game-state.ts` — direct pattern reference for wrapping `usePolling` in a domain-specific hook
- `routes/lobbies/$lobbyId.tsx` — lobby detail page, target for integration
- `lib/api/games.ts:getSpikeGame` — game endpoint; returns `SpikeGame` on success, `ApiError(404)` when game doesn't exist
- `lib/api/client.ts:ApiError` — typed error class with `status` field

### Institutional Learnings

- **"Adjust state during render" pattern** (`docs/solutions/best-practices/react-async-handler-memoization-and-prop-consistency-2026-04-21.md`): ESLint bans `setState` inside `useEffect` and `ref.current` reads/writes during render. To derive `pollingEnabled` from poll data, compare a tracked key in the render body and call `setState` synchronously. This is the only lint-compliant approach in this codebase.
- **Always `catch` in async handlers**: `try/finally` without `catch` causes unhandled rejections.
- **Memoize fetchers with `useCallback`**: Prevents unnecessary re-renders and polling loop restarts.
- **Test polling forwarding with spy-wrap pattern**: `vi.mock("../use-polling", async (importOriginal) => ...)` to assert interval and enabled flags.

## Key Technical Decisions

- **Detection via `getSpikeGame`, not `getLobby`**: The `Lobby` type has no status field. Since `gameId === lobbyId`, calling `getSpikeGame(playerId, lobbyId)` gives a clean binary signal — 200 means the game exists, 404 means it doesn't. No backend changes required.
- **Wrap 404 as a sentinel return, not an error**: The fetcher catches `ApiError` with status 404 and returns a `{ started: false }` value instead of throwing. This prevents `usePolling`'s exponential backoff from activating on expected "not started yet" responses. Real errors (network, 500) still throw and trigger backoff normally.
- **5-second polling interval**: Balances responsiveness (waiting room UX) with server load. Faster than the 30s fallback poll on the game page, slower than the 3s active-game poll. The game start event happens once per lobby lifecycle, so total polling duration is bounded.
- **Poll for all players, including organizer**: Simpler than gating on `isOrganizer`. If the organizer's `handleStart` succeeds, they navigate away and the component unmounts (stopping the poll). If it fails, the poll serves as a fallback redirect.

## Open Questions

### Deferred to Implementation

- **Exact backend 404 behavior**: Verify that `getSpikeGame` returns 404 (not another status) when the game doesn't yet exist. The fetcher should handle this gracefully regardless, but the test mocks should match reality.

## Implementation Units

- U1. **`useLobbyGameStart` hook**

**Goal:** Create a hook that polls the game endpoint to detect when a lobby has transitioned to a game.

**Requirements:** R1, R3, R4, R5

**Dependencies:** None

**Files:**
- Create: `lib/hooks/use-lobby-game-start.ts`
- Test: `lib/hooks/__tests__/use-lobby-game-start.test.ts`

**Approach:**
- Follow `useGameState` pattern: `useCallback` fetcher, `usePolling` wrapper, derived state
- Hook calls `useAuth()` internally to get `playerId` (same pattern as `useGameState` at `lib/hooks/use-game-state.ts:26`). Options interface accepts `lobbyId` and optional `interval`.
- Fetcher calls `getSpikeGame(playerId, lobbyId)` — on success returns `{ started: true }`, catches `ApiError` with status 404 and returns `{ started: false }`, re-throws all other errors
- Pass `enabled: !!playerId` to `usePolling` — no "adjust state during render" needed here because once `started` is detected the component will navigate away (unmounting stops the poll per R5)
- Default interval: 5000ms
- Derive `gameStarted` from `usePolling`'s `data` return: `data?.started ?? false`. Expose `error` from `usePolling` for callers that want it. Intentionally drop `loading`, `isStale`, and `refetch` — this hook's only job is signaling game start, and callers don't need polling lifecycle details.
- Return `{ gameStarted: boolean, error: Error | null }`

**Patterns to follow:**
- `lib/hooks/use-game-state.ts` — hook wrapping `usePolling` with `useCallback` fetcher
- `lib/hooks/__tests__/use-game-state.test.ts` — spy-wrap mock pattern for `usePolling`

**Test scenarios:**
- Happy path: when `getSpikeGame` resolves successfully, `gameStarted` is `true`
- Happy path: when `getSpikeGame` throws `ApiError(404)`, `gameStarted` is `false` (game not started yet)
- Error path: when `getSpikeGame` throws a non-404 error (e.g., network error), `error` is set and `gameStarted` remains `false`
- Happy path: verify `usePolling` is called with `interval: 5000` and `enabled: true` when `playerId` is present
- Edge case: verify `usePolling` is called with `enabled: false` when `playerId` is absent

**Verification:**
- Hook returns `gameStarted: false` while polling 404s, flips to `true` on first success
- Non-404 errors propagate to `error` without triggering a false `gameStarted`

- U2. **Wire redirect into lobby detail page**

**Goal:** Integrate `useLobbyGameStart` into the lobby detail page and navigate to the game when detected.

**Requirements:** R2, R5

**Dependencies:** U1

**Files:**
- Modify: `routes/lobbies/$lobbyId.tsx`

**Approach:**
- Call `useLobbyGameStart({ lobbyId })` inside `LobbyDetailContent` (uses 5s default interval)
- Add a `useEffect` watching `gameStarted` — when it becomes `true`, call `navigate({ to: "/games/$gameId", params: { gameId: lobbyId } })`. A `useEffect` is appropriate here because navigation is a side effect, not derived render state.
- No UI changes needed — the redirect is invisible. If the hook returns an error, ignore it (the page already has its own error handling for lobby fetch failures, and a failed game-start poll shouldn't block the lobby view).

**Patterns to follow:**
- Existing `navigate()` call in `handleStart` at `routes/lobbies/$lobbyId.tsx:96`
- `useNavigate()` import already present in the file

**Test scenarios:**
- Happy path: when `useLobbyGameStart` returns `gameStarted: true`, `navigate` is called with `{ to: "/games/$gameId", params: { gameId: lobbyId } }`
- Happy path: when `useLobbyGameStart` returns `gameStarted: false`, no navigation occurs
- Edge case: hook error does not break the lobby page — lobby content still renders
- Non-regression: organizer's `handleStart` flow still navigates independently; polling hook does not cause double navigation

**Verification:**
- A non-organizer player viewing the lobby is redirected when the organizer starts the game
- The organizer's existing start-game flow is unaffected
- Navigating away from the lobby stops polling (component unmount)

## System-Wide Impact

- **Interaction graph:** The new polling adds `GET /players/{playerId}/games/{lobbyId}/spike` calls from the lobby page. This endpoint is already called by the game page's polling — no new API surface.
- **Error propagation:** 404s from the game endpoint are caught inside the fetcher and never surface to the user. Real errors are available via the hook's `error` return but intentionally ignored by the lobby page (game-start polling failure is non-critical).
- **Unchanged invariants:** The organizer's `handleStart` → `navigate` flow is untouched. The lobby's existing fetch-on-mount behavior for lobby data is untouched. No new routes or API endpoints.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Backend returns a non-404 error for nonexistent games | Fetcher re-throws non-404 errors; hook surfaces them via `error` but page ignores them. Verify actual status code during implementation. |
| Polling adds server load for idle lobby viewers | 5s interval is modest; polling stops on navigate-away or game detection; total duration is bounded by lobby lifetime. |

## Sources & References

- **Origin document:** [docs/brainstorms/lobby-game-start-redirect-requirements.md](docs/brainstorms/lobby-game-start-redirect-requirements.md)
- Related pattern: `lib/hooks/use-game-state.ts` (hook wrapping `usePolling`)
- Related learning: `docs/solutions/best-practices/react-async-handler-memoization-and-prop-consistency-2026-04-21.md`
