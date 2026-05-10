import { configureStore } from "@reduxjs/toolkit";
import gamesReducer from "./games/slice";
import lobbiesReducer from "./lobbies/slice";
import playersReducer from "./players/slice";

export const store = configureStore({
  reducer: {
    games: gamesReducer,
    lobbies: lobbiesReducer,
    players: playersReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
