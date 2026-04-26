import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import gamesReducer from "@/store/games/slice";
import { useGamePolling } from "../use-game-polling";

// ─── Module mocks ────────────────────────────────────────────────────────────

vi.mock("../use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/api/games", () => ({
  getGame: vi.fn(),
  performAction: vi.fn(),
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

const mockUseAuth = vi.mocked(useAuth);
const mockGetGame = vi.mocked(getGame);
const mockUsePolling = vi.mocked(usePolling);

// ─── Constants ───────────────────────────────────────────────────────────────

const PLAYER_ID = "player-uid-123";
const OTHER_PLAYER_ID = "other-player";
const GAME_ID = "game-abc-456";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockActiveRound = {
  status: "BIDDING" as const,
  dealerPlayerId: OTHER_PLAYER_ID,
  bidHistory: [],
  bid: null,
  hands: {
    [PLAYER_ID]: [{ number: "ACE" as const, suit: "SPADES" as const }],
    [OTHER_PLAYER_ID]: 5,
  },
  discards: {},
  trump: null,
  tricks: [],
  activePlayerId: OTHER_PLAYER_ID, // not my turn
  queuedActions: [],
};

const mockMyTurnRound = {
  ...mockActiveRound,
  activePlayerId: PLAYER_ID,
};

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

const mockMyTurnGame = {
  ...mockGame,
  active: mockMyTurnRound,
};

const mockCompletedGame = {
  ...mockGame,
  active: {
    status: "WON" as const,
    winnerPlayerId: OTHER_PLAYER_ID,
  },
  completedRounds: [],
};

// ─── Store + wrapper helpers ─────────────────────────────────────────────────

function makeTestStore() {
  return configureStore({
    reducer: { games: gamesReducer },
  });
}

type TestStore = ReturnType<typeof makeTestStore>;

function makeWrapper(store: TestStore) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

function renderWithStore(
  hook: () => ReturnType<typeof useGamePolling>,
  store?: TestStore,
) {
  const testStore = store ?? makeTestStore();
  const wrapper = makeWrapper(testStore);
  const result = renderHook(hook, { wrapper });
  return { ...result, store: testStore };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("useGamePolling", () => {
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

  // ─── Happy path ────────────────────────────────────────────────────────────

  it("calls usePolling with a fetcher, configured interval, and enabled:true when authenticated and not on my turn", async () => {
    renderWithStore(() => useGamePolling({ gameId: GAME_ID, interval: 30000 }));

    await waitFor(() => {
      expect(mockGetGame).toHaveBeenCalledTimes(1);
    });

    expect(mockUsePolling).toHaveBeenCalledWith(
      expect.objectContaining({
        interval: 30000,
        enabled: true,
      }),
    );
    expect(mockGetGame).toHaveBeenCalledWith(PLAYER_ID, GAME_ID);
  });

  it("uses default interval of 3000 when no interval is provided", async () => {
    renderWithStore(() => useGamePolling({ gameId: GAME_ID }));

    await waitFor(() => {
      expect(mockGetGame).toHaveBeenCalledTimes(1);
    });

    expect(mockUsePolling).toHaveBeenCalledWith(
      expect.objectContaining({ interval: 3000 }),
    );
  });

  // ─── Polling pauses on myTurn ──────────────────────────────────────────────

  it("sets enabled:false when the store reports myTurn is true", async () => {
    mockGetGame.mockResolvedValue(mockMyTurnGame as never);

    renderWithStore(() => useGamePolling({ gameId: GAME_ID, interval: 30000 }));

    // Wait for the first fetch to complete, which loads myTurnGame into the store
    await waitFor(() => {
      expect(mockGetGame).toHaveBeenCalledTimes(1);
    });

    const callsBefore = mockGetGame.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    // No additional fetches — polling was disabled once myTurn became true
    expect(mockGetGame.mock.calls.length).toBe(callsBefore);

    // Confirm usePolling was called with enabled:false at some point
    const lastCall =
      mockUsePolling.mock.calls[mockUsePolling.mock.calls.length - 1];
    expect(lastCall[0]).toMatchObject({ enabled: false });
  });

  // ─── Polling pauses on isCompleted ────────────────────────────────────────

  it("sets enabled:false when the store reports game is completed (WON)", async () => {
    mockGetGame.mockResolvedValue(mockCompletedGame as never);

    renderWithStore(() => useGamePolling({ gameId: GAME_ID, interval: 30000 }));

    await waitFor(() => {
      expect(mockGetGame).toHaveBeenCalledTimes(1);
    });

    const callsBefore = mockGetGame.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    expect(mockGetGame.mock.calls.length).toBe(callsBefore);

    const lastCall =
      mockUsePolling.mock.calls[mockUsePolling.mock.calls.length - 1];
    expect(lastCall[0]).toMatchObject({ enabled: false });
  });

  // ─── Auth gate ────────────────────────────────────────────────────────────

  it("does not poll when unauthenticated (playerId is empty)", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      getToken: vi.fn(),
    });

    renderWithStore(() => useGamePolling({ gameId: GAME_ID, interval: 30000 }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    expect(mockGetGame).not.toHaveBeenCalled();
    expect(mockUsePolling).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  // ─── Manual refetch ───────────────────────────────────────────────────────

  it("refetch() triggers a fetchGame dispatch even when polling is disabled (myTurn=true)", async () => {
    // Load the game first in a store so myTurn becomes true
    mockGetGame.mockResolvedValue(mockMyTurnGame as never);

    const { result } = renderWithStore(() =>
      useGamePolling({ gameId: GAME_ID, interval: 30000 }),
    );

    // Wait for the initial fetch that disables polling
    await waitFor(() => {
      expect(mockGetGame).toHaveBeenCalledTimes(1);
    });

    const callsBefore = mockGetGame.mock.calls.length;

    // Manually trigger refetch — should fire even though polling is paused
    await act(async () => {
      await result.current.refetch();
    });

    expect(mockGetGame.mock.calls.length).toBe(callsBefore + 1);
    expect(mockGetGame).toHaveBeenLastCalledWith(PLAYER_ID, GAME_ID);
  });

  // ─── Returns only refetch ─────────────────────────────────────────────────

  it("returns only { refetch } — no game data", async () => {
    const { result } = renderWithStore(() =>
      useGamePolling({ gameId: GAME_ID, interval: 30000 }),
    );

    await waitFor(() => {
      expect(mockGetGame).toHaveBeenCalledTimes(1);
    });

    expect(Object.keys(result.current)).toEqual(["refetch"]);
    expect(typeof result.current.refetch).toBe("function");
  });

  // ─── StrictMode ───────────────────────────────────────────────────────────

  it("under React StrictMode, loading[gameId] is not stuck true after double-mount stabilizes", async () => {
    // React StrictMode double-invokes effects in development. This test verifies
    // that after the double-mount stabilizes, loading[gameId] is false and we
    // do not have a permanently-pending fetchGame stuck in the loading map.
    const strictStore = makeTestStore();

    renderHook(() => useGamePolling({ gameId: GAME_ID, interval: 30000 }), {
      wrapper: ({ children }) => (
        <React.StrictMode>
          <Provider store={strictStore}>{children}</Provider>
        </React.StrictMode>
      ),
    });

    // Wait for fetches to land (getGame may be called 1-2 times due to StrictMode)
    await waitFor(() => {
      expect(mockGetGame).toHaveBeenCalled();
    });

    // Advance timers a small amount to allow all pending microtasks/promises to
    // settle without triggering the infinite polling loop
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // After StrictMode double-mount stabilizes, loading should not be stuck true
    const state = strictStore.getState();
    expect(state.games.loading[GAME_ID]).toBeFalsy();
  });
});
