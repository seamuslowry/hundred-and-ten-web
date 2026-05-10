import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";

// Mock API modules before importing the thunks that depend on them.
vi.mock("@/lib/api/lobbies", () => ({
  searchLobbies: vi.fn(),
  getLobby: vi.fn(),
  getLobbyPlayers: vi.fn(),
  createLobby: vi.fn(),
  joinLobby: vi.fn(),
  invitePlayer: vi.fn(),
  startGame: vi.fn(),
}));

vi.mock("@/lib/api/players", () => ({
  searchPlayers: vi.fn(),
}));

vi.mock("@/lib/api/games", () => ({
  getGame: vi.fn(),
}));

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
import { getGame } from "@/lib/api/games";
import gamesReducer from "@/store/games/slice";
import lobbiesReducer from "../slice";
import playersReducer from "@/store/players/slice";
import {
  fetchLobbiesList,
  fetchLobby,
  createLobbyThunk,
  joinLobby,
  invitePlayer,
  startGame,
  searchPlayersThunk,
} from "../thunks";
import type { Lobby, Player, Game } from "@/lib/api/types";

// ─── Mocked functions ─────────────────────────────────────────────────────────

const mockSearchLobbies = vi.mocked(searchLobbies);
const mockGetLobby = vi.mocked(getLobby);
const mockGetLobbyPlayers = vi.mocked(getLobbyPlayers);
const mockCreateLobby = vi.mocked(createLobby);
const mockJoinLobbyApi = vi.mocked(joinLobbyApi);
const mockInvitePlayerApi = vi.mocked(invitePlayerApi);
const mockStartGameApi = vi.mocked(startGameApi);
const mockSearchPlayers = vi.mocked(searchPlayers);
const mockGetGame = vi.mocked(getGame);

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAYER_ID = "player-uid-123";
const LOBBY_ID = "lobby-abc-456";
const LOBBY_ID_B = "lobby-xyz-789";
const INVITEE_ID = "invitee-uid-999";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const makeLobby = (id: string, name = "Test Lobby"): Lobby => ({
  id,
  name,
  accessibility: "PUBLIC",
  organizer: { id: PLAYER_ID, type: "human" },
  players: [],
  invitees: [],
});

const makePlayer = (id: string, name = `Player ${id}`): Player => ({
  id,
  name,
  pictureUrl: null,
});

const mockLobby = makeLobby(LOBBY_ID);
const mockLobbyB = makeLobby(LOBBY_ID_B, "Other Lobby");
const mockPlayer = makePlayer(PLAYER_ID);
const mockPlayers: Player[] = [mockPlayer, makePlayer("player-2")];

const mockGame: Game = {
  id: LOBBY_ID,
  name: "Test Game",
  players: [
    { id: PLAYER_ID, type: "human" },
    { id: "player-2", type: "human" },
  ],
  scores: { [PLAYER_ID]: 0, "player-2": 0 },
  active: {
    status: "BIDDING",
    dealerPlayerId: PLAYER_ID,
    bidHistory: [],
    bid: null,
    hands: {},
    discards: {},
    trump: null,
    tricks: [],
    activePlayerId: PLAYER_ID,
    queuedActions: [],
  },
  completedRounds: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStore() {
  return configureStore({
    reducer: {
      games: gamesReducer,
      lobbies: lobbiesReducer,
      players: playersReducer,
    },
  });
}

// ─── fetchLobbiesList tests ───────────────────────────────────────────────────

describe("fetchLobbiesList thunk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("happy path: populates byId and list; listLoading cycles true→false; listError cleared", async () => {
    const lobbies = [mockLobby, mockLobbyB];
    mockSearchLobbies.mockResolvedValue(lobbies);
    const store = makeStore();

    const dispatchPromise = store.dispatch(
      fetchLobbiesList({ playerId: PLAYER_ID }),
    );

    // listLoading should be true while pending
    expect(store.getState().lobbies.listLoading).toBe(true);

    await dispatchPromise;

    const state = store.getState().lobbies;
    expect(state.byId[LOBBY_ID]).toEqual(mockLobby);
    expect(state.byId[LOBBY_ID_B]).toEqual(mockLobbyB);
    expect(state.list).toEqual([LOBBY_ID, LOBBY_ID_B]);
    expect(state.listLoading).toBe(false);
    expect(state.listError).toBeNull();
  });

  it("calls searchLobbies with correct params (empty text, offset 0, limit 50)", async () => {
    mockSearchLobbies.mockResolvedValue([]);
    const store = makeStore();

    await store.dispatch(fetchLobbiesList({ playerId: PLAYER_ID }));

    expect(mockSearchLobbies).toHaveBeenCalledOnce();
    expect(mockSearchLobbies).toHaveBeenCalledWith(PLAYER_ID, {
      searchText: "",
      offset: 0,
      limit: 50,
    });
  });

  it("error path: sets listError; clears listLoading; listError message comes from thrown error", async () => {
    mockSearchLobbies.mockRejectedValue(new Error("network failure"));
    const store = makeStore();

    await store.dispatch(fetchLobbiesList({ playerId: PLAYER_ID }));

    const state = store.getState().lobbies;
    expect(state.listError).toBe("network failure");
    expect(state.listLoading).toBe(false);
    expect(state.list).toEqual([]);
  });
});

