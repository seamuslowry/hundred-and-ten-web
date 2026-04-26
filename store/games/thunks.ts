import { createAsyncThunk } from "@reduxjs/toolkit";
import { getGame, performAction } from "@/lib/api/games";
import type { GameAction, Game } from "@/lib/api/types";
import type { RootState } from "@/store";

// ─── fetchGame ────────────────────────────────────────────────────────────────

export const fetchGame = createAsyncThunk<
  { gameId: string; game: Game },
  { playerId: string; gameId: string }
>("games/fetchGame", async ({ playerId, gameId }) => {
  const game = await getGame(playerId, gameId);
  return { gameId, game };
});

// ─── performGameAction ────────────────────────────────────────────────────────

export const performGameAction = createAsyncThunk<
  void,
  { playerId: string; gameId: string; action: GameAction },
  { state: RootState; rejectValue: string }
>(
  "games/performGameAction",
  async ({ playerId, gameId, action }, { dispatch, rejectWithValue }) => {
    try {
      await performAction(playerId, gameId, action);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error performing action";
      return rejectWithValue(message);
    }

    // Action succeeded — re-fetch the game. If this fails, the thunk still
    // resolves successfully (the user's action completed server-side).
    // fetchGame.rejected will write to errors[gameId] via its own extraReducer.
    await dispatch(fetchGame({ playerId, gameId }));
  },
  {
    /**
     * Concurrency dedup: if a performGameAction for the same gameId is already
     * in flight (tracked via Redux state), cancel this invocation synchronously.
     * GameBoard's local actionInFlight is the primary guard; this catches
     * cross-mount duplicates (e.g., rapid remount cycles).
     * Using Redux state (vs. a module-level Set) keeps the flag visible in
     * DevTools and resets cleanly between test runs.
     */
    condition({ gameId }, { getState }) {
      return !getState().games.actionInFlight[gameId];
    },
  },
);
