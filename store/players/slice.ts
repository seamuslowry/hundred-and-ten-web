import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { Player } from "@/lib/api/types";

export interface PlayersState {
  byId: Record<string, Player>;
}

const initialState: PlayersState = {
  byId: {},
};

export const playersSlice = createSlice({
  name: "players",
  initialState,
  reducers: {
    /** Merge a batch of players into the cache. Last-write-wins per player ID. */
    playersUpserted(state, action: PayloadAction<{ players: Player[] }>) {
      for (const player of action.payload.players) {
        state.byId[player.id] = player;
      }
    },
  },
});

export const { playersUpserted } = playersSlice.actions;

export default playersSlice.reducer;
