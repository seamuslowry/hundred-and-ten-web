import { apiFetch } from "./client";
import type {
  StartedGame,
  CompletedGame,
  GameAction,
  Suggestion,
  Player,
  ApiEvent,
} from "./types";

export function getGame(
  playerId: string,
  gameId: string,
): Promise<StartedGame | CompletedGame> {
  return apiFetch(`/players/${playerId}/games/${gameId}`);
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

export function getSuggestions(
  playerId: string,
  gameId: string,
): Promise<Suggestion[]> {
  return apiFetch(`/players/${playerId}/games/${gameId}/suggestions`);
}

export function getGamePlayers(
  playerId: string,
  gameId: string,
): Promise<Player[]> {
  return apiFetch(`/players/${playerId}/games/${gameId}/players`);
}