// ─── fetchLobby tests ─────────────────────────────────────────────────────────

describe("fetchLobby thunk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("happy path: populates byId[lobbyId]; dispatches playersUpserted with players from getLobbyPlayers; both api functions called once", async () => {
    mockGetLobby.mockResolvedValue(mockLobby);
    mockGetLobbyPlayers.mockResolvedValue(mockPlayers);
    const store = makeStore();

    await store.dispatch(
      fetchLobby({ playerId: PLAYER_ID, lobbyId: LOBBY_ID }),
    );

    const lobbiesState = store.getState().lobbies;
    expect(lobbiesState.byId[LOBBY_ID]).toEqual(mockLobby);
    expect(lobbiesState.errors[LOBBY_ID]).toBeNull();
    expect(lobbiesState.loading[LOBBY_ID]).toBe(false);

    // Players were upserted into the players slice
    const playersState = store.getState().players;
    expect(playersState.byId[PLAYER_ID]).toEqual(mockPlayer);

    expect(mockGetLobby).toHaveBeenCalledOnce();
    expect(mockGetLobbyPlayers).toHaveBeenCalledOnce();
  });

  it("sets loading[lobbyId] = true while pending", async () => {
    let resolveLobby!: (l: Lobby) => void;
    const lobbyPromise = new Promise<Lobby>((resolve) => {
      resolveLobby = resolve;
    });
    mockGetLobby.mockReturnValue(lobbyPromise);
    mockGetLobbyPlayers.mockResolvedValue([]);
    const store = makeStore();

    const dispatchPromise = store.dispatch(
      fetchLobby({ playerId: PLAYER_ID, lobbyId: LOBBY_ID }),
    );

    expect(store.getState().lobbies.loading[LOBBY_ID]).toBe(true);

    resolveLobby(mockLobby);
    await dispatchPromise;

    expect(store.getState().lobbies.loading[LOBBY_ID]).toBe(false);
  });

  it("calls getLobby and getLobbyPlayers in parallel (Promise.all)", async () => {
    const callOrder: string[] = [];
    mockGetLobby.mockImplementation(async () => {
      callOrder.push("getLobby");
      return mockLobby;
    });
    mockGetLobbyPlayers.mockImplementation(async () => {
      callOrder.push("getLobbyPlayers");
      return mockPlayers;
    });
    const store = makeStore();

    await store.dispatch(
      fetchLobby({ playerId: PLAYER_ID, lobbyId: LOBBY_ID }),
    );

    // Both were called — order may vary since they're parallel
    expect(callOrder).toContain("getLobby");
    expect(callOrder).toContain("getLobbyPlayers");
    expect(callOrder).toHaveLength(2);
  });

  it("error path: sets errors[lobbyId]; clears loading[lobbyId]", async () => {
    mockGetLobby.mockRejectedValue(new Error("not found"));
    mockGetLobbyPlayers.mockResolvedValue([]);
    const store = makeStore();

    await store.dispatch(
      fetchLobby({ playerId: PLAYER_ID, lobbyId: LOBBY_ID }),
    );

    const state = store.getState().lobbies;
    expect(state.errors[LOBBY_ID]).toBe("not found");
    expect(state.loading[LOBBY_ID]).toBe(false);
  });
});

