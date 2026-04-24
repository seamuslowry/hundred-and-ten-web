import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGameState } from "../use-game-state";

// Mock dependencies
vi.mock("../use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/api/games", () => ({
  getSpikeGame: vi.fn(),
}));

vi.mock("../use-polling", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../use-polling")>();
  return {
    ...actual,
    usePolling: vi.fn(actual.usePolling),
  };
});

import { useAuth } from "../use-auth";
import { getSpikeGame } from "@/lib/api/games";
import { usePolling } from "../use-polling";

const mockUsePolling = vi.mocked(usePolling);
const mockUseAuth = vi.mocked(useAuth);
const mockGetSpikeGame = vi.mocked(getSpikeGame);

const PLAYER_ID = "player-uid-123";
const OTHER_PLAYER_ID = "other-player";
const GAME_ID = "game-abc-456";

// A hand with one card belonging to the current player
const MY_HAND = [{ number: "ACE" as const, suit: "SPADES" as const }];

// Active round where it's NOT the current player's turn
const mockActiveRound = {
  status: "BIDDING" as const,
  dealer_player_id: OTHER_PLAYER_ID,
  bid_history: [],
  hands: { [PLAYER_ID]: MY_HAND, [OTHER_PLAYER_ID]: 5 },
  discards: {},
  bidder_player_id: null,
  bid_amount: null,
  trump: null,
  tricks: [],
  active_player_id: OTHER_PLAYER_ID,
  queued_actions: [],
};

// Active round where it IS the current player's turn
const mockMyTurnRound = {
  ...mockActiveRound,
  active_player_id: PLAYER_ID,
};

// Active round in TRICKS phase
const mockTricksRound = {
  ...mockActiveRound,
  status: "TRICKS" as const,
};

// Completed round
const mockCompletedRound = {
  status: "COMPLETED" as const,
  dealer_player_id: OTHER_PLAYER_ID,
  bidder_player_id: OTHER_PLAYER_ID,
  bid_amount: 20,
  trump: "SPADES" as const,
  bid_history: [],
  hands: { [PLAYER_ID]: MY_HAND, [OTHER_PLAYER_ID]: MY_HAND },
  discards: {},
  tricks: [],
  scores: { [PLAYER_ID]: 0, [OTHER_PLAYER_ID]: 20 },
};

// No-bidders completed round
const mockNoBiddersRound = {
  status: "COMPLETED_NO_BIDDERS" as const,
  dealer_player_id: OTHER_PLAYER_ID,
  initial_hands: { [PLAYER_ID]: MY_HAND },
};

// Base SpikeGame with one active round
const mockSpikeGame = {
  id: GAME_ID,
  name: "Test Game",
  status: "BIDDING",
  winner: null,
  players: [{ id: PLAYER_ID, type: "human" as const }, { id: OTHER_PLAYER_ID, type: "human" as const }],
  scores: { [PLAYER_ID]: 0, [OTHER_PLAYER_ID]: 0 },
  rounds: [mockActiveRound],
};

// SpikeGame where it's the current player's turn
const mockMyTurnGame = {
  ...mockSpikeGame,
  rounds: [mockMyTurnRound],
};

// SpikeGame that is completed (has a winner)
const mockCompletedGame = {
  ...mockSpikeGame,
  status: "WON",
  winner: { id: OTHER_PLAYER_ID, type: "human" as const },
  rounds: [mockCompletedRound],
};

// SpikeGame with two completed rounds and one active round
const mockMultiRoundGame = {
  ...mockSpikeGame,
  rounds: [mockCompletedRound, mockNoBiddersRound, mockActiveRound],
};

// SpikeGame with only completed rounds (no active round)
const mockAllCompletedGame = {
  ...mockSpikeGame,
  rounds: [mockCompletedRound, mockNoBiddersRound],
};

