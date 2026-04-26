import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGameState } from "../use-game-state";

// Mock dependencies
vi.mock("../use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/api/games", () => ({
  getGame: vi.fn(),
}));

vi.mock("../use-polling", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../use-polling")>();
  return {
    ...actual,
    usePolling: vi.fn(actual.usePolling),
  };
});

import { useAuth } from "../use-auth";
import { getGame } from "@/lib/api/games";
import { usePolling } from "../use-polling";

const mockUsePolling = vi.mocked(usePolling);
const mockUseAuth = vi.mocked(useAuth);
const mockGetGame = vi.mocked(getGame);

const PLAYER_ID = "player-uid-123";
const OTHER_PLAYER_ID = "other-player";
const GAME_ID = "game-abc-456";

// A hand with one card belonging to the current player
const MY_HAND = [{ number: "ACE" as const, suit: "SPADES" as const }];

// Active round where it's NOT the current player's turn
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

// Active round where it IS the current player's turn
const mockMyTurnRound = {
  ...mockActiveRound,
  activePlayerId: PLAYER_ID,
};

// Active round in TRICKS phase
const mockTricksRound = {
  ...mockActiveRound,
  status: "TRICKS" as const,
};

// Completed round
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

// No-bidders completed round
const mockNoBiddersRound = {
  status: "COMPLETED_NO_BIDDERS" as const,
  dealerPlayerId: OTHER_PLAYER_ID,
  initialHands: { [PLAYER_ID]: MY_HAND },
};

// Base Game with one active round
const mockGame = {
  id: GAME_ID,
  name: "Test Game",
  players: [
    { id: PLAYER_ID, type: "human" as const },
    { id: OTHER_PLAYER_ID, type: "human" as const },
  ],
  scores: { [PLAYER_ID]: 0, [OTHER_PLAYER_ID]: 0 },
  active: mockActiveRound,
  completedRounds: [],
};

// Game where it's the current player's turn
const mockMyTurnGame = {
  ...mockGame,
  active: mockMyTurnRound,
};

// Game that is completed (has a winner)
const mockCompletedGame = {
  ...mockGame,
  active: {
    status: "WON" as const,
    winnerPlayerId: OTHER_PLAYER_ID,
  },
  completedRounds: [mockCompletedRound],
};

// Game with two completed rounds and one active round
const mockMultiRoundGame = {
  ...mockGame,
  active: mockActiveRound,
  completedRounds: [mockCompletedRound, mockNoBiddersRound],
};