// ─── createLobbyThunk tests ───────────────────────────────────────────────────

describe("createLobbyThunk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("happy path: adds new lobby to byId; resolves with the lobby for caller navigation", async () => {
    mockCreateLobby.mockResolvedValue(mockLobby);
    const store = makeStore();

    const result = await store.dispatch(
      createLobbyThunk({
        playerId: PLAYER_ID,
        name: "Test Lobby",
        accessibility: "PUBLIC",
      }),
    );

    expect(result.meta.requestStatus).toBe("fulfilled");
    expect(result.payload).toEqual(mockLobby);

    const state = store.getState().lobbies;
    expect(state.byId[LOBBY_ID]).toEqual(mockLobby);
  });

  it("error path: rejects with message; byId unchanged", async () => {
    mockCreateLobby.mockRejectedValue(new Error("create failed"));
    const store = makeStore();

    const result = await store.dispatch(
      createLobbyThunk({
        playerId: PLAYER_ID,
        name: "Test Lobby",
        accessibility: "PUBLIC",
      }),
    );

    expect(result.meta.requestStatus).toBe("rejected");
    expect((result as { payload: string }).payload).toBe("create failed");
    expect(store.getState().lobbies.byId).toEqual({});
  });
});

// ─── joinLobby tests ──────────────────────────────────────────────────────────

