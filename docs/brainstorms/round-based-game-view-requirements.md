---
date: 2026-04-24
topic: round-based-game-view
supersedes: game-view-polish-requirements.md
---

# Round-Based Game View

## Problem Frame

The current game page renders a flat view of the game state sourced from the `/games/{game_id}` endpoint. This endpoint exposes only the current round's surface-level state (dealer, bidder, bid amount, trump, tricks, hands) with no history of prior rounds, no bid history within a round, and no discard visibility.

A new API endpoint (`/games/{game_id}/spike`, replacing the current endpoint) restructures the game response around a `rounds[]` array. Each round carries bid history, discards, trick details with winners, and per-round scores. A mockup (`mockup.svg`) defines the target layout: active round expanded at the top, past rounds in a compact form below with expand/collapse controls.

This work switches the game page to the new round-based API and rebuilds the UI to match the mockup.

## Requirements

### Data Layer

- R1. The game page must fetch game state from the spike endpoint (`/games/{game_id}/spike`) instead of the current endpoint. The spike endpoint returns a `SpikeGame` with `rounds[]` instead of a flat `StartedGame`.
- R2. TypeScript types for the spike response must be added: `SpikeGame`, `SpikeActiveRound`, `SpikeCompletedRound`, `SpikeCompletedNoBiddersRound`, `SpikeBid`, `SpikeTrick`, and the `SpikeRound` discriminated union.
- R3. The existing `getGame()` client function and its `StartedGame` type should be replaced by the spike equivalent. The `CompletedGame` type may still be needed if other views reference it, but the game page should no longer use the old flat structure.
- R4. Player name/picture resolution continues via the existing `getGamePlayers()` call -- no change to that pattern.
- R5. Action submission (bid, select trump, discard, play) continues to use the existing `/actions` endpoint. After an action, re-fetch from the spike endpoint.

### Active Round (Always Expanded)

- R6. The active round is always shown at the top of the game view, fully expanded. It must display:
  - Current phase (Bidding, Select Trump, Discarding, Tricks)
  - Dealer (player name)
  - Bidder and bid amount (when known; "(pending)" during bidding before a winner is determined)
  - Active player ("Player N's Turn")
  - Trump suit (once selected)
- R7. **Bid history panel**: During and after bidding, show the sequence of bids in the current round (e.g., "Player 1: Pass", "Player 2: Fifteen", "Player 3: Twenty Five"). Source: `bidHistory[]` on the active round.
- R8. **Hand display**: Show the current player's hand (cards). Show other players' hands as card counts (e.g., "Player 2 Hand: 4 cards"). Source: `hands` map on the active round (cards for self, integer for others).
- R9. **Discards section**: During and after discarding, show the current player's discarded cards. Show other players' discard counts. Source: `discards` map on the active round.
- R10. **Tricks display**: During the Tricks phase, show the current trick with played cards and the winning play, plus completed tricks. Source: `tricks[]` on the active round.
- R11. **Phase-specific controls**: Bid buttons (15, 20, 25, 30, Shoot the Moon, Pass), trump suit selector, discard selection, and card play -- functionally equivalent to today's controls, labeled to match the mockup (e.g., "Shoot the Moon" instead of "60").

### Completed Rounds (Compact + Expandable)

- R12. Past completed rounds are listed below the active round in reverse chronological order (most recent completed round first).
- R13. **Compact view** (default): Shows round number, dealer, bidder + bid amount (or "No bids" for no-bidder rounds), and per-round scores. Separated by horizontal dividers with expand/collapse arrows.
- R14. **Expanded view**: When a completed round is expanded, it shows the full round detail matching the mockup's completed round layout: bid history, all players' hands (fully revealed), all discards (fully revealed), all tricks with winners, trump suit, and per-round scores.
- R15. For `SpikeCompletedNoBiddersRound` (all players passed), the compact view shows "No bids" and the expanded view shows initial hands only (since no tricks were played).

### Scores

- R16. Cumulative game scores (`SpikeGame.scores`) should be visible at the game level (existing ScoreBoard component or equivalent).
- R17. Per-round scores (`SpikeCompletedRound.scores`) should be visible within expanded completed rounds.

### Completed Game

- R18. When the game status indicates completion (winner present), show a game-over state with the winner and final scores. Round history remains accessible below.

## Success Criteria

- The game page renders all visual elements shown in the mockup (`mockup.svg`).
- A player in any phase sees the full active round context: bid history, hands, discards, tricks, and phase-specific controls.
- A player can expand any past completed round to see its full detail (hands, discards, bids, tricks, scores).
- All game actions (bid, select trump, discard, play card) continue to work correctly -- action submission is unchanged.
- Polling/refresh continues to work for game state updates.
- Mobile layout preserves 44px touch targets and horizontal scroll for the card hand.

## Scope Boundaries

**In scope:**
- Switching the game page data source to the spike endpoint
- New types for the spike API response
- Rebuilding the game page layout to match the mockup's round-based structure
- Removing old `getGame()` client code and `StartedGame` type (if no other consumers)

**Out of scope:**
- Dark mode support (tracked separately in `game-view-polish-requirements.md` R1-R3; not blocked by this work)
- Changes to lobby, auth, or non-game views
- Changes to game action submission endpoints
- Suggestion/hints feature (component exists but is not wired; remains unwired)
- Changes to the games search/list page (still uses `StartedGame | CompletedGame` from the search endpoint)

**Deferred:**
- Responsive two-column layout for large screens (from `game-view-polish-requirements.md` R9-R11) -- can be layered on after the round-based structure is in place
- Player avatars/pictures in the game view

## Key Decisions

- **Spike endpoint replaces current**: The frontend will switch to the spike endpoint. Once promoted to the main endpoint path, old client code and types will be removed.
- **Player names via separate call**: Continue resolving player IDs to names/pictures through `getGamePlayers()` rather than embedding them in the spike response.
- **Round navigation via vertical scroll**: Active round at top (always expanded), past rounds below in compact form with expand/collapse dividers. No tabs or separate views.
- **Full mockup in one pass**: No incremental data-layer-first approach. The API switch and UI rebuild happen together.

## Dependencies / Assumptions

- The spike endpoint is running and returns the `SpikeGame` schema as documented in the OpenAPI spec at `/openapi.json`.
- The spike endpoint will be promoted to replace the current `/games/{game_id}` endpoint. Until then, the frontend hits the `/spike` path.
- Action endpoints (`/actions`, `/queued-actions`) remain unchanged and return `Event[]`. The game page re-fetches from the spike endpoint after actions.
- The `getGamePlayers()` endpoint remains unchanged.
- The games search endpoint (`/games/search`) is unaffected -- it returns the existing `StartedGame | CompletedGame` types and is not in scope.

## Outstanding Questions

### Deferred to Planning

- [Affects R8-R9] Determine how hand and discard displays adapt at different screen sizes -- particularly whether other players' hands/discards are collapsed on mobile.
- [Affects R11] Confirm whether bid controls need minimum bid validation changes given the richer `bidHistory[]` data now available.
- [Affects R12-R14] Determine the animation/transition for expanding/collapsing past rounds.
- [Affects R3] Audit which views (if any) still reference `StartedGame` before removing the type.

## Next Steps

-> `/ce-plan` for structured implementation planning
