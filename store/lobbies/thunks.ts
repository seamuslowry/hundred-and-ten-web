import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  searchLobbies,
  getLobby,
  getLobbyPlayers,
  createLobby,
  joinLobby as joinLobbyApi,
  invitePlayer as invitePlayerApi,
  startGame as startGameApi,
} from "@/lib/api/lobbies";
import { searchPlayers } from "@/lib/api/players";
import { playersUpserted } from "@/store/players/slice";
import { fetchGame } from "@/store/games/thunks";
import { LOBBY_ACTION_NAMES, isActionInFlight } from "./slice";
import type { Lobby } from "@/lib/api/types";
import type { RootState } from "@/store";

// ─── fetchLobbiesList ─────────────────────────────────────────────────────────

export const fetchLobbiesList = createAsyncThunk<
  { lobbies: Lobby[] },
  { playerId: string }
>("lobbies/fetchLobbiesList", async ({ playerId }) => {
  const lobbies = await searchLobbies(playerId, {
    searchText: "",
    offset: 0,
    limit: 50,
  });
  return { lobbies };
});

// ─── fetchLobby ───────────────────────────────────────────────────────────────

export const fetchLobby = createAsyncThunk<
  { lobbyId: string; lobby: Lobby },
  { playerId: string; lobbyId: string }
>("lobbies/fetchLobby", async ({ playerId, lobbyId }, { dispatch }) => {
  const [lobby, players] = await Promise.all([
    getLobby(playerId, lobbyId),
    getLobbyPlayers(playerId, lobbyId),
  ]);
  dispatch(playersUpserted({ players }));
  return { lobbyId, lobby };
});

// ─── createLobbyThunk ─────────────────────────────────────────────────────────

export const createLobbyThunk = createAsyncThunk<
  Lobby,
  { playerId: string; name: string; accessibility: "PUBLIC" | "PRIVATE" },
  { rejectValue: string }
>(
  "lobbies/createLobby",
  async ({ playerId, name, accessibility }, { rejectWithValue }) => {
    try {
      return await createLobby(playerId, name, accessibility);
    } catch (err) {
      return rejectWithValue(
        err instanceof Error ? err.message : "Unknown error creating lobby",
      );
    }
  },
);

// ─── joinLobby ────────────────────────────────────────────────────────────────

export const joinLobby = createAsyncThunk<
  void,
  { playerId: string; lobbyId: string },
  { state: RootState; rejectValue: string }
>(
  "lobbies/joinLobby",
  async ({ playerId, lobbyId }, { dispatch, rejectWithValue }) => {
    try {
      await joinLobbyApi(playerId, lobbyId);
    } catch (err) {
      return rejectWithValue(
        err instanceof Error ? err.message : "Unknown error joining lobby",
      );
    }
    await dispatch(fetchLobby({ playerId, lobbyId }));
  },
  {
    // Per-action dedup: only block joinLobby if a join is already pending for
    // this lobby. Other actions (invitePlayer, startGame) on the same lobby do
    // not interfere — see slice.ts LobbiesState.actionInFlight comment.
    condition({ lobbyId }, { getState }) {
      return !isActionInFlight(
        getState().lobbies,
        lobbyId,
        LOBBY_ACTION_NAMES.join,
      );
    },
  },
);

// ─── invitePlayer ─────────────────────────────────────────────────────────────

export const invitePlayer = createAsyncThunk<
  void,
  { playerId: string; lobbyId: string; inviteeId: string },
  { state: RootState; rejectValue: string }
>(
  "lobbies/invitePlayer",
  async ({ playerId, lobbyId, inviteeId }, { dispatch, rejectWithValue }) => {
    try {
      await invitePlayerApi(playerId, lobbyId, inviteeId);
    } catch (err) {
      return rejectWithValue(
        err instanceof Error ? err.message : "Unknown error inviting player",
      );
    }
    await dispatch(fetchLobby({ playerId, lobbyId }));
  },
  {
    condition({ lobbyId }, { getState }) {
      return !isActionInFlight(
        getState().lobbies,
        lobbyId,
        LOBBY_ACTION_NAMES.invite,
      );
    },
  },
);

// ─── startGame ────────────────────────────────────────────────────────────────

export const startGame = createAsyncThunk<
  void,
  { playerId: string; lobbyId: string },
  { state: RootState; rejectValue: string }
>(
  "lobbies/startGame",
  async ({ playerId, lobbyId }, { dispatch, rejectWithValue }) => {
    try {
      await startGameApi(playerId, lobbyId); // returns Event[] — discard
    } catch (err) {
      return rejectWithValue(
        err instanceof Error ? err.message : "Unknown error starting game",
      );
    }

    // Action succeeded — fetch the resulting game. If this fails, the thunk
    // still resolves successfully (the game started server-side).
    // fetchGame.rejected will write to games errors[lobbyId] via its own extraReducer.
    await dispatch(fetchGame({ playerId, gameId: lobbyId }));
  },
  {
    condition({ lobbyId }, { getState }) {
      return !isActionInFlight(
        getState().lobbies,
        lobbyId,
        LOBBY_ACTION_NAMES.start,
      );
    },
  },
);

// ─── searchPlayersThunk ───────────────────────────────────────────────────────

export const searchPlayersThunk = createAsyncThunk<
  string[],
  { playerId: string; searchText: string },
  { rejectValue: string }
>(
  "lobbies/searchPlayers",
  async ({ playerId, searchText }, { dispatch, rejectWithValue }) => {
    let players;
    try {
      players = await searchPlayers(playerId, {
        searchText,
        offset: 0,
        limit: 10,
      });
    } catch (err) {
      return rejectWithValue(
        err instanceof Error ? err.message : "Unknown error searching players",
      );
    }
    // Populate the cache BEFORE returning so callers see the players
    // immediately after .unwrap() resolves.
    dispatch(playersUpserted({ players }));
    return players.map((p) => p.id);
  },
);
