---
title: Manual Refresh Button (Polling Reduction MVP)
date: 2026-04-21
status: draft
---

# Manual Refresh Button — Polling Reduction MVP

## Problem

The current polling hook (`lib/hooks/use-polling.ts`) fetches game state every 3 seconds for all connected clients. Until SSE is available, this creates unnecessary server load — especially for players who are waiting on opponents and not taking any action.

## Goal

Reduce server polling load for the MVP by tying the refresh cadence to turn state, giving idle players a manual refresh button instead of continuous 3-second polling.

## Key Insight

Polling is only wasteful when it is **not** the current player's turn. When it is their turn, game state is already fresh (fetched after the last action via `onActionComplete`). The heaviest load comes from all opponents polling every 3 seconds while waiting.

## Scope

### In scope
- Disable the active poll timer for the entire duration that it **is** the current player's turn (level-based, not edge-triggered — polling stays off until the player acts and the turn changes)
- Reduce the background poll interval to 30 seconds when it is **not** the current player's turn (safety net / tab-restore fallback)
- Add a manual "Refresh" button visible in the same location as the "Your turn" indicator, shown only when it is **not** the player's turn
- The button triggers `refetch` from `useGameState`
- Tab-focus and online-event triggered refreshes (already in the hook) are retained as-is

### Out of scope
- SSE or WebSocket implementation
- Polling on any page other than the game board
- Per-user configurable polling intervals
- Animations or loading skeletons beyond what already exists

## Behavior

| State | Auto poll | Manual button |
|---|---|---|
| Your turn | Off | Hidden |
| Not your turn | Every 30s | Visible |
- Game completed | Off | Hidden — game completion is detected via the `completed` boolean derived in `lib/hooks/use-game-state.ts`

The "Refresh" button occupies the same location as the "Your turn" indicator — the two states are mutually exclusive, so the button replaces that indicator when it is not the player's turn. It must meet the 44px minimum touch target.

While a refresh is in-flight, the button shows a loading state and is disabled to prevent double-fetches.

## Success Criteria

- Server polling requests drop substantially for games with 2+ players waiting
- Players waiting on opponents can manually refresh at will
- No regressions in action-driven refreshes (`onActionComplete` still fires immediately)
- Existing unit tests for `use-polling.ts` continue to pass; new behavior is covered

## Files Likely Affected

- `lib/hooks/use-polling.ts` — expose or accept a configurable interval; support disabling the timer
- `lib/hooks/use-game-state.ts` — pass turn-aware `enabled`/`interval` to the polling hook
- `app/games/[gameId]/game-page.tsx` — wire refresh button visibility to `myTurn`
- Relevant component in the game board where "Your turn" is currently displayed

## Open Questions

1. Should the 30-second fallback poll also be disabled when the browser tab is hidden (in addition to the existing visibility handler)? The current hook already pauses on hidden tabs, so this may be free.
2. What copy should the button use — "Refresh", "Check for updates", or an icon-only button?
