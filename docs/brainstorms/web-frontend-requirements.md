# Hundred and Ten Web Frontend

**Date:** 2026-04-18
**Status:** Draft
**Scope:** Deep — greenfield frontend app with auth, multiple views, game interaction, and infrastructure

## Problem

Hundred and Ten has a backend API but no web frontend. Players currently have no way to play the game through a browser. The goal is to create a web app that lets a small group of friends sign in, create lobbies, and play games of Hundred and Ten.

## Users

- **Primary:** Friends and family who already know Hundred and Ten
- **Future:** Broader audience (may need onboarding/rules reference later, out of scope for MVP)

## MVP Scope (Core Loop)

The first deployable version covers the minimum path to play a game:

1. **Sign in** — Firebase auth with Google sign-in. After sign-in, the app calls `PUT /players/{player_id}` (where `player_id` is the Firebase UID) to register/refresh the player in the backend before any other API call. All API paths use the Firebase UID as `player_id`.
2. **Create lobby** — Name the lobby, set accessibility (public/private)
3. **View lobby** — See who's in the lobby, invite players by searching for them (search uses the player search API). The backend auto-fills lobbies to 4 players with CPU opponents when the game starts.
4. **Join lobby** — Join a lobby you've been invited to or that is public
5. **Start game** — Lobby organizer starts the game when ready. The start endpoint returns events; the frontend searches for the created game to navigate to the game view.
6. **Play game** — Full game interaction: bidding, selecting trump, discarding, playing cards, viewing tricks, seeing scores. The API provides move suggestions that the UI surfaces as optional hints.
7. **Game completion** — See winner and final scores

### Game Play Details

The game has distinct phases that the UI must handle:

- **Bidding** — Each player bids or passes. The UI shows whose turn it is and the current highest bid.
- **Trump selection** — The winning bidder selects a trump suit.
- **Discarding** — Players discard cards from their hand.
- **Trick play** — Players play one card per trick. The UI shows cards played, the winning play, and whether the trick is "bleeding."
- **Round/game end** — Scores are shown per round. Game ends when a player reaches the winning score.

The API supports **queued actions** — players can pre-select their move before it's their turn. Deferred to post-MVP.

The API provides **suggestions** — AI-recommended moves. The MVP should surface these as optional hints (e.g., a subtle indicator on suggested cards/actions, togglable by the player).

### Game State Updates

- **MVP:** Poll the API on an interval (start at 3-5 seconds, tune based on experience) when it's not the current player's turn. On polling failure, show a non-blocking indicator that the connection is stale and continue polling with backoff. A 401 during polling triggers the token refresh flow. On tab re-focus after being backgrounded, poll immediately.
- **Later:** Real-time push (websockets/SSE) — requires backend changes

### Auth & Token Handling

- Firebase tokens expire after 1 hour. The frontend must use Firebase SDK's automatic token refresh and attach a fresh token to each API request.
- On 401 response from the API, attempt a token refresh and retry once. If still failing, redirect to sign-in.

### Layout

- Responsive design targeting both desktop and mobile equally. Card game UI must be readable and playable on phone screens.

### Error Handling

- The backend enforces all authorization (who can invite, start, play). The frontend displays user-friendly error messages when actions are rejected (not raw API responses). Expected access model: any authenticated user can create a lobby; only the organizer can invite or start; invited users or any user (for public lobbies) can join.

## Deferred (Post-MVP)

**Discovery & Social**
- Browse/search public lobbies
- Player profiles
- Lobby chat
- Spectator mode

**Gameplay & Polish**
- Queued actions (pre-select moves before your turn)
- Game history (search past games)
- Rules reference / onboarding for new players
- Visual polish (card graphics, animations, transitions)
- Proactive authorization (hide/disable actions the user can't take instead of relying on error messages)

**Infrastructure**
- Real-time push updates

## Technical Constraints

- **Stack:** Next.js, TypeScript, Tailwind CSS, static export (matching existing projects: `real-true-science-facts`, `siobhan-oca`). Static export means all data fetching, auth, and polling happen client-side — no Next.js API routes, middleware, or server components.
- **Auth:** Firebase (existing project), Google sign-in only, passes Firebase ID token as bearer to API. Tokens are managed in-memory by the Firebase SDK (not persisted to localStorage).
- **Backend API:** `https://hundredandten.azurewebsites.net` — FastAPI, bearer token auth, request/response only. The API base URL should be environment-configurable via Next.js env vars.
- **Deployment:** Azure Static Web App via OpenTofu, same Azure subscription as the serverless backend but a separate resource group
- **Infrastructure patterns:** Follow OpenTofu patterns from `real-true-science-facts` and `siobhan-oca` (azurerm provider, Azure Storage state backend)

## Success Criteria

1. A user can sign in with Google, create a lobby, invite a friend, start a game, and play it to completion
2. The app is deployed and accessible via a public URL
3. Game state stays in sync across players within a reasonable polling interval
4. The UI clearly communicates whose turn it is, what actions are available, and the current game state

## Open Questions

- Custom domain needed for MVP, or is the Azure Static Web App default URL sufficient? (Note: CORS configuration on the backend depends on knowing the frontend origin.)
- Should the OpenTofu state live in the same storage account as the serverless backend's state, or a separate one?
- How does the frontend obtain the game ID after starting a game? (The start endpoint returns events, not a game object. Need to verify if events contain a game reference or if a game search is needed.)

## Prerequisites

- Backend API CORS must be configured to allow the frontend's origin (handled outside this project)

## Reference

- **API docs:** https://hundredandten.azurewebsites.net/docs
- **Backend source:** `~/git/hundred-and-ten-serverless`
- **Game logic:** `~/git/hundred-and-ten`
- **Stack reference projects:** `~/git/real-true-science-facts`, `~/git/siobhan-oca`
