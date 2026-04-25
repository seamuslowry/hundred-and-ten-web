import { apiFetch } from "./client";
import type {
  GameAction,
  Suggestion,
  Player,
  ApiEvent,
  SpikeGame,
} from "./types";

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

export function getSpikeGame(
  playerId: string,
  gameId: string,
): Promise<SpikeGame> {
  return apiFetch(`/players/${playerId}/games/${gameId}/spike`);
}
