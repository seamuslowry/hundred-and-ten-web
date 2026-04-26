import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { Game, ActiveGameState, ActiveRound } from "@/lib/api/types";

// Private type guard — mirrors lib/hooks/use-game-state.ts:20-22
function isActiveRound(active: ActiveGameState): active is ActiveRound {
  return active.status !== "WON";
}
// Re-export for use in selectors file (same module boundary)
export { isActiveRound };

export interface GamesState {
  byId: Record<string, Game>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
}

const initialState: GamesState = {
  byId: {},
  loading: {},
  errors: {},
};

export const gamesSlice = createSlice({
  name: "games",
  initialState,
  reducers: {
    /**
     * Written on successful fetches only (via fetchGame.fulfilled in U2).
     * Clears the error for that gameId because a fresh snapshot arrived.
     */
    gameLoaded(state, action: PayloadAction<{ gameId: string; game: Game }>) {
      const { gameId, game } = action.payload;
      state.byId[gameId] = game;
      state.errors[gameId] = null;
    },
  },
  // extraReducers will be filled in U2 when fetchGame thunk is created.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  extraReducers: (_builder) => {
    // filled in U2
  },
});

export const { gameLoaded } = gamesSlice.actions;
export default gamesSlice.reducer;
