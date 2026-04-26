import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";

// Mock the API module before importing the thunks that depend on it.
vi.mock("@/lib/api/games", () => ({
  getGame: vi.fn(),
  performAction: vi.fn(),
}));

import { getGame, performAction } from "@/lib/api/games";
import gamesReducer from "../slice";
import { fetchGame, performGameAction } from "../thunks";
import type { Game } from "@/lib/api/types";

const mockGetGame = vi.mocked(getGame);
const mockPerformAction = vi.mocked(performAction);

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAYER_ID = "player-uid-123";
const OTHER_PLAYER_ID = "other-player";
const GAME_ID = "game-abc-456";
const GAME_ID_B = "game-xyz-789";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockActiveRound = {
  status: "BIDDING" as const,
  dealerPlayerId: OTHER_PLAYER_ID,
  bidHistory: [],
  bid: null,
  hands: { [PLAYER_ID]: [{ number: "ACE" as const, suit: "SPADES" as const }] },
  discards: {},
  trump: null,
  tricks: [],
  activePlayerId: OTHER_PLAYER_ID,
  queuedActions: [],
};

const mockGame: Game = {
  id: GAME_ID,
  name: "Test Game",
  players: [
    { id: PLAYER_ID, type: "human" },
    { id: OTHER_PLAYER_ID, type: "human" },
  ],
  scores: { [PLAYER_ID]: 0, [OTHER_PLAYER_ID]: 0 },
  active: mockActiveRound,
  completedRounds: [],
};

const mockGameAfterAction: Game = {
  ...mockGame,
  scores: { [PLAYER_ID]: 25, [OTHER_PLAYER_ID]: 0 },
};

const mockGameB: Game = {
  ...mockGame,
  id: GAME_ID_B,
  name: "Other Game",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStore() {
  return configureStore({ reducer: { games: gamesReducer } });
}

// ─── fetchGame tests ──────────────────────────────────────────────────────────

describe("fetchGame thunk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("happy path: populates byId[gameId] and sets loading[gameId] false after resolution", async () => {
    mockGetGame.mockResolvedValue(mockGame);
    const store = makeStore();

    await store.dispatch(fetchGame({ playerId: PLAYER_ID, gameId: GAME_ID }));

    const state = store.getState().games;
    expect(state.byId[GAME_ID]).toEqual(mockGame);
    expect(state.loading[GAME_ID]).toBe(false);
    expect(state.errors[GAME_ID]).toBeNull();
  });

  it("sets loading[gameId] = true while pending", async () => {
    // Use a promise we can control to observe the pending state
    let resolveGame!: (g: Game) => void;
    const gamePromise = new Promise<Game>((resolve) => {
      resolveGame = resolve;
    });
    mockGetGame.mockReturnValue(gamePromise);
    const store = makeStore();

    const dispatchPromise = store.dispatch(
      fetchGame({ playerId: PLAYER_ID, gameId: GAME_ID }),
    );

    // While the promise is still pending, loading should be true
    expect(store.getState().games.loading[GAME_ID]).toBe(true);

    resolveGame(mockGame);
    await dispatchPromise;

    expect(store.getState().games.loading[GAME_ID]).toBe(false);
  });

  it("error path: sets errors[gameId] and clears loading[gameId]; preserves previously-loaded byId", async () => {
    const store = makeStore();

    // Pre-load the game
    mockGetGame.mockResolvedValueOnce(mockGame);
    await store.dispatch(fetchGame({ playerId: PLAYER_ID, gameId: GAME_ID }));
    expect(store.getState().games.byId[GAME_ID]).toEqual(mockGame);

    // Next fetch fails
    mockGetGame.mockRejectedValueOnce(new Error("network failure"));
    await store.dispatch(fetchGame({ playerId: PLAYER_ID, gameId: GAME_ID }));

    const state = store.getState().games;
    expect(state.errors[GAME_ID]).toBe("network failure");
    expect(state.loading[GAME_ID]).toBe(false);
    // Previously loaded game data is preserved
    expect(state.byId[GAME_ID]).toEqual(mockGame);
  });
});

// ─── performGameAction tests ──────────────────────────────────────────────────

