import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useLobbyGameStart } from "../use-lobby-game-start";

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
import { ApiError } from "@/lib/api/client";

const mockUsePolling = vi.mocked(usePolling);
const mockUseAuth = vi.mocked(useAuth);
const mockGetSpikeGame = vi.mocked(getSpikeGame);

const PLAYER_ID = "player-uid-123";
const LOBBY_ID = "lobby-abc-456";

// Minimal SpikeGame response — only needs to resolve successfully
const mockSpikeGame = {
  id: LOBBY_ID,
  name: "Test Game",
  players: [{ id: PLAYER_ID, type: "human" as const }],
  scores: { [PLAYER_ID]: 0 },
  active: {
    status: "BIDDING" as const,
    dealer_player_id: PLAYER_ID,
    bid_history: [],
    bid: null,
    hands: { [PLAYER_ID]: [] },
    discards: {},
    trump: null,
    tricks: [],
    active_player_id: PLAYER_ID,
    queued_actions: [],
  },
  completed_rounds: [],
};

describe("useLobbyGameStart", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockUseAuth.mockReturnValue({
      user: { uid: PLAYER_ID } as ReturnType<typeof useAuth>["user"],
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      getToken: vi.fn(),
    });
    mockGetSpikeGame.mockRejectedValue(
      new ApiError(404, "Game not found") as never,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ─── Game start detection ──────────────────────────────────────────────────

  it("returns gameStarted true when getSpikeGame resolves successfully", async () => {
    mockGetSpikeGame.mockResolvedValue(mockSpikeGame as never);

    const { result } = renderHook(() =>
      useLobbyGameStart({ lobbyId: LOBBY_ID }),
    );

    await waitFor(() => {
      expect(result.current.gameStarted).toBe(true);
    });
  });

  it("returns gameStarted false when getSpikeGame throws ApiError(404)", async () => {
    const { result } = renderHook(() =>
      useLobbyGameStart({ lobbyId: LOBBY_ID }),
    );

    await waitFor(() => {
      expect(mockGetSpikeGame).toHaveBeenCalledTimes(1);
    });

    expect(result.current.gameStarted).toBe(false);
    expect(result.current.error).toBeNull();
  });

  // ─── Error handling ────────────────────────────────────────────────────────

  it("sets error when getSpikeGame throws a non-404 error", async () => {
    const networkError = new Error("Network failure");
    mockGetSpikeGame.mockRejectedValue(networkError as never);

    const { result } = renderHook(() =>
      useLobbyGameStart({ lobbyId: LOBBY_ID }),
    );

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(result.current.error?.message).toBe("Network failure");
    expect(result.current.gameStarted).toBe(false);
  });

  it("sets error when getSpikeGame throws ApiError with non-404 status", async () => {
    mockGetSpikeGame.mockRejectedValue(
      new ApiError(500, "Internal Server Error") as never,
    );

    const { result } = renderHook(() =>
      useLobbyGameStart({ lobbyId: LOBBY_ID }),
    );

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(result.current.error?.message).toBe("Internal Server Error");
    expect(result.current.gameStarted).toBe(false);
  });

  // ─── Polling configuration ─────────────────────────────────────────────────

  it("forwards default interval (5000) to usePolling", async () => {
    renderHook(() => useLobbyGameStart({ lobbyId: LOBBY_ID }));

    await waitFor(() => {
      expect(mockGetSpikeGame).toHaveBeenCalledTimes(1);
    });

    expect(mockUsePolling).toHaveBeenCalledWith(
      expect.objectContaining({ interval: 5000, enabled: true }),
    );
  });

  it("forwards custom interval to usePolling", async () => {
    renderHook(() => useLobbyGameStart({ lobbyId: LOBBY_ID, interval: 10000 }));

    await waitFor(() => {
      expect(mockGetSpikeGame).toHaveBeenCalledTimes(1);
    });

    expect(mockUsePolling).toHaveBeenCalledWith(
      expect.objectContaining({ interval: 10000 }),
    );
  });

  it("disables polling when unauthenticated", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      getToken: vi.fn(),
    });

    renderHook(() => useLobbyGameStart({ lobbyId: LOBBY_ID }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    expect(mockGetSpikeGame).not.toHaveBeenCalled();
  });

  // ─── Polling continues until game detected ─────────────────────────────────

  it("continues polling while game has not started (404 is not an error)", async () => {
    renderHook(() => useLobbyGameStart({ lobbyId: LOBBY_ID, interval: 5000 }));

    await waitFor(() => {
      expect(mockGetSpikeGame).toHaveBeenCalledTimes(1);
    });

    // 404 is treated as success by the fetcher, so no backoff — next poll at 5s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    await waitFor(() => {
      expect(mockGetSpikeGame).toHaveBeenCalledTimes(2);
    });
  });
});
