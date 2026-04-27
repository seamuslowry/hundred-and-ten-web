import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "@/store";
import type { Lobby } from "@/lib/api/types";

// ─── Base selector ───────────────────────────────────────────────────────────

export function selectLobbyById(
  state: RootState,
  lobbyId: string,
): Lobby | undefined {
  return state.lobbies.byId[lobbyId];
}

// ─── Lobby list (memoized) ───────────────────────────────────────────────────

/**
 * Returns lobbies in the order of `state.lobbies.list` IDs.
 * Skips IDs that are not yet in `byId` — no undefined holes.
 * Memoized with createSelector (size-1 cache).
 */
export const selectLobbyList = createSelector(
  [
    (state: RootState) => state.lobbies.byId,
    (state: RootState) => state.lobbies.list,
  ],
  (byId, list): Lobby[] =>
    list.reduce<Lobby[]>((acc, id) => {
      const lobby = byId[id];
      if (lobby !== undefined) acc.push(lobby);
      return acc;
    }, []),
);
