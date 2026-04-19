# Hundred and Ten Web Frontend — Implementation Plan

**Date:** 2026-04-18
**Origin:** docs/brainstorms/web-frontend-requirements.md
**Scope:** Deep — greenfield frontend with auth, game interaction, infrastructure
**Status:** Reviewed

## Resolved Questions

| Question | Decision |
|----------|----------|
| Custom domain for MVP? | No — use Azure Static Web App default URL. Add custom domain post-MVP. |
| OpenTofu state storage? | Share backend's storage (RG `tofu`, account `tofuinfra`, container `state`) with a separate key. |
| Game ID after lobby start? | Game ID = Lobby ID. No search needed; frontend already knows the ID. |

## Technical Decisions

### Stack
- **Next.js 16** with React 19, TypeScript 6, Tailwind CSS v4
- **Static export** (`output: 'export'`) — no server components, no API routes, no middleware
- **Node 22** (`.nvmrc`)
- **No `src/` directory** — `app/` at repo root, components co-located or in `components/`
- **Path alias:** `@/*` maps to `./*`

### Tailwind v4
- Configured via CSS: `@import 'tailwindcss'` + `@theme {}` block in `app/globals.css`
- PostCSS plugin: `@tailwindcss/postcss`
- No `tailwind.config.js`

### Auth
- **Firebase SDK** (client-side only) with Google sign-in
- Firebase project: `hundred-and-ten`
- Tokens managed in-memory by Firebase SDK
- Token attached as `Authorization: Bearer <id_token>` to every API call
- On 401: refresh token + retry once; if still failing, redirect to sign-in (preserving return URL as `/?returnTo=<current_path>`)
- On sign-in, call `PUT /players/{uid}` to register/refresh player before any other API call
- After sign-in, navigate to `returnTo` query param if present, otherwise `/lobbies`

### API Client
- Thin typed wrapper around `fetch` for the backend API
- Base URL configurable via `NEXT_PUBLIC_API_URL` env var (no hardcoded default — must be set per environment)
- All endpoints scoped under `/players/{player_id}/...`
- Response types modeled as TypeScript interfaces matching backend schemas
- Centralized error handling: parse backend error responses into user-friendly messages
- **Authorization note:** The backend enforces all authorization (who can invite, start, play). Frontend UI conditionally shows/hides actions based on role (organizer, member, invitee) but this is cosmetic — the backend is the source of truth.

### State Management
- **React Context + useReducer** for auth state (user, loading, error)
- **Per-component data fetching** with `useState`/`useEffect` for API data
- **Polling hook** (`usePolling`) for game state — configurable interval with backoff on failure
- No global state library (app is simple enough without one)

### Polling Strategy
- Default interval: 3 seconds when it's not the current player's turn
- When it's the current player's turn: pause polling (resume after action)
- On failure: exponential backoff (3s → 6s → 12s → cap at 30s), show stale indicator
- On tab re-focus: immediate poll via `visibilitychange` event
- On network recovery: immediate poll via `online` event
- On successful player action: immediate refetch (optimistic-ish)
- On 401 during poll: trigger token refresh flow

### Infrastructure
- **Azure Static Web App** via OpenTofu (azurerm ~>3.0, github ~>6.0 providers)
- `infrastructure/` directory with `main.tf`, `site.tf`, `github.tf`
- `site.tf` creates a dedicated `azurerm_resource_group` (location: `eastus2`) + `azurerm_static_web_app`
- `github.tf` creates both `github_actions_secret` and `github_dependabot_secret` for the deployment token
- State backend: Azure Storage (`tofuinfra` account, `state` container, key: `hundred-and-ten-web.tfstate`)
- GitHub Actions with `Azure/static-web-apps-deploy@v1`, builds to `out/`
- Workflow triggers on push to `main` + PR events (opened, synchronize, reopened, closed)
- Workflow includes a `close_pull_request_job` to tear down PR staging environments
- Workflow sets `permissions: { contents: read, pull-requests: write }`

## Architecture

### Directory Structure

