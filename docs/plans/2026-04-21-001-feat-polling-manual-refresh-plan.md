---
title: "feat: Add Manual Refresh Button and Reduce Background Polling"
type: feat
status: active
date: 2026-04-21
origin: docs/brainstorms/polling-manual-refresh-requirements.md
---

# feat: Add Manual Refresh Button and Reduce Background Polling

## Overview

Replace continuous 3-second polling with a turn-aware polling strategy: disable the background timer when it is the current player's turn (game state is already fresh from the last action), slow it to 30 seconds when waiting on opponents, and expose a manual "Refresh" button in the status bar that replaces the "Your turn" indicator while waiting. Tab-focus and network-recovery triggers are retained unchanged.

## Problem Frame

The current `usePolling` hook fetches game state every 3 seconds for every connected client. Polling is only useful when a player is waiting for an opponent — while it's your own turn, state is already fresh from the `onActionComplete` refetch that fires after every action. With multiple concurrent games, this creates unnecessary server load. SSE is the long-term fix; this plan is the MVP bridge.

(see origin: `docs/brainstorms/polling-manual-refresh-requirements.md`)

## Requirements Trace

- R1. Background poll timer is disabled for the entire duration of a player's own turn (level-based)
- R2. Background poll interval drops to 30 seconds when it is not the player's turn
- R3. A manual "Refresh" button appears in place of the "Your turn" indicator when waiting; it is hidden during the player's own turn and after game completion
- R4. While a refresh is in-flight, the button is in a loading/disabled state to prevent double-fetches
- R5. Tab-focus and online-event refresh triggers are retained unchanged
- R6. `onActionComplete` refetch continues to fire immediately after every player action
- R7. Existing `use-polling.ts` unit tests continue to pass; new behavior has test coverage

## Scope Boundaries

- Game board page only — no other pages use polling
- No SSE, WebSocket, or push-notification implementation
- No per-user configurable intervals
- No new loading skeletons or animations beyond the button loading state

## Context & Research

### Relevant Code and Patterns

- `lib/hooks/use-polling.ts` — `interval` is already reactive; changing the prop causes the `useEffect([enabled, poll, interval])` to cancel the old loop and start a new one. Setting `enabled: false` clears the timer and stops polling; flipping back to `true` immediately triggers a fresh fetch and new loop.
- `lib/hooks/use-game-state.ts` — already accepts `interval?: number` and forwards it to `usePolling`. Also derives `myTurn`, `completed`, `loading`, and exposes `refetch` directly from `usePolling`.
- `app/games/[gameId]/game-page.tsx` — calls `useGameState`, passes `refetch` as `onActionComplete` to `GameBoard`, and passes `myTurn` to `GameBoard`. Turn-aware interval logic belongs here alongside the hook call.
- `components/game/game-status-bar.tsx` — renders the pill that says "Your turn" or "Waiting for …" based on `myTurn`. This is the correct placement for the refresh button — the pill slot is already mutually exclusive between the two states and sits next to the existing `isStale` "Reconnecting…" indicator.
- `lib/hooks/__tests__/use-polling.test.ts` — Vitest + `@testing-library/react` (`renderHook`, `waitFor`, `act`). Fake timers via `vi.useFakeTimers({ shouldAdvanceTime: true })`. Time advancement wrapped in `await act(async () => { await vi.advanceTimersByTimeAsync(N); })`.

### Institutional Learnings

- Any component calling `useState`, `useEffect`, or a custom hook wrapping those must have `'use client'`. `GameStatusBar` will need this directive if it doesn't already have it once it gains event-handler props. (see `docs/solutions/best-practices/use-client-directive-ssr-migration-2026-04-19.md`)
- Gate hover/cursor CSS classes explicitly on a `disabled` variable — CSS `disabled` attribute alone does not suppress `:hover` on non-form elements. (see `docs/solutions/ui-bugs/game-ui-rendering-and-style-fixes-2026-04-19.md`)

### External References

None needed — local patterns are sufficient.

## Key Technical Decisions