describe("useGameState", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockUseAuth.mockReturnValue({
      user: { uid: PLAYER_ID } as ReturnType<typeof useAuth>["user"],
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      getToken: vi.fn(),
    });
    mockGetSpikeGame.mockResolvedValue(mockSpikeGame as never);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ─── Endpoint ──────────────────────────────────────────────────────────────

  it("fetches from the spike endpoint (getSpikeGame, not getGame)", async () => {
    renderHook(() => useGameState({ gameId: GAME_ID, interval: 30000 }));

    await waitFor(() => {
      expect(mockGetSpikeGame).toHaveBeenCalledTimes(1);
    });
    expect(mockGetSpikeGame).toHaveBeenCalledWith(PLAYER_ID, GAME_ID);
  });

  // ─── Hand extraction ───────────────────────────────────────────────────────

  it("extracts hand from activeRound.hands[playerId] when value is Card[]", async () => {
    const { result } = renderHook(() =>
      useGameState({ gameId: GAME_ID, interval: 30000 }),
    );

    await waitFor(() => {
      expect(result.current.hand).toEqual(MY_HAND);
    });
  });

  it("falls back to empty array when hands[playerId] is a number", async () => {
    const gameWithNumericHand = {
      ...mockSpikeGame,
      rounds: [{ ...mockActiveRound, hands: { [PLAYER_ID]: 5 } }],
    };
    mockGetSpikeGame.mockResolvedValue(gameWithNumericHand as never);

    const { result } = renderHook(() =>
      useGameState({ gameId: GAME_ID, interval: 30000 }),
    );

    await waitFor(() => {
      expect(result.current.hand).toEqual([]);
    });
  });

  it("falls back to empty array when hands[playerId] is missing", async () => {
    const gameWithMissingHand = {
      ...mockSpikeGame,
      rounds: [{ ...mockActiveRound, hands: {} }],
    };
    mockGetSpikeGame.mockResolvedValue(gameWithMissingHand as never);

    const { result } = renderHook(() =>
      useGameState({ gameId: GAME_ID, interval: 30000 }),
    );

    await waitFor(() => {
      expect(result.current.hand).toEqual([]);
    });
  });

  // ─── Phase ─────────────────────────────────────────────────────────────────

  it("derives phase from activeRound.status", async () => {
    const { result } = renderHook(() =>
      useGameState({ gameId: GAME_ID, interval: 30000 }),
    );

    await waitFor(() => {
      expect(result.current.phase).toBe("BIDDING");
    });
  });

  it("derives phase as TRICKS when activeRound is in TRICKS", async () => {
    mockGetSpikeGame.mockResolvedValue({
      ...mockSpikeGame,
      rounds: [mockTricksRound],
    } as never);

    const { result } = renderHook(() =>
      useGameState({ gameId: GAME_ID, interval: 30000 }),
    );

    await waitFor(() => {
      expect(result.current.phase).toBe("TRICKS");
    });
  });

  it("returns phase null when there is no active round", async () => {
    mockGetSpikeGame.mockResolvedValue(mockAllCompletedGame as never);

    const { result } = renderHook(() =>
      useGameState({ gameId: GAME_ID, interval: 30000 }),
    );

    await waitFor(() => {
      expect(result.current.phase).toBeNull();
    });
  });

  // ─── myTurn ────────────────────────────────────────────────────────────────

  it("derives myTurn false when active player is not self", async () => {
    const { result } = renderHook(() =>
      useGameState({ gameId: GAME_ID, interval: 30000 }),
    );

    await waitFor(() => {
      expect(result.current.myTurn).toBe(false);
    });
  });

  it("derives myTurn true when activeRound.active_player_id === playerId", async () => {
    mockGetSpikeGame.mockResolvedValue(mockMyTurnGame as never);

    const { result } = renderHook(() =>
      useGameState({ gameId: GAME_ID, interval: 30000 }),
    );

    await waitFor(() => {
      expect(result.current.myTurn).toBe(true);
    });
  });

  // ─── isCompleted / winner ──────────────────────────────────────────────────

  it("derives isCompleted true when game.winner is set", async () => {
    mockGetSpikeGame.mockResolvedValue(mockCompletedGame as never);

    const { result } = renderHook(() =>
      useGameState({ gameId: GAME_ID, interval: 30000 }),
    );

    await waitFor(() => {
      expect(result.current.isCompleted).toBe(true);
    });
  });

  it("derives isCompleted false when game.winner is null", async () => {
    const { result } = renderHook(() =>
      useGameState({ gameId: GAME_ID, interval: 30000 }),
    );

    await waitFor(() => {
      expect(result.current.isCompleted).toBe(false);
    });
  });

  it("exposes the winner from game.winner", async () => {
    mockGetSpikeGame.mockResolvedValue(mockCompletedGame as never);

    const { result } = renderHook(() =>
      useGameState({ gameId: GAME_ID, interval: 30000 }),
    );

    await waitFor(() => {
      expect(result.current.winner).toEqual({ id: OTHER_PLAYER_ID, type: "human" });
    });
  });

  // ─── activeRound / completedRounds ─────────────────────────────────────────

  it("returns activeRound as null when all rounds are completed", async () => {
    mockGetSpikeGame.mockResolvedValue(mockAllCompletedGame as never);

    const { result } = renderHook(() =>
      useGameState({ gameId: GAME_ID, interval: 30000 }),
    );

    await waitFor(() => {
      expect(result.current.activeRound).toBeNull();
    });
  });

  it("returns active round when an in-progress round exists", async () => {
    const { result } = renderHook(() =>
      useGameState({ gameId: GAME_ID, interval: 30000 }),
    );

    await waitFor(() => {
      expect(result.current.activeRound).not.toBeNull();
      expect(result.current.activeRound?.status).toBe("BIDDING");
    });
  });

  it("completedRounds contains exactly the non-active rounds", async () => {
    mockGetSpikeGame.mockResolvedValue(mockMultiRoundGame as never);

    const { result } = renderHook(() =>
      useGameState({ gameId: GAME_ID, interval: 30000 }),
    );

    await waitFor(() => {
      expect(result.current.completedRounds).toHaveLength(2);
      expect(result.current.completedRounds[0].status).toBe("COMPLETED");
      expect(result.current.completedRounds[1].status).toBe("COMPLETED_NO_BIDDERS");
    });
  });

  // ─── Polling control ───────────────────────────────────────────────────────

  it("starts polling immediately on mount (waiting for opponent)", async () => {
    renderHook(() => useGameState({ gameId: GAME_ID, interval: 30000 }));

    await waitFor(() => {
      expect(mockGetSpikeGame).toHaveBeenCalledTimes(1);
    });
  });

  it("polls at the configured interval when waiting for opponent", async () => {
    renderHook(() => useGameState({ gameId: GAME_ID, interval: 30000 }));

    await waitFor(() => {
      expect(mockGetSpikeGame).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    await waitFor(() => {
      expect(mockGetSpikeGame).toHaveBeenCalledTimes(2);
    });
  });

  it("disables polling after myTurn becomes true", async () => {
    mockGetSpikeGame.mockResolvedValue(mockMyTurnGame as never);

    renderHook(() => useGameState({ gameId: GAME_ID, interval: 30000 }));

    await waitFor(() => {
      expect(mockGetSpikeGame).toHaveBeenCalledTimes(1);
    });

    const callsBefore = mockGetSpikeGame.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    expect(mockGetSpikeGame.mock.calls.length).toBe(callsBefore);
  });

  it("disables polling when game is completed", async () => {
    mockGetSpikeGame.mockResolvedValue(mockCompletedGame as never);

    renderHook(() => useGameState({ gameId: GAME_ID, interval: 30000 }));

    await waitFor(() => {
      expect(mockGetSpikeGame).toHaveBeenCalledTimes(1);
    });

    const callsBefore = mockGetSpikeGame.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    expect(mockGetSpikeGame.mock.calls.length).toBe(callsBefore);
  });

  it("does not poll when unauthenticated (auth gate wins)", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      getToken: vi.fn(),
    });

    renderHook(() => useGameState({ gameId: GAME_ID, interval: 30000 }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    expect(mockGetSpikeGame).not.toHaveBeenCalled();
  });

  it("forwards the configured interval to usePolling when waiting for opponent", async () => {
    renderHook(() => useGameState({ gameId: GAME_ID, interval: 30000 }));

    await waitFor(() => {
      expect(mockGetSpikeGame).toHaveBeenCalledTimes(1);
    });

    expect(mockUsePolling).toHaveBeenCalledWith(
      expect.objectContaining({ interval: 30000 }),
    );
  });
});