describe("joinLobby thunk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("happy path: calls joinLobby api then fetchLobby; actionInFlight[lobbyId] cycles true→false", async () => {
    const callOrder: string[] = [];
    mockJoinLobbyApi.mockImplementation(async () => {
      callOrder.push("joinLobby");
    });
    mockGetLobby.mockImplementation(async () => {
      callOrder.push("getLobby");
      return mockLobby;
    });
    mockGetLobbyPlayers.mockResolvedValue([]);
    const store = makeStore();

    const dispatchPromise = store.dispatch(
      joinLobby({ playerId: PLAYER_ID, lobbyId: LOBBY_ID }),
    );

    // Should be in-flight immediately
    expect(store.getState().lobbies.actionInFlight[LOBBY_ID]?.join).toBe(true);

    await dispatchPromise;

    expect(callOrder).toEqual(["joinLobby", "getLobby"]);
    expect(store.getState().lobbies.actionInFlight[LOBBY_ID]?.join).toBe(false);
    expect(store.getState().lobbies.byId[LOBBY_ID]).toEqual(mockLobby);
  });

  it("error path: api failure → thunk rejects; errors[lobbyId] unchanged; actionInFlight[lobbyId].join = false", async () => {
    mockJoinLobbyApi.mockRejectedValue(new Error("join failed"));
    const store = makeStore();

    const result = await store.dispatch(
      joinLobby({ playerId: PLAYER_ID, lobbyId: LOBBY_ID }),
    );

    expect(result.meta.requestStatus).toBe("rejected");
    // errors[lobbyId] must NOT be set from action thunk failure (error channel separation)
    expect(store.getState().lobbies.errors[LOBBY_ID]).toBeUndefined();
    expect(store.getState().lobbies.actionInFlight[LOBBY_ID]?.join).toBe(false);
    // fetchLobby should NOT have been called
    expect(mockGetLobby).not.toHaveBeenCalled();
  });

  it("concurrency: two concurrent joinLobby calls for same lobbyId → only one api call", async () => {
    let resolveJoin!: () => void;
    const joinPromise = new Promise<void>((resolve) => {
      resolveJoin = resolve;
    });
    mockJoinLobbyApi.mockReturnValueOnce(joinPromise);
    mockGetLobby.mockResolvedValue(mockLobby);
    mockGetLobbyPlayers.mockResolvedValue([]);
    const store = makeStore();

    const first = store.dispatch(
      joinLobby({ playerId: PLAYER_ID, lobbyId: LOBBY_ID }),
    );

    // At this point actionInFlight[LOBBY_ID].join = true — second dispatch should be dropped
    const second = store.dispatch(
      joinLobby({ playerId: PLAYER_ID, lobbyId: LOBBY_ID }),
    );

    resolveJoin();
    await Promise.all([first, second]);

    expect(mockJoinLobbyApi).toHaveBeenCalledTimes(1);
  });

  it("per-action dedup: invitePlayer is NOT blocked by an in-flight joinLobby on the same lobby", async () => {
    // Long-running joinLobby keeps `.join` flag true throughout; meanwhile the
    // invitePlayer dispatch should still go through because it has its own key.
    let resolveJoin!: () => void;
    const joinPromise = new Promise<void>((resolve) => {
      resolveJoin = resolve;
    });
    mockJoinLobbyApi.mockReturnValueOnce(joinPromise);
    mockGetLobby.mockResolvedValue(mockLobby);
    mockGetLobbyPlayers.mockResolvedValue([]);
    mockInvitePlayerApi.mockResolvedValue(undefined);
    const store = makeStore();

    const joinDispatch = store.dispatch(
      joinLobby({ playerId: PLAYER_ID, lobbyId: LOBBY_ID }),
    );

    // .join is in flight; .invite should still be available.
    expect(store.getState().lobbies.actionInFlight[LOBBY_ID]?.join).toBe(true);

    const inviteResult = await store.dispatch(
      invitePlayer({
        playerId: PLAYER_ID,
        lobbyId: LOBBY_ID,
        inviteeId: INVITEE_ID,
      }),
    );

    expect(inviteResult.meta.requestStatus).toBe("fulfilled");
    expect(mockInvitePlayerApi).toHaveBeenCalledTimes(1);

    resolveJoin();
    await joinDispatch;
  });

  it("isolation: joinLobby for lobbyId-A does not affect lobbyId-B state", async () => {
    mockJoinLobbyApi.mockResolvedValue(undefined);
    mockGetLobby.mockResolvedValue(mockLobby);
    mockGetLobbyPlayers.mockResolvedValue([]);
    const store = makeStore();

    await store.dispatch(joinLobby({ playerId: PLAYER_ID, lobbyId: LOBBY_ID }));

    const state = store.getState().lobbies;
    expect(state.actionInFlight[LOBBY_ID]?.join).toBe(false);
    // lobbyId-B should be completely untouched
    expect(state.actionInFlight[LOBBY_ID_B]).toBeUndefined();
    expect(state.errors[LOBBY_ID_B]).toBeUndefined();
    expect(state.loading[LOBBY_ID_B]).toBeUndefined();
  });
});

// ─── invitePlayer tests ───────────────────────────────────────────────────────

describe("invitePlayer thunk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("happy path: calls invitePlayer api then fetchLobby; actionInFlight[lobbyId] cycles true→false", async () => {
    const callOrder: string[] = [];
    mockInvitePlayerApi.mockImplementation(async () => {
      callOrder.push("invitePlayer");
    });
    mockGetLobby.mockImplementation(async () => {
      callOrder.push("getLobby");
      return mockLobby;
    });
    mockGetLobbyPlayers.mockResolvedValue([]);
    const store = makeStore();

    const dispatchPromise = store.dispatch(
      invitePlayer({
        playerId: PLAYER_ID,
        lobbyId: LOBBY_ID,
        inviteeId: INVITEE_ID,
      }),
    );

    expect(store.getState().lobbies.actionInFlight[LOBBY_ID]?.invite).toBe(
      true,
    );

    await dispatchPromise;

    expect(callOrder).toEqual(["invitePlayer", "getLobby"]);
    expect(store.getState().lobbies.actionInFlight[LOBBY_ID]?.invite).toBe(
      false,
    );
    expect(store.getState().lobbies.byId[LOBBY_ID]).toEqual(mockLobby);
  });

  it("error path: api failure → thunk rejects; errors[lobbyId] unchanged; actionInFlight[lobbyId].invite = false", async () => {
    mockInvitePlayerApi.mockRejectedValue(new Error("invite failed"));
    const store = makeStore();

    const result = await store.dispatch(
      invitePlayer({
        playerId: PLAYER_ID,
        lobbyId: LOBBY_ID,
        inviteeId: INVITEE_ID,
      }),
    );

    expect(result.meta.requestStatus).toBe("rejected");
    expect(store.getState().lobbies.errors[LOBBY_ID]).toBeUndefined();
    expect(store.getState().lobbies.actionInFlight[LOBBY_ID]?.invite).toBe(
      false,
    );
    expect(mockGetLobby).not.toHaveBeenCalled();
  });
});