```
app/
  layout.tsx              # Root layout, font loading, global providers
  globals.css             # Tailwind v4 config (@import, @theme)
  page.tsx                # Landing / sign-in page
  lobbies/
    page.tsx              # Lobby list (invites + public)
    new/
      page.tsx            # Create lobby form
    [lobbyId]/
      page.tsx            # Lobby detail (members, invite, start)
  games/
    [gameId]/
      page.tsx            # Game view (bidding, trump, discard, tricks, results)
components/
  auth/
    auth-provider.tsx     # Firebase auth context provider
    sign-in-button.tsx
    require-auth.tsx      # Wrapper that redirects unauthenticated users
  lobby/
    lobby-card.tsx        # Lobby summary for list view
    player-search.tsx     # Search + invite players
    member-list.tsx       # Show lobby members
  game/
    game-board.tsx        # Main game layout (dispatches to phase components)
    hand.tsx              # Player's hand (card display + selection)
    card.tsx              # Single card component
    bid-controls.tsx      # Bidding UI
    trump-selector.tsx    # Trump suit selection
    discard-controls.tsx  # Discard selection UI
    trick-area.tsx        # Current trick display
    score-board.tsx       # Scores per player
    suggestion-hint.tsx   # Visual hint for AI suggestions
    game-status-bar.tsx   # Whose turn, current phase, stale indicator
lib/
  api/
    client.ts             # Fetch wrapper with auth headers, error handling
    types.ts              # TypeScript interfaces for API request/response shapes
    lobbies.ts            # Lobby endpoints (create, get, search, join, invite, start)
    games.ts              # Game endpoints (get, action, suggestions)
    players.ts            # Player endpoints (put, search)
  firebase.ts             # Firebase app init + auth instance
  hooks/
    use-auth.ts           # Hook to access auth context
    use-polling.ts        # Polling hook with backoff, visibility, stale detection
    use-game-state.ts     # Combines game fetch + polling + phase detection
    use-lobbies.ts        # Fetch + poll lobby list
infrastructure/
  main.tf                 # Provider config, state backend
  site.tf                 # Azure Static Web App resource
  github.tf               # GitHub Actions deployment secret
.github/
  workflows/
    deploy.yml            # Build + deploy via Azure Static Web Apps
```

### Key Type Definitions

```typescript
// API response shapes (lib/api/types.ts)

type GameStatus = 'BIDDING' | 'TRUMP_SELECTION' | 'DISCARD' | 'TRICKS' | 'WON';
type Suit = 'HEARTS' | 'DIAMONDS' | 'CLUBS' | 'SPADES' | 'JOKER';
type SelectableSuit = 'HEARTS' | 'DIAMONDS' | 'CLUBS' | 'SPADES';  // for trump selection
type CardNumber = 'TWO' | 'THREE' | 'FOUR' | 'FIVE' | 'SIX' | 'SEVEN' | 'EIGHT'
  | 'NINE' | 'TEN' | 'JACK' | 'QUEEN' | 'KING' | 'ACE' | 'JOKER';
type BidValue = 0 | 15 | 20 | 25 | 30 | 60;  // 0 = Pass, 60 = Shoot the Moon

interface Card {
  number: CardNumber;  // string enum, not numeric
  suit: Suit;
}

interface Player {
  id: string;
  name: string;
  picture_url: string | null;
}

interface PlayerInGame {
  id: string;
  type: 'human' | 'cpu-easy';  // player type
}

// The current player's view in an active round
interface SelfInRound extends PlayerInGame {
  hand: Card[];
}

// Other players' view in an active round (hand is redacted)
interface OtherPlayerInRound extends PlayerInGame {
  hand_size: number;
}

type PlayerInRound = SelfInRound | OtherPlayerInRound;

// Backend returns a discriminated union — three distinct game shapes:

// Lobby (game not yet started)
interface WaitingGame {
  id: string;
  name: string;
  accessibility: 'PUBLIC' | 'PRIVATE';
  organizer: PlayerInGame;       // object, not string ID
  players: PlayerInGame[];       // excludes organizer
  invitees: PlayerInGame[];      // excludes already-joined players
}

// Active game (current round state — flat, no nested rounds)
interface StartedGame {
  id: string;
  name: string;
  status: GameStatus;
  scores: Record<string, number>;
  dealer_player_id: string;
  bidder_player_id: string | null;
  bid_amount: number | null;
  trump: SelectableSuit | null;
  active_player_id: string | null;
  players: PlayerInRound[];      // self has hand, others have hand_size
  tricks: Trick[];
}

interface Trick {
  bleeding: boolean;
  plays: PlayCard[];
  winning_play: PlayCard | null;
}

interface PlayCard {
  type: 'PLAY';
  player_id: string;
  card: Card;
}

// Completed game
interface CompletedGame {
  id: string;
  name: string;
  status: 'WON';
  scores: Record<string, number>;
  winner: PlayerInGame;
  organizer: PlayerInGame;
  players: PlayerInGame[];
}

// Action request bodies (discriminated union on `type`)
type GameAction =
  | { type: 'BID'; amount: BidValue }
  | { type: 'SELECT_TRUMP'; suit: SelectableSuit }
  | { type: 'DISCARD'; cards: Card[] }
  | { type: 'PLAY'; card: Card };

// Action and start-game responses return Event[], not the updated game.
// The frontend must re-fetch game state after performing an action.

// Suggestions response: list of possible actions
type Suggestion =
  | { type: 'BID'; player_id: string; amount: BidValue }
  | { type: 'SELECT_TRUMP'; player_id: string; suit: SelectableSuit }
  | { type: 'DISCARD'; player_id: string; cards: Card[] }
  | { type: 'PLAY'; player_id: string; card: Card };
```