- **Turn-aware polling via `enabled` and `interval` in `useGameState`:** The caller (`game-page.tsx`) passes `enabled: !myTurn && !completed` and `interval: 30000` to `useGameState`, which forwards both to `usePolling`. When `enabled` is `false`, `usePolling` clears its timer entirely — this is the mechanism for stopping polling on your turn and after game completion. The `interval: 30000` is always 30 s (not conditional) because it only applies when `enabled` is `true`. Rationale: keeps `usePolling` generic; the hook's `enabled` and `interval` props already support this contract without modification.
- **Refresh button in `GameStatusBar`, not `GameBoard`:** Turn/connection status is already communicated there. Adding `onRefresh` and `isRefreshing` props keeps `GameBoard` unchanged.
- **`isRefreshing` local state is required for re-fetch in-flight state:** `loading` from `usePolling` is only `true` until the first fetch completes and is never reset to `true` on subsequent polls or manual refetches. Therefore `loading` alone cannot disable the button during a re-fetch. In `game-page.tsx`, wrap `refetch` in a small async handler that sets/clears an `isRefreshing` boolean (`useState`) around the `await refetch()` call. Pass `isRefreshing` to `GameStatusBar` as the prop that disables the button. `loading` is not passed to `GameStatusBar` — `isRefreshing` covers both initial-load and re-fetch cases adequately for this button.
- **Button copy deferred to implementation:** "Refresh" is the working assumption; a refresh icon (e.g., ↻) is a reasonable alternative. Resolve at implementation time with the 44 px touch-target constraint in mind.

## Open Questions

### Resolved During Planning

- **Should the 30s fallback also pause on hidden tabs?** The existing `visibilitychange` handler in `usePolling` already pauses polling while the tab is hidden and triggers one immediate fetch on return. This applies regardless of the configured interval — no additional work needed.
- **`loading` for in-flight state on re-fetches:** Resolved — `isRefreshing` local state (not `loading`) is the button's disabled guard. See Key Technical Decisions.

### Deferred to Implementation

- Exact prop signature additions to `GameStatusBar` for `onRefresh` and `isRefreshing`
- Button copy / icon choice (working assumption: "Refresh" text or ↻ icon, 44 px min touch target)
- Exact Tailwind classes for the button's default, loading, and disabled states (follow existing pill styling in `game-status-bar.tsx`)

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### Turn-aware polling decision matrix

| `myTurn` | `completed` | `enabled` passed to `usePolling` | `interval` passed | Refresh button |
|---|---|---|---|---|
| `true` | `false` | `false` | — (irrelevant) | Hidden |
| `false` | `false` | `true` | `30000` | Visible |
| `*` | `true` | `false` | — (irrelevant) | Hidden |

### Component data flow

```
game-page.tsx
  useGameState({ gameId, enabled: !myTurn && !completed, interval: 30000 })
    → { myTurn, completed, loading, refetch, ... }
  
  const [isRefreshing, setIsRefreshing] = useState(false)
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refetch()
    setIsRefreshing(false)
  }

  <GameStatusBar
    myTurn={myTurn}
    completed={!!completed}
    isRefreshing={isRefreshing}
    onRefresh={handleRefresh}
    ...existing props...
  />
    → shows "Your turn" pill when myTurn
    → shows "Refresh" button (calls onRefresh, disabled when isRefreshing) when !myTurn && !completed
    → shows nothing in that slot when completed

  <GameBoard
    onActionComplete={refetch}   ← unchanged
    ...
  />
```

## Implementation Units

