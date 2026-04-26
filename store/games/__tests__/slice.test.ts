import { describe, it, expect, vi, beforeEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import gamesReducer from "../slice";
import type { GamesState } from "../slice";

vi.mock("@/lib/api/games", () => ({
  getGame: vi.fn(),
  performAction: vi.fn(),
}));

import { getGame } from "@/lib/api/games";
const mockGetGame = vi.mocked(getGame);
import {
  selectGameById,
  selectActiveRound,
  selectCompletedRounds,
  selectMyTurn,
  selectMyHand,
} from "../selectors";
import type { RootState } from "@/store";
import type { Game } from "@/lib/api/types";

// ─── Constants ───────────────────────────────────────────────────────────────

const PLAYER_ID = "player-uid-123";
const OTHER_PLAYER_ID = "other-player";
const GAME_ID = "game-abc-456";

const MY_HAND = [{ number: "ACE" as const, suit: "SPADES" as const }];

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockActiveRound = {
  status: "BIDDING" as const,
  dealerPlayerId: OTHER_PLAYER_ID,
  bidHistory: [],
  bid: null,
  hands: { [PLAYER_ID]: MY_HAND, [OTHER_PLAYER_ID]: 5 },
  discards: {},
  trump: null,
  tricks: [],
  activePlayerId: OTHER_PLAYER_ID,
  queuedActions: [],
};

const mockMyTurnRound = {
  ...mockActiveRound,
  activePlayerId: PLAYER_ID,
};

const mockCompletedRound = {
  status: "COMPLETED" as const,
  dealerPlayerId: OTHER_PLAYER_ID,
  trump: "SPADES" as const,
  bidHistory: [],
  bid: null,
  initialHands: { [PLAYER_ID]: MY_HAND, [OTHER_PLAYER_ID]: MY_HAND },
  discards: {},
  tricks: [],
  scores: { [PLAYER_ID]: 0, [OTHER_PLAYER_ID]: 20 },
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

const mockMyTurnGame: Game = {
  ...mockGame,
  active: mockMyTurnRound,
};

const mockCompletedGame: Game = {
  ...mockGame,
  active: { status: "WON", winnerPlayerId: OTHER_PLAYER_ID },
  completedRounds: [mockCompletedRound],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a RootState with the given games slice state. */
function makeState(gamesState: Partial<GamesState> = {}): RootState {
  const games: GamesState = {
    byId: {},
    loading: {},
    actionInFlight: {},
    errors: {},
    ...gamesState,
  };
  return { games } as RootState;
}

/** Build a state that has the given game loaded. */
function stateWithGame(game: Game, extra: Partial<GamesState> = {}): RootState {
  return makeState({ byId: { [game.id]: game }, ...extra });
}

// ─── Reducer tests ───────────────────────────────────────────────────────────

describe("gamesSlice reducer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes to empty state", () => {
    const state = gamesReducer(undefined, { type: "@@INIT" });
    expect(state).toEqual({
      byId: {},
      loading: {},
      actionInFlight: {},
      errors: {},
    });
  });

  it("fetchGame.fulfilled populates byId[gameId] and clears errors[gameId]", async () => {
    // fetchGame.fulfilled is the single write path (gameLoaded was removed)
    mockGetGame.mockResolvedValue(mockGame);
    const store = configureStore({ reducer: { games: gamesReducer } });

    // Pre-seed an error so we can verify it gets cleared
    const { fetchGame } = await import("../thunks");
    mockGetGame.mockRejectedValueOnce(new Error("network error"));
    await store.dispatch(fetchGame({ playerId: PLAYER_ID, gameId: GAME_ID }));
    expect(store.getState().games.errors[GAME_ID]).toBe("network error");

    // Now a successful fetch should clear the error
    mockGetGame.mockResolvedValueOnce(mockGame);
    await store.dispatch(fetchGame({ playerId: PLAYER_ID, gameId: GAME_ID }));

    expect(store.getState().games.byId[GAME_ID]).toEqual(mockGame);
    expect(store.getState().games.errors[GAME_ID]).toBeNull();
  });

  it("fetchGame.fulfilled does not affect other games in byId", async () => {
    const { fetchGame } = await import("../thunks");
    const otherGame: Game = { ...mockGame, id: "other-game-id" };
    mockGetGame.mockResolvedValueOnce(otherGame);
    const store = configureStore({ reducer: { games: gamesReducer } });
    await store.dispatch(
      fetchGame({ playerId: PLAYER_ID, gameId: "other-game-id" }),
    );

    mockGetGame.mockResolvedValueOnce(mockGame);
    await store.dispatch(fetchGame({ playerId: PLAYER_ID, gameId: GAME_ID }));

    expect(store.getState().games.byId["other-game-id"]).toEqual(otherGame);
    expect(store.getState().games.byId[GAME_ID]).toEqual(mockGame);
  });
});

// ─── Selector tests ──────────────────────────────────────────────────────────

describe("selectGameById", () => {
  it("returns the game when present", () => {
    const state = stateWithGame(mockGame);
    expect(selectGameById(state, GAME_ID)).toEqual(mockGame);
  });

  it("returns undefined when game is not loaded", () => {
    const state = makeState();
    expect(selectGameById(state, GAME_ID)).toBeUndefined();
  });
});

describe("selectMyTurn", () => {
  it("returns true when activePlayerId === playerId, false otherwise (both branches)", () => {
    // Not my turn
    const notMyTurnState = stateWithGame(mockGame);
    expect(selectMyTurn(notMyTurnState, GAME_ID, PLAYER_ID)).toBe(false);

    // My turn
    const myTurnState = stateWithGame(mockMyTurnGame);
    expect(selectMyTurn(myTurnState, GAME_ID, PLAYER_ID)).toBe(true);
  });

  it("returns false when game is not loaded", () => {
    const state = makeState();
    expect(selectMyTurn(state, GAME_ID, PLAYER_ID)).toBe(false);
  });

  it("returns false when game is WON (no active round)", () => {
    const state = stateWithGame(mockCompletedGame);
    expect(selectMyTurn(state, GAME_ID, PLAYER_ID)).toBe(false);
  });
});

describe("selectMyHand", () => {
  it("returns Card[] when hands[playerId] is a Card array", () => {
    const state = stateWithGame(mockGame);
    expect(selectMyHand(state, GAME_ID, PLAYER_ID)).toEqual(MY_HAND);
  });

  it("returns [] when hands[playerId] is a number (all three branches)", () => {
    // Branch 1: value is a number
    const numericHandGame: Game = {
      ...mockGame,
      active: { ...mockActiveRound, hands: { [PLAYER_ID]: 5 } },
    };
    const numericState = stateWithGame(numericHandGame);
    expect(selectMyHand(numericState, GAME_ID, PLAYER_ID)).toEqual([]);

    // Branch 2: key is missing entirely
    const missingHandGame: Game = {
      ...mockGame,
      active: { ...mockActiveRound, hands: {} },
    };
    const missingState = stateWithGame(missingHandGame);
    expect(selectMyHand(missingState, GAME_ID, PLAYER_ID)).toEqual([]);

    // Branch 3: game not loaded
    const emptyState = makeState();
    expect(selectMyHand(emptyState, GAME_ID, PLAYER_ID)).toEqual([]);
  });

  it("returns [] when game is WON (no active round)", () => {
    const state = stateWithGame(mockCompletedGame);
    expect(selectMyHand(state, GAME_ID, PLAYER_ID)).toEqual([]);
  });
});

describe("selectActiveRound", () => {
  it("returns the active round when game has an in-progress round", () => {
    const state = stateWithGame(mockGame);
    const activeRound = selectActiveRound(state, GAME_ID);
    expect(activeRound).not.toBeNull();
    expect(activeRound?.status).toBe("BIDDING");
  });

  it("returns null when game.active.status === 'WON'", () => {
    const state = stateWithGame(mockCompletedGame);
    expect(selectActiveRound(state, GAME_ID)).toBeNull();
  });

  it("returns null when game is not loaded", () => {
    const state = makeState();
    expect(selectActiveRound(state, GAME_ID)).toBeNull();
  });
});

describe("selectCompletedRounds", () => {
  it("returns completedRounds from a loaded game", () => {
    const state = stateWithGame(mockCompletedGame);
    const rounds = selectCompletedRounds(state, GAME_ID);
    expect(rounds).toHaveLength(1);
    expect(rounds[0].status).toBe("COMPLETED");
  });

  it("returns [] when game is not loaded (no throw)", () => {
    const state = makeState();
    expect(selectCompletedRounds(state, GAME_ID)).toEqual([]);
  });

  it("returns referentially equal array on no-op state update (memoization check)", () => {
    const state = stateWithGame(mockCompletedGame);

    const first = selectCompletedRounds(state, GAME_ID);
    const second = selectCompletedRounds(state, GAME_ID);

    // Same state object → same reference (createSelector memoization)
    expect(first).toBe(second);
  });
});

describe("selectors return safe defaults when byId[gameId] is undefined", () => {
  it("selectActiveRound returns null (no throw)", () => {
    const state = makeState();
    expect(() => selectActiveRound(state, GAME_ID)).not.toThrow();
    expect(selectActiveRound(state, GAME_ID)).toBeNull();
  });

  it("selectMyHand returns [] (no throw)", () => {
    const state = makeState();
    expect(() => selectMyHand(state, GAME_ID, PLAYER_ID)).not.toThrow();
    expect(selectMyHand(state, GAME_ID, PLAYER_ID)).toEqual([]);
  });

  it("selectCompletedRounds returns [] (no throw)", () => {
    const state = makeState();
    expect(() => selectCompletedRounds(state, GAME_ID)).not.toThrow();
    expect(selectCompletedRounds(state, GAME_ID)).toEqual([]);
  });
});