**API endpoint notes:**
- Search endpoints (`searchLobbies`, `searchPlayers`) are **POST** with JSON body `{ searchText, offset, limit }`, not GET
- `performAction` and `startGame` return `Event[]`, not the game/lobby — frontend must re-fetch after these calls
- GET `/players/{pid}/lobbies/{id}/players` and GET `/players/{pid}/games/{id}/players` return full `Player[]` with names/pictures (use these to resolve `PlayerInGame` IDs to display names)

## Implementation Units

### Unit 0: Project Scaffolding
**Depends on:** Nothing
**Delivers:** Buildable, deployable empty app

1. `npx create-next-app@latest` with TypeScript, Tailwind, ESLint, App Router, no `src/`
2. Configure `next.config.ts`: `output: 'export'`
3. Set up Tailwind v4 (`globals.css` with `@import 'tailwindcss'`, `@theme {}`)
4. Configure PostCSS with `@tailwindcss/postcss`
5. Add `.nvmrc` with `22.22.0`
6. Add path alias `@/*` → `./*` in `tsconfig.json`
7. ESLint 9 flat config with prettier
8. Add `.env.local.example` with `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_FIREBASE_*` vars
9. Add `public/staticwebapp.config.json` with `navigationFallback` for SPA routing and `Content-Security-Policy` header to mitigate XSS
10. Verify: `npm run build` produces `out/` directory

### Unit 1: Infrastructure
**Depends on:** Unit 0
**Delivers:** App deployed to Azure Static Web App URL

1. Create `infrastructure/main.tf` — azurerm ~>3.0 + github ~>6.0 providers, state backend config
2. Create `infrastructure/site.tf` — `azurerm_resource_group` (eastus2) + `azurerm_static_web_app` resource
3. Create `infrastructure/github.tf` — `github_actions_secret` + `github_dependabot_secret` for deployment token
4. Create `.github/workflows/deploy.yml` — two jobs: build_and_deploy (triggers on push to main + PR events) + close_pull_request (triggers on PR closed). Uses `Azure/static-web-apps-deploy@v1` with `app_location: "."`, `output_location: "out"`. Sets `permissions: { contents: read, pull-requests: write }`.
5. Run `tofu init && tofu plan` to validate
6. Deploy and verify default page loads at the generated URL

### Unit 2: Firebase Auth
**Depends on:** Unit 0
**Delivers:** Sign in/out with Google, auth context available to all pages

1. Install `firebase` SDK
2. Create `lib/firebase.ts` — initialize app with env vars, export auth instance
3. Create `components/auth/auth-provider.tsx` — React context providing `{ user, loading, signIn, signOut }`
4. Create `components/auth/sign-in-button.tsx` — Google sign-in popup trigger
5. Create `components/auth/require-auth.tsx` — wrapper component redirecting to `/` if not authenticated
6. Create `app/page.tsx` — landing page with sign-in button; redirect to `/lobbies` if already signed in
7. Wire `auth-provider` into `app/layout.tsx`
8. Verify: can sign in with Google, see user info, sign out
9. Configure Firebase Console: add the Static Web App URL to authorized domains (prevents auth from arbitrary origins)

### Unit 3: API Client
**Depends on:** Unit 2
**Delivers:** Typed API client with auth, error handling, player registration

1. Create `lib/api/types.ts` — TypeScript interfaces for all API shapes
2. Create `lib/api/client.ts` — fetch wrapper that:
   - Attaches `Authorization: Bearer <token>` (gets fresh token from Firebase on each call)
   - Parses JSON responses
   - On 401: refresh token + retry once
   - On error: maps backend error detail to user-friendly string
   - **Unit tests required:** mock fetch, verify auth header attachment, 401 retry logic
