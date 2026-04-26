import { createSlice } from "@reduxjs/toolkit";
import { fetchGame, performGameAction } from "./thunks";
import type { Game } from "@/lib/api/types";

export interface GamesState {
  byId: Record<string, Game>;
  loading: Record<string, boolean>;
  /** Tracks in-flight performGameAction calls per gameId. Used by condition() for dedup. */
  actionInFlight: Record<string, boolean>;
  errors: Record<string, string | null>;
}

const initialState: GamesState = {
  byId: {},
  loading: {},
  actionInFlight: {},
  errors: {},
};

export const gamesSlice = createSlice({
  name: "games",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // fetchGame lifecycle
      .addCase(fetchGame.pending, (state, action) => {
        state.loading[action.meta.arg.gameId] = true;
      })
      .addCase(fetchGame.fulfilled, (state, action) => {
        const { gameId, game } = action.payload;
        state.byId[gameId] = game;
        state.errors[gameId] = null;
        state.loading[gameId] = false;
      })
      .addCase(fetchGame.rejected, (state, action) => {
        const gameId = action.meta.arg.gameId;
        state.errors[gameId] = action.error.message ?? "Unknown error";
        state.loading[gameId] = false;
      })
      // performGameAction lifecycle — tracks in-flight action for dedup
      .addCase(performGameAction.pending, (state, action) => {
        state.actionInFlight[action.meta.arg.gameId] = true;
      })
      .addCase(performGameAction.fulfilled, (state, action) => {
        state.actionInFlight[action.meta.arg.gameId] = false;
      })
      .addCase(performGameAction.rejected, (state, action) => {
        state.actionInFlight[action.meta.arg.gameId] = false;
      });
  },
});

export default gamesSlice.reducer;
