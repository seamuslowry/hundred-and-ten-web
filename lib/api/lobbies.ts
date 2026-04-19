import { apiFetch } from "./client";
import type { WaitingGame, Player, SearchRequest, ApiEvent } from "./types";

export function createLobby(
  playerId: string,
  name: string,
  accessibility: "PUBLIC" | "PRIVATE",
): Promise<WaitingGame> {
  return apiFetch(`/players/${playerId}/lobbies`, {
    method: "POST",
    body: JSON.stringify({ name, accessibility }),
  });
}

export function getLobby(
  playerId: string,
  lobbyId: string,
): Promise<WaitingGame> {
  return apiFetch(`/players/${playerId}/lobbies/${lobbyId}`);
}

export function searchLobbies(
  playerId: string,
  query: SearchRequest,
): Promise<WaitingGame[]> {
  return apiFetch(`/players/${playerId}/lobbies`, {
    method: "POST",
    body: JSON.stringify(query),
  });
}

export function joinLobby(playerId: string, lobbyId: string): Promise<void> {
  return apiFetch(`/players/${playerId}/lobbies/${lobbyId}/join`, {
    method: "PUT",
  });
}

export function invitePlayer(
  playerId: string,
  lobbyId: string,
  inviteeId: string,
): Promise<void> {
  return apiFetch(
    `/players/${playerId}/lobbies/${lobbyId}/invitees/${inviteeId}`,
    { method: "PUT" },
  );
}

export function startGame(
  playerId: string,
  lobbyId: string,
): Promise<ApiEvent[]> {
  return apiFetch(`/players/${playerId}/lobbies/${lobbyId}/start`, {
    method: "PUT",
  });
}

export function getLobbyPlayers(
  playerId: string,
  lobbyId: string,
): Promise<Player[]> {
  return apiFetch(`/players/${playerId}/lobbies/${lobbyId}/players`);
}