describe("performGameAction thunk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("happy path: calls performAction once then getGame once, in that order", async () => {
    const callOrder: string[] = [];
    mockPerformAction.mockImplementation(async () => {
      callOrder.push("performAction");
      return [];
    });
    mockGetGame.mockImplementation(async () => {
      callOrder.push("getGame");
      return mockGame;
    });

    const store = makeStore();
    await store.dispatch(
      performGameAction({
        playerId: PLAYER_ID,
        gameId: GAME_ID,
        action: { type: "BID", amount: 25 },
      }),
    );

    expect(callOrder).toEqual(["performAction", "getGame"]);
  });

  it("happy path: after success, byId[gameId] reflects the post-action game from re-fetch", async () => {
    mockPerformAction.mockResolvedValue([]);
    mockGetGame.mockResolvedValue(mockGameAfterAction);

    const store = makeStore();
    const result = await store.dispatch(
      performGameAction({
        playerId: PLAYER_ID,
        gameId: GAME_ID,
        action: { type: "BID", amount: 25 },
      }),
    );

    expect(result.meta.requestStatus).toBe("fulfilled");
    expect(store.getState().games.byId[GAME_ID]).toEqual(mockGameAfterAction);
  });

  it("error path: rejects when performAction throws; getGame is NOT called; errors[gameId] unchanged", async () => {
    mockPerformAction.mockRejectedValue(new Error("action failed"));

    const store = makeStore();
    const result = await store.dispatch(
      performGameAction({
        playerId: PLAYER_ID,
        gameId: GAME_ID,
        action: { type: "BID", amount: 25 },
      }),
    );

    expect(result.meta.requestStatus).toBe("rejected");
    expect(mockGetGame).not.toHaveBeenCalled();
    // Slice errors are NOT set from action failures
    const state = store.getState().games;
    expect(state.errors[GAME_ID]).toBeUndefined();
  });

  it("error semantics: action succeeds but re-fetch fails → thunk resolves successfully; errors[gameId] IS set", async () => {
    mockPerformAction.mockResolvedValue([]);
    mockGetGame.mockRejectedValue(new Error("refetch failed"));

    const store = makeStore();
    const result = await store.dispatch(
      performGameAction({
        playerId: PLAYER_ID,
        gameId: GAME_ID,
        action: { type: "BID", amount: 25 },
      }),
    );

    // performGameAction itself resolves (the action succeeded server-side)
    expect(result.meta.requestStatus).toBe("fulfilled");

    // errors[gameId] is set via fetchGame.rejected's extraReducer
    const state = store.getState().games;
    expect(state.errors[GAME_ID]).toBe("refetch failed");
    expect(state.loading[GAME_ID]).toBe(false);
  });

  it("concurrency dedup: two concurrent performGameAction calls for same gameId → only one performAction call", async () => {
    // The first call sets loading[GAME_ID] = true (via fetchGame.pending),
    // but we need loading to be true BEFORE the second dispatch.
    // We control timing using a deferred performAction.
    let resolveAction!: () => void;
    const actionPromise = new Promise<void>((resolve) => {
      resolveAction = resolve;
    });
    mockPerformAction.mockReturnValueOnce(
      actionPromise.then(() => [] as import("@/lib/api/types").ApiEvent[]),
    );
    mockGetGame.mockResolvedValue(mockGame);

    const store = makeStore();

    // Manually set loading to simulate an in-flight action for this gameId
    // so the condition option fires for the second dispatch.
    // We do this by starting the first dispatch (which sets loading via pending),
    // then immediately dispatching a second one.
    const first = store.dispatch(
      performGameAction({
        playerId: PLAYER_ID,
        gameId: GAME_ID,
        action: { type: "BID", amount: 25 },
      }),
    );

    // At this point loading[GAME_ID] = true (set by the pending action).
    // The second dispatch should be dropped by condition.
    const second = store.dispatch(
      performGameAction({
        playerId: PLAYER_ID,
        gameId: GAME_ID,
        action: { type: "BID", amount: 25 },
      }),
    );

    // Let the first action complete
    resolveAction();
    await Promise.all([first, second]);

    // performAction should have been called only once
    expect(mockPerformAction).toHaveBeenCalledTimes(1);
  });

  it("isolation: performGameAction for gameId-A does not affect state for gameId-B", async () => {
    mockPerformAction.mockResolvedValue([]);
    // Pre-load game B
    mockGetGame.mockResolvedValueOnce(mockGameB); // first call: load game B
    const store = makeStore();
    await store.dispatch(fetchGame({ playerId: PLAYER_ID, gameId: GAME_ID_B }));
    expect(store.getState().games.byId[GAME_ID_B]).toEqual(mockGameB);

    // Now perform an action on game A
    mockGetGame.mockResolvedValueOnce(mockGame); // second call: re-fetch after action on A
    await store.dispatch(
      performGameAction({
        playerId: PLAYER_ID,
        gameId: GAME_ID,
        action: { type: "BID", amount: 25 },
      }),
    );

    const state = store.getState().games;
    // Game A is loaded
    expect(state.byId[GAME_ID]).toEqual(mockGame);
    // Game B is untouched
    expect(state.byId[GAME_ID_B]).toEqual(mockGameB);
    expect(state.errors[GAME_ID_B]).toBeNull(); // cleared when game B was loaded
    expect(state.loading[GAME_ID_B]).toBe(false);
  });
});