- [ ] **Unit 1: Make polling turn-aware in `useGameState` and `game-page.tsx`**

  **Goal:** Stop background polling while it's the player's turn and slow it to 30 seconds while waiting; wire `isRefreshing` state and `onRefresh` handler for the refresh button.

  **Requirements:** R1, R2, R5, R6

  **Dependencies:** None

  **Files:**
  - Modify: `lib/hooks/use-game-state.ts`
  - Modify: `app/games/[gameId]/game-page.tsx`

  **Approach:**
  - `useGameState` needs to accept (or derive internally) an `enabled` param separate from the auth gate, so the caller can disable the timer for turn-based reasons. The simplest path: add an optional `enabled` option that defaults to `true` and is ANDed with `!!playerId` when passed to `usePolling`.
  - In `game-page.tsx`, derive `enabled = !myTurn && !completed` and `interval = 30000`, then pass them to `useGameState`. Because `myTurn` is derived from the game data that `useGameState` returns, and `useGameState` uses `enabled` to control polling, this creates a reactive loop: when `myTurn` flips to `false` (opponent took their turn), `enabled` becomes `true`, which restarts polling immediately. When `myTurn` flips to `true`, `enabled` becomes `false`, which stops polling.
  - The initial render has `myTurn = false` (no game data yet) so `enabled` starts `true` — polling fires immediately on mount, which is correct.

  **Patterns to follow:**
  - Existing `enabled: !!playerId` auth gate in `lib/hooks/use-game-state.ts`
  - Existing `interval` forwarding pattern in `lib/hooks/use-game-state.ts`

  **Test scenarios:**
  - Happy path: when `myTurn` is false and game is not completed, `usePolling` is called with `enabled: true` and `interval: 30000`
  - Happy path: when `myTurn` is true, `usePolling` is called with `enabled: false`
  - Happy path: when `completed` is truthy, `usePolling` is called with `enabled: false`
  - Edge case: initial render before first fetch (`myTurn` defaults to false) — polling fires immediately on mount
  - Integration: flipping `myTurn` from `true` to `false` (opponent acts) causes an immediate refetch and restarts the 30-second loop
  - Edge case: `enabled: false` passed by caller + authenticated user → `usePolling` receives `enabled: false` (AND-gate: caller flag ANDed with `!!playerId`)
  - Edge case: `enabled: true` passed by caller + unauthenticated user → `usePolling` receives `enabled: false` (auth gate still wins)

  **Verification:**
  - Unit tests for `useGameState` cover the three `enabled`/`interval` combinations in the decision matrix
  - `onActionComplete` (refetch) still fires in `game-page.tsx` after actions — no regression

---

- [ ] **Unit 2: Add "Refresh" button to `GameStatusBar`**

  **Goal:** Replace the "Your turn" / "Waiting for…" pill slot with a manual refresh button when it is not the player's turn (and the game is not over).

  **Requirements:** R3, R4

  **Dependencies:** Unit 1 (requires `onRefresh` prop to be plumbed from `game-page.tsx`)

  **Files:**
  - Modify: `components/game/game-status-bar.tsx`

  **Approach:**
  - Add `onRefresh: () => void` and `isRefreshing: boolean` props to `GameStatusBarProps`.
  - In the pill slot: when `myTurn` is true, render "Your turn" as today; when `myTurn` is false and game is not completed, render a button that calls `onRefresh` and is disabled when `isRefreshing` is true.
  - The button must meet the 44 px minimum touch target (match existing pill height or use `min-h-[44px] min-w-[44px]`).
  - Explicitly gate hover and cursor CSS classes on a `disabled` variable (not CSS `disabled` alone) per the institutional learning.
  - If `GameStatusBar` is currently a server component, add `'use client'` — it will need an event handler.

  **Patterns to follow:**
  - Existing pill styling in `components/game/game-status-bar.tsx` (lines 62–71)
  - `disabled` hover-gating pattern from `docs/solutions/ui-bugs/game-ui-rendering-and-style-fixes-2026-04-19.md`
  - 44 px touch-target convention from `AGENTS.md`

  **Test scenarios:**
  - Happy path: renders "Your turn" pill when `myTurn` is true
  - Happy path: renders a Refresh button (not "Your turn") when `myTurn` is false and `completed` is false
  - Happy path: renders neither (or a completed state) when game is completed
  - Happy path: clicking Refresh button calls `onRefresh` once
  - Error path: button is disabled and shows loading indicator when `isRefreshing` is true
  - Edge case: clicking button while already refreshing (`isRefreshing: true`) does not call `onRefresh` a second time
  - Edge case: button has at least 44 px height (verify via rendered class or snapshot)

  **Verification:**
  - Visual inspection in dev: button appears in the status bar when waiting, disappears when it's your turn
  - Tests pass for all seven scenarios above