// ─── startGame tests ──────────────────────────────────────────────────────────

describe("startGame thunk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("happy path: calls startGame api then dispatches fetchGame; lobbies actionInFlight cycles; games byId[lobbyId] populated", async () => {
    const callOrder: string[] = [];
    mockStartGameApi.mockImplementation(async () => {
      callOrder.push("startGame");
      return [];
    });
    mockGetGame.mockImplementation(async () => {
      callOrder.push("getGame");
      return mockGame;
    });
    const store = makeStore();

    const dispatchPromise = store.dispatch(
      startGame({ playerId: PLAYER_ID, lobbyId: LOBBY_ID }),
    );

    expect(store.getState().lobbies.actionInFlight[LOBBY_ID]?.start).toBe(true);

    const result = await dispatchPromise;

    expect(result.meta.requestStatus).toBe("fulfilled");
    expect(callOrder).toEqual(["startGame", "getGame"]);
    expect(store.getState().lobbies.actionInFlight[LOBBY_ID]?.start).toBe(
      false,
    );
    expect(store.getState().games.byId[LOBBY_ID]).toEqual(mockGame);
  });

  it("error path: startGame api failure → thunk rejects; fetchGame NOT called; errors[lobbyId] unchanged in BOTH slices", async () => {
    mockStartGameApi.mockRejectedValue(new Error("start failed"));
    const store = makeStore();

    const result = await store.dispatch(
      startGame({ playerId: PLAYER_ID, lobbyId: LOBBY_ID }),
    );

    expect(result.meta.requestStatus).toBe("rejected");
    expect(mockGetGame).not.toHaveBeenCalled();

    // Lobbies slice: action errors must NOT be written to errors[lobbyId]
    expect(store.getState().lobbies.errors[LOBBY_ID]).toBeUndefined();
    // Games slice: untouched
    expect(store.getState().games.errors[LOBBY_ID]).toBeUndefined();
    expect(store.getState().lobbies.actionInFlight[LOBBY_ID]?.start).toBe(
      false,
    );
  });

  it("error path: startGame api succeeds but fetchGame rejects → thunk resolves successfully; games errors[lobbyId] is set", async () => {
    mockStartGameApi.mockResolvedValue([]);
    mockGetGame.mockRejectedValue(new Error("game fetch failed"));
    const store = makeStore();

    const result = await store.dispatch(
      startGame({ playerId: PLAYER_ID, lobbyId: LOBBY_ID }),
    );

    // startGame thunk itself resolves — the action completed server-side
    expect(result.meta.requestStatus).toBe("fulfilled");
    expect(store.getState().lobbies.actionInFlight[LOBBY_ID]?.start).toBe(
      false,
    );

    // fetchGame.rejected writes to the games slice errors
    expect(store.getState().games.errors[LOBBY_ID]).toBe("game fetch failed");

    // lobbies slice errors are unchanged (action error separation)
    expect(store.getState().lobbies.errors[LOBBY_ID]).toBeUndefined();
  });

  it("concurrency: two concurrent startGame calls for same lobbyId → only one api call", async () => {
    let resolveStart!: () => void;
    const startPromise = new Promise<void>((resolve) => {
      resolveStart = resolve;
    });
    mockStartGameApi.mockReturnValueOnce(
      startPromise.then(() => [] as import("@/lib/api/types").ApiEvent[]),
    );
    mockGetGame.mockResolvedValue(mockGame);
    const store = makeStore();

    const first = store.dispatch(
      startGame({ playerId: PLAYER_ID, lobbyId: LOBBY_ID }),
    );

    // actionInFlight[LOBBY_ID].start = true — second should be dropped by condition
    const second = store.dispatch(
      startGame({ playerId: PLAYER_ID, lobbyId: LOBBY_ID }),
    );

    resolveStart();
    await Promise.all([first, second]);

    expect(mockStartGameApi).toHaveBeenCalledTimes(1);
  });
});

