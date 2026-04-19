import { apiFetch } from "./client";
import type { Lobby, Player, SearchRequest, ApiEvent } from "./types";

export function createLobby(
  playerId: string,
  name: string,
  accessibility: "PUBLIC" | "PRIVATE",
): Promise<Lobby> {
  return apiFetch(`/players/${playerId}/lobbies`, {
    method: "POST",
    body: JSON.stringify({ name, accessibility }),
  });
}

export function getLobby(playerId: string, lobbyId: string): Promise<Lobby> {
  return apiFetch(`/players/${playerId}/lobbies/${lobbyId}`);
}

export function searchLobbies(
  playerId: string,
  query: SearchRequest,
): Promise<Lobby[]> {
  return apiFetch(`/players/${playerId}/lobbies/search`, {
    method: "POST",
    body: JSON.stringify(query),
  });
}

export function joinLobby(playerId: string, lobbyId: string): Promise<void> {
  return apiFetch(`/players/${playerId}/lobbies/${lobbyId}/players`, {
    method: "POST",
    body: JSON.stringify({ type: "JOIN" }),
  });
}

export function invitePlayer(
  playerId: string,
  lobbyId: string,
  inviteeId: string,
): Promise<void> {
  return apiFetch(`/players/${playerId}/lobbies/${lobbyId}/players`, {
    method: "POST",
    body: JSON.stringify({ type: "INVITE", player_id: inviteeId }),
  });
}

export function startGame(
  playerId: string,
  lobbyId: string,
): Promise<ApiEvent[]> {
  return apiFetch(`/players/${playerId}/lobbies/${lobbyId}/start`, {
    method: "POST",
  });
}

export function getLobbyPlayers(
  playerId: string,
  lobbyId: string,
): Promise<Player[]> {
  return apiFetch(`/players/${playerId}/lobbies/${lobbyId}/players`);
}
