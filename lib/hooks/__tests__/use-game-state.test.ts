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

import { useAuth } from "../use-auth";
import { getGame } from "@/lib/api/games";

const mockUseAuth = vi.mocked(useAuth);
const mockGetGame = vi.mocked(getGame);

const PLAYER_ID = "player-uid-123";
const GAME_ID = "game-abc-456";

const mockStartedGame = {
  status: "BIDDING" as const,
  id: GAME_ID,
  active_player_id: "other-player",
  players: [],
  scores: {},
  bid_amount: null,
  bidder_player_id: null,
  dealer_player_id: null,
  trump: null,
};

const mockMyTurnGame = {
  ...mockStartedGame,
  active_player_id: PLAYER_ID,
};

const mockCompletedGame = {
  status: "WON" as const,
  id: GAME_ID,
  winner: { id: "other-player" },
  scores: {},
  players: [],
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
    mockGetGame.mockResolvedValue(mockStartedGame as never);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("starts polling immediately on mount (waiting for opponent)", async () => {
    renderHook(() => useGameState({ gameId: GAME_ID, interval: 30000 }));

    await waitFor(() => {
      expect(mockGetGame).toHaveBeenCalledTimes(1);
    });
  });

  it("derives myTurn false when active player is not self", async () => {
    const { result } = renderHook(() =>
      useGameState({ gameId: GAME_ID, interval: 30000 }),
    );

    await waitFor(() => {
      expect(result.current.myTurn).toBe(false);
    });
  });

  it("derives myTurn true when active player is self", async () => {
    mockGetGame.mockResolvedValue(mockMyTurnGame as never);

    const { result } = renderHook(() =>
      useGameState({ gameId: GAME_ID, interval: 30000 }),
    );

    await waitFor(() => {
      expect(result.current.myTurn).toBe(true);
    });
  });

  it("disables polling after myTurn becomes true", async () => {
    mockGetGame.mockResolvedValue(mockMyTurnGame as never);

    renderHook(() => useGameState({ gameId: GAME_ID, interval: 30000 }));

    // Wait for initial fetch to complete
    await waitFor(() => {
      expect(mockGetGame).toHaveBeenCalledTimes(1);
    });

    const callsBefore = mockGetGame.mock.calls.length;

    // Advance well past the 30s interval — should not poll again
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
});