// ─── searchPlayersThunk tests ─────────────────────────────────────────────────

describe("searchPlayersThunk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("happy path: returns player IDs; players slice populated BEFORE .unwrap() resolves", async () => {
    mockSearchPlayers.mockResolvedValue(mockPlayers);
    const store = makeStore();

    const result = await store.dispatch(
      searchPlayersThunk({ playerId: PLAYER_ID, searchText: "alice" }),
    );

    expect(result.meta.requestStatus).toBe("fulfilled");
    const playerIds = result.payload as string[];
    expect(playerIds).toEqual(mockPlayers.map((p) => p.id));

    // Players are in the players slice
    const playersState = store.getState().players;
    for (const player of mockPlayers) {
      expect(playersState.byId[player.id]).toEqual(player);
    }
  });

  it("dispatch order: players are in the store before the promise resolves (cache populated before return)", async () => {
    // Verify the promise-then order: players upserted synchronously before resolving
    let playersInStoreAtResolution: Record<string, Player> | null = null;

    const store = makeStore();

    mockSearchPlayers.mockResolvedValue(mockPlayers);

    // Intercept the fulfilled action to check state AT the moment of resolution
    const originalDispatch = store.dispatch.bind(store);
    let capturedPlayerIds: string[] | null = null;

    const resultPromise = originalDispatch(
      searchPlayersThunk({ playerId: PLAYER_ID, searchText: "alice" }),
    ).then((action) => {
      if (action.meta.requestStatus === "fulfilled") {
        capturedPlayerIds = action.payload as string[];
        playersInStoreAtResolution = { ...store.getState().players.byId };
      }
      return action;
    });

    await resultPromise;

    // Players were in the store when the fulfilled action was dispatched
    expect(playersInStoreAtResolution).not.toBeNull();
    for (const player of mockPlayers) {
      expect(playersInStoreAtResolution![player.id]).toEqual(player);
    }
    expect(capturedPlayerIds).toEqual(mockPlayers.map((p) => p.id));
  });

  it("edge case: empty results → playersUpserted([]) is a no-op; resolves with empty array", async () => {
    mockSearchPlayers.mockResolvedValue([]);
    const store = makeStore();

    const result = await store.dispatch(
      searchPlayersThunk({ playerId: PLAYER_ID, searchText: "nobody" }),
    );

    expect(result.meta.requestStatus).toBe("fulfilled");
    expect(result.payload).toEqual([]);
    expect(store.getState().players.byId).toEqual({});
  });

  it("error path: rejection → thunk rejects; players slice unchanged", async () => {
    mockSearchPlayers.mockRejectedValue(new Error("search failed"));
    const store = makeStore();

    const result = await store.dispatch(
      searchPlayersThunk({ playerId: PLAYER_ID, searchText: "alice" }),
    );

    expect(result.meta.requestStatus).toBe("rejected");
    expect((result as { payload: string }).payload).toBe("search failed");
    expect(store.getState().players.byId).toEqual({});
  });

  it("calls searchPlayers with correct params (offset 0, limit 10)", async () => {
    mockSearchPlayers.mockResolvedValue([]);
    const store = makeStore();

    await store.dispatch(
      searchPlayersThunk({ playerId: PLAYER_ID, searchText: "bob" }),
    );

    expect(mockSearchPlayers).toHaveBeenCalledOnce();
    expect(mockSearchPlayers).toHaveBeenCalledWith(PLAYER_ID, {
      searchText: "bob",
      offset: 0,
      limit: 10,
    });
  });
});
