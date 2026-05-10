import { apiFetch } from "./client";
import type { Player, SearchRequest } from "./types";

export function putPlayer(playerId: string): Promise<void> {
  return apiFetch(`/players/${playerId}`, { method: "PUT" });
}

export function searchPlayers(
  playerId: string,
  query: SearchRequest,
): Promise<Player[]> {
  return apiFetch(`/players/${playerId}/search`, {
    method: "POST",
    body: JSON.stringify(query),
  });
}
