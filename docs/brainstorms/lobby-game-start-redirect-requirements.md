---
date: 2026-04-25
topic: lobby-game-start-redirect
---

# Lobby Game-Start Redirect

## Problem Frame

When the organizer starts a game from the lobby detail page, only the organizer is navigated to the game screen (`routes/lobbies/$lobbyId.tsx:96`). Every other player viewing that lobby sees a dead screen with no indication the game has started and no way to reach it without manually navigating. The lobby detail page fetches data once on mount and never again.

## Requirements

- The lobby detail page polls for game start while the player is viewing it
- When game start is detected, the player is automatically redirected to `/games/$gameId` (where `gameId === lobbyId`, per existing convention)
- Polling reuses the existing `usePolling` hook (`lib/hooks/use-polling.ts`)
- Polling interval should be reasonable for a "waiting room" scenario (exact interval is a planning decision)
- Polling stops once the redirect fires or the player navigates away

## Success Criteria

- A non-organizer player viewing a lobby is automatically taken to the game when the organizer starts it, with no manual action required
- No regressions to the organizer's existing start-game flow
- No new polling on pages other than the lobby detail

## Scope Boundaries

- Lobby list page (`/lobbies`) does not detect game starts -- players must click into a lobby first
- No SSE or WebSocket implementation (polling only, consistent with current game-page approach)
- No visual "game starting" transition or countdown -- immediate redirect is sufficient
- No polling for other lobby changes (new players joining, invites) -- only game start detection

## Dependencies / Assumptions

- The backend provides a detectable signal when a lobby has become a game (e.g., lobby endpoint returns an error, or the game endpoint succeeds for that ID). The exact detection mechanism is a planning detail.
- `gameId === lobbyId` continues to hold (verified in `routes/lobbies/$lobbyId.tsx:96`)

## Next Steps

-> `/ce-plan` for structured implementation planning
