import { apiFetch } from "./client";
import type {
  GameAction,
  Player,
  ApiEvent,
  Game,
  SearchGamesRequest,
} from "./types";

/**
 * Search games visible to the player. The backend returns the player's games
 * plus any public games, so callers wanting only their own must filter.
 */
export function searchGames(
  playerId: string,
  query: SearchGamesRequest,
): Promise<Game[]> {
  return apiFetch(`/players/${playerId}/games/search`, {
    method: "POST",
    body: JSON.stringify(query),
  });
}

export function performAction(
  playerId: string,
  gameId: string,
  action: GameAction,
): Promise<ApiEvent[]> {
  return apiFetch(`/players/${playerId}/games/${gameId}/actions`, {
    method: "POST",
    body: JSON.stringify(action),
  });
}

export function getGamePlayers(
  playerId: string,
  gameId: string,
): Promise<Player[]> {
  return apiFetch(`/players/${playerId}/games/${gameId}/players`);
}

export function getGame(playerId: string, gameId: string): Promise<Game> {
  return apiFetch(`/players/${playerId}/games/${gameId}`);
}

/**
 * Leave a game. The backend replaces the leaving player with a CPU so the
 * game can continue for the remaining players.
 */
export function leaveGame(
  playerId: string,
  gameId: string,
): Promise<ApiEvent[]> {
  return apiFetch(`/players/${playerId}/games/${gameId}/players`, {
    method: "POST",
    body: JSON.stringify({ type: "LEAVE" }),
  });
}