3. Create `lib/api/players.ts` — `putPlayer(id)`, `searchPlayers(query)` (POST with `{ searchText, offset, limit }`)
4. Create `lib/api/lobbies.ts` — `createLobby()`, `getLobby(id)`, `searchLobbies()` (POST), `joinLobby(id)`, `invitePlayer(lobbyId, playerId)`, `startGame(lobbyId)` (returns `Event[]`, re-fetch game after), `getLobbyPlayers(id)` (resolves PlayerInGame IDs to full Player objects)
5. Create `lib/api/games.ts` — `getGame(id)` (returns `StartedGame | CompletedGame`), `performAction(gameId, action)` (returns `Event[]`, re-fetch game after), `getSuggestions(gameId)` (returns `Suggestion[]`), `getGamePlayers(id)`
6. Add player registration call (`putPlayer`) to auth flow — after sign-in, before navigating to `/lobbies`
7. Verify: after sign-in, player is registered in backend. Validate type definitions by comparing actual API responses against TypeScript interfaces (check field names, shapes, enum values).

### Unit 4: Lobby Views
**Depends on:** Unit 3
**Delivers:** Create, view, join, invite in lobbies

1. Create `app/lobbies/page.tsx` — list of lobbies (invites + public). Uses `searchLobbies()`, client-side filters invitee lobbies to top.
2. Create `components/lobby/lobby-card.tsx` — summary card (name, player count, accessibility badge)
3. Create `app/lobbies/new/page.tsx` — form: lobby name + public/private toggle. On submit, calls `createLobby()`, navigates to lobby detail.
4. Create `app/lobbies/[lobbyId]/page.tsx` — lobby detail view:
   - Shows members and invitees
   - If organizer: player search + invite button, start game button
   - If not a member: join button (for public or if invitee)
5. Create `components/lobby/player-search.tsx` — search input, debounced call to `searchPlayers()`, result list with invite action
6. Create `components/lobby/member-list.tsx` — list of current players + pending invitees
7. Wrap all lobby pages in `require-auth`
8. On "Start Game": call `startGame(lobbyId)`, navigate to `/games/{lobbyId}` (game ID = lobby ID)
9. Verify: full flow — create lobby, invite player, start game navigates to game URL

### Unit 5: Game View — Core
**Depends on:** Unit 3
**Delivers:** Game board that renders all phases, with polling

**Mobile layout strategy:** Build mobile-first from the start. Cards use fluid sizing (min 44px touch target). Hand overflows horizontally with scroll. Game layout stacks vertically on narrow screens (status bar → trick area → hand → controls). Breakpoint at 640px for side-by-side layout on desktop.

1. Create `lib/hooks/use-polling.ts` — generic polling hook:
   - Configurable interval (default 3s)
   - Exponential backoff on error (cap 30s)
   - `visibilitychange` re-focus trigger
   - `online` event listener for network recovery
   - Returns `{ data, loading, error, isStale, refetch }`
   - **Unit tests required:** mock timers, visibility API, backoff behavior
2. Create `lib/hooks/use-game-state.ts` — wraps `usePolling` + `getGame()`:
   - Game response is flat (`StartedGame` or `CompletedGame`), not nested rounds
   - Derives active player, phase, current player's hand from the `players` array
   - Pauses polling when it's the current player's turn
   - Calls `refetch` after player action
3. Create `app/games/[gameId]/page.tsx` — game page, wraps in `require-auth`, uses `useGameState`
4. Create `components/game/game-board.tsx` — layout component that switches on game phase:
   - BIDDING → bid controls + hand display
   - TRUMP_SELECTION → trump selector
   - DISCARD → hand with discard selection
   - TRICKS → trick area + hand for card play
   - WON → final scores
5. Create `components/game/game-status-bar.tsx` — shows current phase, whose turn, stale connection indicator
6. Create `components/game/score-board.tsx` — player scores table
7. Verify: can load a game, see correct phase, status bar updates

### Unit 6: Game View — Interaction
**Depends on:** Unit 5
**Delivers:** Full playable game