// Game with only completed rounds (no active round — game won)
const mockAllCompletedGame = {
  ...mockGame,
  active: {
    status: "WON" as const,
    winnerPlayerId: OTHER_PLAYER_ID,
  },
  completedRounds: [mockCompletedRound, mockNoBiddersRound],
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
    mockGetGame.mockResolvedValue(mockGame as never);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ─── Endpoint ──────────────────────────────────────────────────────────────

  it("fetches from the getGame", async () => {
    renderHook(() => useGameState({ gameId: GAME_ID, interval: 30000 }));

    await waitFor(() => {
      expect(mockGetGame).toHaveBeenCalledTimes(1);
    });
    expect(mockGetGame).toHaveBeenCalledWith(PLAYER_ID, GAME_ID);
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
      ...mockGame,
      active: { ...mockActiveRound, hands: { [PLAYER_ID]: 5 } },
    };
    mockGetGame.mockResolvedValue(gameWithNumericHand as never);

    const { result } = renderHook(() =>
      useGameState({ gameId: GAME_ID, interval: 30000 }),
    );

    await waitFor(() => {
      expect(result.current.hand).toEqual([]);
    });
  });

  it("falls back to empty array when hands[playerId] is missing", async () => {
    const gameWithMissingHand = {
      ...mockGame,
      active: { ...mockActiveRound, hands: {} },
    };
    mockGetGame.mockResolvedValue(gameWithMissingHand as never);

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
    mockGetGame.mockResolvedValue({
      ...mockGame,
      active: mockTricksRound,
    } as never);

    const { result } = renderHook(() =>
      useGameState({ gameId: GAME_ID, interval: 30000 }),
    );

    await waitFor(() => {
      expect(result.current.phase).toBe("TRICKS");
    });
  });

  it("returns phase null when there is no active round", async () => {
    mockGetGame.mockResolvedValue(mockAllCompletedGame as never);

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
    mockGetGame.mockResolvedValue(mockMyTurnGame as never);

    const { result } = renderHook(() =>
      useGameState({ gameId: GAME_ID, interval: 30000 }),
    );

    await waitFor(() => {
      expect(result.current.myTurn).toBe(true);
    });
  });

  // ─── isCompleted / winner ──────────────────────────────────────────────────

  it("derives isCompleted true when game.winner is set", async () => {
    mockGetGame.mockResolvedValue(mockCompletedGame as never);

    const { result } = renderHook(() =>
      useGameState({ gameId: GAME_ID, interval: 30000 }),
    );

    await waitFor(() => {
      expect(result.current.isCompleted).toBe(true);
    });
  });

  it("derives isCompleted false when active round is in-progress", async () => {
    const { result } = renderHook(() =>
      useGameState({ gameId: GAME_ID, interval: 30000 }),
    );

    await waitFor(() => {
      expect(result.current.isCompleted).toBe(false);
    });
  });

  it("exposes the winner from won information", async () => {
    mockGetGame.mockResolvedValue(mockCompletedGame as never);

    const { result } = renderHook(() =>
      useGameState({ gameId: GAME_ID, interval: 30000 }),
    );

    await waitFor(() => {
      expect(result.current.winner).toEqual({
        id: OTHER_PLAYER_ID,
        type: "human",
      });
    });
  });

  // ─── activeRound / completedRounds ─────────────────────────────────────────

  it("returns activeRound as null when all rounds are completed", async () => {
    mockGetGame.mockResolvedValue(mockAllCompletedGame as never);

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
    mockGetGame.mockResolvedValue(mockMultiRoundGame as never);

    const { result } = renderHook(() =>
      useGameState({ gameId: GAME_ID, interval: 30000 }),
    );

    await waitFor(() => {
      expect(result.current.completedRounds).toHaveLength(2);
      expect(result.current.completedRounds[0].status).toBe("COMPLETED");
      expect(result.current.completedRounds[1].status).toBe(
        "COMPLETED_NO_BIDDERS",
      );
    });
  });

  // ─── Polling control ───────────────────────────────────────────────────────

  it("starts polling immediately on mount (waiting for opponent)", async () => {
    renderHook(() => useGameState({ gameId: GAME_ID, interval: 30000 }));

    await waitFor(() => {
      expect(mockGetGame).toHaveBeenCalledTimes(1);
    });
  });

  it("polls at the configured interval when waiting for opponent", async () => {
    renderHook(() => useGameState({ gameId: GAME_ID, interval: 30000 }));

    await waitFor(() => {
      expect(mockGetGame).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    await waitFor(() => {
      expect(mockGetGame).toHaveBeenCalledTimes(2);
    });
  });

  it("disables polling after myTurn becomes true", async () => {
    mockGetGame.mockResolvedValue(mockMyTurnGame as never);

    renderHook(() => useGameState({ gameId: GAME_ID, interval: 30000 }));

    await waitFor(() => {
      expect(mockGetGame).toHaveBeenCalledTimes(1);
    });

    const callsBefore = mockGetGame.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    expect(mockGetGame.mock.calls.length).toBe(callsBefore);
  });

  it("disables polling when game is completed", async () => {
    mockGetGame.mockResolvedValue(mockCompletedGame as never);

    renderHook(() => useGameState({ gameId: GAME_ID, interval: 30000 }));

    await waitFor(() => {
      expect(mockGetGame).toHaveBeenCalledTimes(1);
    });

    const callsBefore = mockGetGame.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    expect(mockGetGame.mock.calls.length).toBe(callsBefore);
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

    expect(mockGetGame).not.toHaveBeenCalled();
  });

  it("forwards the configured interval to usePolling when waiting for opponent", async () => {
    renderHook(() => useGameState({ gameId: GAME_ID, interval: 30000 }));

    await waitFor(() => {
      expect(mockGetGame).toHaveBeenCalledTimes(1);
    });

    expect(mockUsePolling).toHaveBeenCalledWith(
      expect.objectContaining({ interval: 30000 }),
    );
  });
});
