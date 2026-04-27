import { createSlice } from "@reduxjs/toolkit";
import type { Lobby } from "@/lib/api/types";

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
    // filled in U3
    void builder;
  },
});

export default lobbiesSlice.reducer;
