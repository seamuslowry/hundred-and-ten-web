import { createSlice } from "@reduxjs/toolkit";
import {
  fetchGame,
  fetchGamesList,
  performGameAction,
  leaveGame,
} from "./thunks";
import type { Game } from "@/lib/api/types";

export interface GamesState {
  byId: Record<string, Game>;
  /** Ordered IDs of the player's ongoing games from fetchGamesList. */
  list: string[];
  /** Loading flag for fetchGamesList. */
  listLoading: boolean;
  /** Error from fetchGamesList. */
  listError: string | null;
  loading: Record<string, boolean>;
  /** Tracks in-flight performGameAction calls per gameId. Used by condition() for dedup. */
  actionInFlight: Record<string, boolean>;
  /** Tracks in-flight leaveGame calls per gameId. Used by condition() for dedup. */
  leaveInFlight: Record<string, boolean>;
  errors: Record<string, string | null>;
}

const initialState: GamesState = {
  byId: {},
  list: [],
  listLoading: false,
  listError: null,
  loading: {},
  actionInFlight: {},
  leaveInFlight: {},
  errors: {},
};

export const gamesSlice = createSlice({
  name: "games",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // fetchGamesList lifecycle
      .addCase(fetchGamesList.pending, (state) => {
        state.listLoading = true;
      })
      .addCase(fetchGamesList.fulfilled, (state, action) => {
        const { games } = action.payload;
        for (const game of games) {
          state.byId[game.id] = game;
        }
        state.list = games.map((g) => g.id);
        state.listError = null;
        state.listLoading = false;
      })
      .addCase(fetchGamesList.rejected, (state, action) => {
        state.listError = action.error.message ?? "Failed to load games";
        state.listLoading = false;
      })
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
      })
      // leaveGame lifecycle — keeps the game in the store so the view stays up
      .addCase(leaveGame.pending, (state, action) => {
        state.leaveInFlight[action.meta.arg.gameId] = true;
      })
      .addCase(leaveGame.fulfilled, (state, action) => {
        state.leaveInFlight[action.meta.arg.gameId] = false;
      })
      .addCase(leaveGame.rejected, (state, action) => {
        state.leaveInFlight[action.meta.arg.gameId] = false;
      });
  },
});

export default gamesSlice.reducer;