1. Create `components/game/hand.tsx` — displays player's cards, supports selection (single for play, multiple for discard)
2. Create `components/game/card.tsx` — individual card display (CardNumber string + suit, color-coded, handles Joker)
3. Create `components/game/bid-controls.tsx` — bid value buttons (15, 20, 25, 30, 60, Pass). Disables values ≤ current bid.
4. Create `components/game/trump-selector.tsx` — four suit buttons
5. Create `components/game/discard-controls.tsx` — hand with multi-select + confirm discard button
6. Create `components/game/trick-area.tsx` — shows cards played in current trick, winning card highlighted, bleeding indicator
7. Wire all interaction components to call `performAction()` → refetch game state
   - Disable all action controls while a request is in flight (prevent double-submission)
   - Show a confirmation step before discard (multi-card, irreversible)
   - On success: immediately show the updated game state from refetch
8. Handle action errors: show inline error message (e.g., "It's not your turn", "Invalid bid")
9. Verify: can play a full game from bidding through to WON status

### Unit 7: Suggestions
**Depends on:** Unit 6
**Delivers:** AI hint display on suggested moves

1. Create `components/game/suggestion-hint.tsx` — subtle visual indicator (e.g., glow/border) on cards/actions the API suggests
2. Fetch suggestions alongside game state (only when it's the player's turn)
3. Add toggle to show/hide suggestions (default: hidden)
4. Verify: suggestions appear on correct cards/bid values when toggled on

### Unit 8: Polish & Error States
**Depends on:** Units 4, 6
**Delivers:** Production-quality error handling and loading states

1. Add loading skeletons for lobby list, lobby detail, game board
2. Add empty states (no lobbies, no invites)
3. Add error boundary at app level
4. Ensure all API errors show user-friendly messages (not raw JSON)
5. Handle edge cases: navigating to a game that doesn't exist, lobby already started, player already in lobby
6. Mobile responsiveness pass on all views — ensure card game is playable on phone
7. Verify: test each error scenario, check mobile layouts

## Test Strategy

### Manual Test Scenarios
1. **Auth flow:** Sign in → player registered → sign out → redirected
2. **Token refresh:** Wait >1hr or manually expire token → next API call refreshes and succeeds
3. **Create + join lobby:** User A creates lobby → User B sees it in list → User B joins
4. **Invite flow:** Organizer searches for player → invites → invitee sees lobby in their list
5. **Start game:** Organizer starts → navigates to game → sees bidding phase
6. **Full game:** Play through bidding → trump → discard → tricks → winner shown
7. **CPU players:** Start with <4 human players → CPU fills → CPU acts happen automatically after human actions
8. **Polling:** Open game in two browsers → one player acts → other sees update within poll interval
9. **Stale indicator:** Kill network → stale indicator appears → restore → clears
10. **Tab refocus:** Background tab → come back → immediate poll fires
11. **Suggestions:** Toggle suggestions on → see hints on suggested moves
12. **Mobile:** All views usable on 375px width

### Automated Tests
- Unit tests for `usePolling` hook — mock timers, visibility API, backoff (required, in Unit 5)
- Unit tests for API client — mock fetch, verify auth header, retry on 401 (required, in Unit 3)
- Type checking: `tsc --noEmit` in CI

## Dependencies & Prerequisites

| Dependency | Owner | Status |
|------------|-------|--------|
| Backend CORS for frontend origin | Backend team | Not started — must allowlist the exact frontend origin (not `*`), since requests carry Bearer tokens. Also allow `localhost` for dev. |
| Firebase project `hundred-and-ten` credentials | Already exists | Need web app config (apiKey, authDomain, etc.) |
| Azure subscription access | Already exists | Same subscription as backend |
| OpenTofu state storage access | Already exists | RG `tofu`, account `tofuinfra` |

## Risks

1. **CORS:** Backend has no CORS configured. Frontend is non-functional until this is done. Mitigation: can develop locally with a CORS proxy or browser extension, but deployment is blocked.
2. **Polling latency:** 3s polling may feel sluggish for trick play. Mitigation: tune interval, add optimistic UI for the acting player's own moves.
3. **Mobile card layout:** Fitting 5-10 cards + trick area on a phone screen is a design challenge. Mitigation: horizontal scroll for hand, compact card design, iterative layout work.

## Implementation Order

```
Unit 0 (Scaffolding) → Unit 1 (Infrastructure) → Unit 2 (Auth) → Unit 3 (API Client)
    → Unit 4 (Lobbies) ──────────────────────────────────────┐
    → Unit 5 (Game Core) → Unit 6 (Game Interaction) → Unit 7 (Suggestions)
                                                              ↓
                                                     Unit 8 (Polish)
```

Units 4 and 5 can be parallelized after Unit 3. Unit 8 depends on both Unit 4 and Unit 6 being complete.