---

- [ ] **Unit 3: Update `use-polling.ts` tests to cover new `enabled`/`interval` behavior (if needed)**

  **Goal:** Ensure the polling hook's test suite covers the reactive `interval` and `enabled` contracts that Units 1–2 rely on.

  **Requirements:** R7

  **Dependencies:** Unit 1

  **Files:**
  - Modify: `lib/hooks/__tests__/use-polling.test.ts`

  **Approach:**
  - Review existing test coverage. The current suite already covers `enabled: false` (no-poll test) and interval timing. Gaps to fill:
    - Changing `interval` mid-lifecycle (via `renderHook` `rerender`) causes the old timer to cancel and a new loop to start at the new interval
    - Changing `enabled` from `false` to `true` triggers an immediate fetch
  - Add these as new `it` blocks following existing fake-timer patterns.

  **Patterns to follow:**
  - `lib/hooks/__tests__/use-polling.test.ts` — `renderHook` with `rerender`, `vi.advanceTimersByTimeAsync`, `await act(async () => {...})`

  **Test scenarios:**
  - Changing `interval` from 3000 to 30000 mid-lifecycle causes the next tick to fire at the new interval, not the old one
  - Changing `enabled` from `false` to `true` triggers one immediate fetch and then the interval loop

  **Verification:**
  - `npm test` (or `npx vitest run`) passes with no regressions on existing tests and new tests green

## System-Wide Impact

- **Interaction graph:** `usePolling` ← `useGameState` ← `game-page.tsx` ← `GameStatusBar`. Only this chain is affected. `GameBoard`, `useSuggestions`, `ScoreBoard`, and all other components are unchanged.
- **Error propagation:** `isStale` behavior is unchanged — the hook sets it on fetch failure and shows "Reconnecting…" regardless of interval. The manual refresh button and the `isStale` pill coexist in the status bar.
- **Concurrent fetch race during turn transition:** When `myTurn` flips `false` (opponent acted), polling restarts immediately. If the user also clicks Refresh during that in-flight poll, two fetches race. The last response to resolve wins and calls `setData` — this is benign because both fetches return the same authoritative server state. No deduplication is needed; the `isRefreshing` flag prevents the user from triggering a *third* overlapping fetch via the button.
- **API surface parity:** No API changes. `usePolling` and `useGameState` signatures gain optional props only — no breaking changes to callers.
- **Integration coverage:** The key integration scenario — "opponent acts → `myTurn` becomes false → polling restarts → game state updates" — cannot be fully proven by unit tests alone. An end-to-end or manual test covering a two-player turn cycle covers this.
- **Unchanged invariants:** `onActionComplete={refetch}` in `game-page.tsx` fires immediately after every player action regardless of polling state. This is not touched.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `myTurn` starts as `false` on initial render, causing one immediate fetch before game data loads | Intentional and correct — the poll on mount fetches the initial game state |
| Reactive `enabled` loop between `myTurn` (derived from poll result) and poll `enabled` flag causes infinite re-renders | `myTurn` only changes when `game` data changes; `enabled` is a computed value, not `setState` — no render loop |
| Button touch target too small on mobile | Enforce `min-h-[44px]` in implementation per AGENTS.md convention |
| `loading` from `usePolling` only reflects the initial load, not re-fetch in-flight | `isRefreshing` local state in `game-page.tsx` wraps `refetch` with set/clear around the async call; passed as the button's disabled prop |

## Sources & References

- **Origin document:** [`docs/brainstorms/polling-manual-refresh-requirements.md`](docs/brainstorms/polling-manual-refresh-requirements.md)
- Related code: `lib/hooks/use-polling.ts`, `lib/hooks/use-game-state.ts`, `components/game/game-status-bar.tsx`, `app/games/[gameId]/game-page.tsx`
- Institutional learnings: `docs/solutions/best-practices/use-client-directive-ssr-migration-2026-04-19.md`, `docs/solutions/ui-bugs/game-ui-rendering-and-style-fixes-2026-04-19.md`
