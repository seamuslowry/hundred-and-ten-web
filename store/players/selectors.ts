import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "@/store";
import type { Player } from "@/lib/api/types";

// ─── Base selector ───────────────────────────────────────────────────────────

export function selectPlayerById(
  state: RootState,
  playerId: string,
): Player | undefined {
  return state.players.byId[playerId];
}

// ─── Players by IDs (memoized) ───────────────────────────────────────────────

/**
 * Returns players for the given IDs, in input-ID order.
 * Skips IDs that are not yet in the cache — no undefined holes, no throw.
 * Memoized with createSelector (size-1 cache); callers must stabilize the
 * `ids` array reference (e.g. with useMemo) to benefit from memoization.
 */
export const selectPlayersByIds = createSelector(
  [
    (state: RootState) => state.players.byId,
    (_state: RootState, ids: string[]) => ids,
  ],
  (byId, ids): Player[] =>
    ids.reduce<Player[]>((acc, id) => {
      const player = byId[id];
      if (player !== undefined) acc.push(player);
      return acc;
    }, []),
);
