import { apiFetch } from "./client";
import type { GameAction, Player, ApiEvent, Game } from "./types";

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
