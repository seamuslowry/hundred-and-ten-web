import { createSlice } from "@reduxjs/toolkit";
import type { Lobby } from "@/lib/api/types";
import {
  fetchLobbiesList,
  fetchLobby,
  createLobbyThunk,
  joinLobby,
  invitePlayer,
  startGame,
} from "./thunks";

export interface LobbiesState {
  byId: Record<string, Lobby>;
  /** Ordered lobby IDs from fetchLobbiesList. */
  list: string[];
  /** Per-lobbyId loading flag (for fetchLobby). */
  loading: Record<string, boolean>;
  /** Loading flag for fetchLobbiesList. */
  listLoading: boolean;
  /** Per-lobbyId fetch/sync errors (never action errors). */
  errors: Record<string, string | null>;
  /** Error from fetchLobbiesList. */
  listError: string | null;
  /** Per-lobbyId in-flight flag for joinLobby, invitePlayer, startGame. */
  actionInFlight: Record<string, boolean>;
}

const initialState: LobbiesState = {
  byId: {},
  list: [],
  loading: {},
  listLoading: false,
  errors: {},
  listError: null,
  actionInFlight: {},
};

export const lobbiesSlice = createSlice({
  name: "lobbies",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    // ── fetchLobbiesList ──────────────────────────────────────────────────────
    builder
      .addCase(fetchLobbiesList.pending, (state) => {
        state.listLoading = true;
      })
      .addCase(fetchLobbiesList.fulfilled, (state, action) => {
        const { lobbies } = action.payload;
        for (const lobby of lobbies) {
          state.byId[lobby.id] = lobby;
        }
        state.list = lobbies.map((l) => l.id);
        state.listError = null;
        state.listLoading = false;
      })
      .addCase(fetchLobbiesList.rejected, (state, action) => {
        state.listError = action.error.message ?? "Failed to load lobbies";
        state.listLoading = false;
      });

    // ── fetchLobby ────────────────────────────────────────────────────────────
    builder
      .addCase(fetchLobby.pending, (state, action) => {
        const { lobbyId } = action.meta.arg;
        state.loading[lobbyId] = true;
      })
      .addCase(fetchLobby.fulfilled, (state, action) => {
        const { lobbyId, lobby } = action.payload;
        state.byId[lobbyId] = lobby;
        state.errors[lobbyId] = null;
        state.loading[lobbyId] = false;
      })
      .addCase(fetchLobby.rejected, (state, action) => {
        const { lobbyId } = action.meta.arg;
        state.errors[lobbyId] = action.error.message ?? "Failed to load lobby";
        state.loading[lobbyId] = false;
      });

    // ── createLobbyThunk ──────────────────────────────────────────────────────
    // Creation lifecycle (pending/rejected) is tracked in routes/lobbies/new.tsx
    // via local `submitting`/`error` state; the slice only records the new lobby
    // on success. Action errors surface via .unwrap() in the route, not slice errors.
    builder.addCase(createLobbyThunk.fulfilled, (state, action) => {
      const lobby = action.payload;
      state.byId[lobby.id] = lobby;
    });

    // ── joinLobby / invitePlayer / startGame ──────────────────────────────────
    // Action errors surface via .unwrap() in components, not the slice errors map.
    // The .rejected reducers only flip actionInFlight; the rejectValue is consumed
    // by the dispatching component for local actionError state.
    // ── joinLobby ─────────────────────────────────────────────────────────────
    builder
      .addCase(joinLobby.pending, (state, action) => {
        const { lobbyId } = action.meta.arg;
        state.actionInFlight[lobbyId] = true;
      })
      .addCase(joinLobby.fulfilled, (state, action) => {
        const { lobbyId } = action.meta.arg;
        state.actionInFlight[lobbyId] = false;
      })
      .addCase(joinLobby.rejected, (state, action) => {
        const { lobbyId } = action.meta.arg;
        state.actionInFlight[lobbyId] = false;
      });

    // ── invitePlayer ──────────────────────────────────────────────────────────
    builder
      .addCase(invitePlayer.pending, (state, action) => {
        const { lobbyId } = action.meta.arg;
        state.actionInFlight[lobbyId] = true;
      })
      .addCase(invitePlayer.fulfilled, (state, action) => {
        const { lobbyId } = action.meta.arg;
        state.actionInFlight[lobbyId] = false;
      })
      .addCase(invitePlayer.rejected, (state, action) => {
        const { lobbyId } = action.meta.arg;
        state.actionInFlight[lobbyId] = false;
      });

    // ── startGame ─────────────────────────────────────────────────────────────
    // The game itself lands in state.games.byId[lobbyId] via fetchGame.fulfilled.
    builder
      .addCase(startGame.pending, (state, action) => {
        const { lobbyId } = action.meta.arg;
        state.actionInFlight[lobbyId] = true;
      })
      .addCase(startGame.fulfilled, (state, action) => {
        const { lobbyId } = action.meta.arg;
        state.actionInFlight[lobbyId] = false;
      })
      .addCase(startGame.rejected, (state, action) => {
        const { lobbyId } = action.meta.arg;
        state.actionInFlight[lobbyId] = false;
      });

    // ── searchPlayersThunk ────────────────────────────────────────────────────
    // No lobbies-slice state is touched; players are upserted directly from the
    // thunk body via dispatch(playersUpserted(...)) before the thunk resolves.
  },
});

export default lobbiesSlice.reducer;
