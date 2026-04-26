import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import React from "react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import gamesReducer from "@/store/games/slice";
import type { GamesState } from "@/store/games/slice";
import type {
  ActiveRound,
  PlayerInGame,
  Card,
  GameAction,
} from "@/lib/api/types";
import { GamePage } from "../$gameId";

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useParams: vi.fn().mockReturnValue({ gameId: "game-abc" }),
    Link: ({
      children,
      ...props
    }: {
      children: React.ReactNode;
      to: string;
    }) => <a href={props.to}>{children}</a>,
  };
});

vi.mock("@/components/auth/require-auth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/api/games", () => ({
  getGame: vi.fn(),
  getGamePlayers: vi.fn().mockResolvedValue([]),
  performAction: vi.fn(),
}));

vi.mock("@/components/game/score-board", () => ({
  ScoreBoard: () => <div data-testid="score-board" />,
}));

vi.mock("@/components/game/round-history", () => ({
  RoundHistory: () => <div data-testid="round-history" />,
}));

// ─── GameBoard stub (module-level, hoisted) ───────────────────────────────────
//
// The stub renders enough content to exercise route-level behavior:
//   - "Game Over" when isCompleted + winner (parity: isCompleted, winner display)
//   - Bid button that dispatches performGameAction (parity: action error semantics)
//   - data-testid="is-stale" to verify stale badge behavior
//   - data-testid="hand-size" to verify hand extraction
//   - data-testid="refreshing" + Refresh button for handleRefresh tests
//
// The stub uses useAppDispatch + performGameAction directly (the real thunk
// imported at the top of this file) so action→slice→selector round-trips are real.

vi.mock("@/components/game/game-board", async () => {
  // Dynamic import inside the factory to avoid circular hoisting issues.
  // These modules are not mocked, so they resolve to the real implementations.
  const { useAppDispatch: _useAppDispatch } = await import("@/store/hooks");
  const { performGameAction: _performGameAction } =
    await import("@/store/games/thunks");

  function GameBoard({
    gameId,
    activeRound,
    isCompleted,
    winner,
    hand,
    scores,
    playerNames,
    myTurn,
    isStale,
    playerId,
    onRefresh,
    isRefreshing,
  }: {
    gameId: string;
    activeRound: ActiveRound | null;
    isCompleted: boolean;
    winner: PlayerInGame | null;
    hand: Card[];
    scores: Record<string, number>;
    playerNames: Map<string, string>;
    myTurn: boolean;
    isStale: boolean;
    playerId: string;
    onRefresh?: () => Promise<void>;
    isRefreshing?: boolean;
  }) {
    const dispatch = _useAppDispatch();
    const [actionError, setActionError] = React.useState<string | null>(null);
    const [actionInFlight, setActionInFlight] = React.useState(false);

    async function doAction(action: GameAction) {
      if (!activeRound || actionInFlight) return;
      setActionInFlight(true);
      setActionError(null);
      try {
        await dispatch(
          _performGameAction({ playerId, gameId, action }),
        ).unwrap();
      } catch (e) {
        // rejectWithValue throws a string; Error instances have .message
        setActionError(
          e instanceof Error
            ? e.message
            : typeof e === "string"
              ? e
              : "Action failed",
        );
      } finally {
        setActionInFlight(false);
      }
    }

    if (isCompleted && winner) {
      return (
        <div>
          <span data-testid="game-over">Game Over</span>
          <span data-testid="winner-id">{winner.id}</span>
          <span data-testid="winner-name">
            {playerNames.get(winner.id) ?? winner.id.slice(0, 8)}
          </span>
        </div>
      );
    }

    return (
      <div>
        <span data-testid="refreshing">{String(isRefreshing)}</span>
        <span data-testid="is-stale">{String(isStale)}</span>
        <span data-testid="my-turn">{String(myTurn)}</span>
        <span data-testid="hand-size">{hand.length}</span>
        <span data-testid="scores">{JSON.stringify(scores)}</span>
        <span data-testid="player-id">{playerId}</span>
        {actionError && <span data-testid="action-error">{actionError}</span>}
        <button onClick={onRefresh}>Refresh</button>
        {activeRound && myTurn && activeRound.status === "BIDDING" && (
          <button
            data-testid="bid-button"
            disabled={actionInFlight}
            onClick={() => doAction({ type: "BID", amount: 15 })}
          >
            Bid 15
          </button>
        )}
      </div>
    );
  }

  return { GameBoard };
});

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { useAuth } from "@/lib/hooks/use-auth";
import { getGame, performAction, getGamePlayers } from "@/lib/api/games";

const mockUseAuth = vi.mocked(useAuth);
const mockGetGame = vi.mocked(getGame);
const mockPerformAction = vi.mocked(performAction);
const mockGetGamePlayers = vi.mocked(getGamePlayers);

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAYER_ID = "player-uid-123";
const OTHER_PLAYER_ID = "other-player";
const GAME_ID = "game-abc";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MY_HAND: Card[] = [{ number: "ACE", suit: "SPADES" }];

const mockActiveRound: ActiveRound = {
  status: "BIDDING",
  dealerPlayerId: OTHER_PLAYER_ID,
  bidHistory: [],
  bid: null,
  hands: { [PLAYER_ID]: MY_HAND, [OTHER_PLAYER_ID]: 5 },
  discards: {},
  trump: null,
  tricks: [],
  activePlayerId: OTHER_PLAYER_ID, // not my turn by default
  queuedActions: [],
};

const mockMyTurnRound: ActiveRound = {
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
  completedRounds: [mockCompletedRound],
};

// ─── renderWithStore helper ───────────────────────────────────────────────────

function renderWithStore(
  ui: React.ReactElement,
  initialGames?: Partial<GamesState>,
) {
  const store = configureStore({
    reducer: { games: gamesReducer },
    preloadedState: initialGames
      ? {
          games: {
            byId: {},
            loading: {},
            actionInFlight: {},
            errors: {},
            ...initialGames,
          },
        }
      : undefined,
  });
  return {
    ...render(<Provider store={store}>{ui}</Provider>),
    store,
  };
}

// ─── Shared auth helper ───────────────────────────────────────────────────────

function setupAuth(uid: string | null = PLAYER_ID) {
  mockUseAuth.mockReturnValue({
    user: uid ? ({ uid } as ReturnType<typeof useAuth>["user"]) : null,
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    getToken: vi.fn(),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GamePage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setupAuth();
    mockGetGame.mockResolvedValue(mockGame as never);
    mockGetGamePlayers.mockResolvedValue([]);
    mockPerformAction.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ─── Loading state ───────────────────────────────────────────────────────

  it("shows loading state while game is being fetched", () => {
    mockGetGame.mockImplementation(() => new Promise(() => {}));

    renderWithStore(<GamePage />);

    expect(screen.getByText("Loading game...")).toBeInTheDocument();
  });

  // ─── Game renders after fetch ────────────────────────────────────────────

  it("shows ScoreBoard and RoundHistory after game loads", async () => {
    renderWithStore(<GamePage />);

    await waitFor(() => {
      expect(screen.getByTestId("score-board")).toBeInTheDocument();
    });
    expect(screen.getByTestId("round-history")).toBeInTheDocument();
  });

  // ─── Error state: no cached game ────────────────────────────────────────

  it("shows error when getGame fails and no game is cached", async () => {
    mockGetGame.mockRejectedValue(new Error("network error"));

    renderWithStore(<GamePage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to load game: network error/),
      ).toBeInTheDocument();
    });
  });

  // ─── Stale state: fetch failure with cached game ─────────────────────────

  it("shows stale state when fetch fails but a game is already cached", async () => {
    mockGetGame.mockRejectedValue(new Error("fetch failed"));

    renderWithStore(<GamePage />, {
      byId: { [GAME_ID]: mockGame as never },
    });

    await waitFor(() => {
      expect(mockGetGame).toHaveBeenCalled();
    });

    // With cached game + error: isStale = true, game content still renders
    await waitFor(() => {
      expect(screen.getByTestId("is-stale").textContent).toBe("true");
    });
    expect(screen.getByTestId("score-board")).toBeInTheDocument();
  });

  // ─── handleRefresh ───────────────────────────────────────────────────────

  it("resets isRefreshing to false after refetch resolves", async () => {
    renderWithStore(<GamePage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Refresh" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(screen.getByTestId("refreshing").textContent).toBe("false");
    });
  });

  it("resets isRefreshing to false after refetch rejects", async () => {
    mockGetGame
      .mockResolvedValueOnce(mockGame as never) // initial load
      .mockRejectedValue(new Error("network error")); // subsequent fetches

    renderWithStore(<GamePage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Refresh" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(screen.getByTestId("refreshing").textContent).toBe("false");
    });
  });

  // ─── isCompleted parity ──────────────────────────────────────────────────

  it("shows Game Over when game.active.status is WON", async () => {
    mockGetGame.mockResolvedValue(mockCompletedGame as never);

    renderWithStore(<GamePage />);

    await waitFor(() => {
      expect(screen.getByTestId("game-over")).toBeInTheDocument();
    });
  });

  it("shows winner name when game is completed", async () => {
    mockGetGame.mockResolvedValue(mockCompletedGame as never);
    mockGetGamePlayers.mockResolvedValue([
      { id: OTHER_PLAYER_ID, name: "Alice", pictureUrl: null },
    ]);

    renderWithStore(<GamePage />);

    await waitFor(() => {
      expect(screen.getByTestId("winner-name").textContent).toBe("Alice");
    });
  });

  // ─── activeRound null when WON ───────────────────────────────────────────

  it("activeRound is null (Game Over UI shown, not 'Game not found') when game is WON", async () => {
    mockGetGame.mockResolvedValue(mockCompletedGame as never);

    renderWithStore(<GamePage />);

    await waitFor(() => {
      expect(screen.getByTestId("game-over")).toBeInTheDocument();
    });

    expect(screen.queryByText("Game not found.")).toBeNull();
  });

  // ─── myTurn derivation parity ────────────────────────────────────────────

  it("myTurn is false when activePlayerId !== playerId", async () => {
    mockGetGame.mockResolvedValue(mockGame as never); // activePlayerId = OTHER_PLAYER_ID

    renderWithStore(<GamePage />);

    await waitFor(() => {
      expect(screen.getByTestId("my-turn").textContent).toBe("false");
    });

    // No bid button (myTurn=false)
    expect(screen.queryByTestId("bid-button")).toBeNull();
  });

  it("myTurn is true when activePlayerId === playerId", async () => {
    mockGetGame.mockResolvedValue(mockMyTurnGame as never);

    renderWithStore(<GamePage />);

    await waitFor(() => {
      expect(screen.getByTestId("my-turn").textContent).toBe("true");
    });

    // Bid button visible (myTurn=true + BIDDING phase)
    expect(screen.getByTestId("bid-button")).toBeInTheDocument();
  });

  it("myTurn true → polling halts after first load", async () => {
    mockGetGame.mockResolvedValue(mockMyTurnGame as never);

    renderWithStore(<GamePage />);

    await waitFor(() => {
      expect(mockGetGame).toHaveBeenCalledTimes(1);
    });

    const callsBefore = mockGetGame.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(mockGetGame.mock.calls.length).toBe(callsBefore);
  });

  // ─── isCompleted halts polling ───────────────────────────────────────────

  it("polling halts when game is completed (WON)", async () => {
    mockGetGame.mockResolvedValue(mockCompletedGame as never);

    renderWithStore(<GamePage />);

    await waitFor(() => {
      expect(mockGetGame).toHaveBeenCalledTimes(1);
    });

    const callsBefore = mockGetGame.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(mockGetGame.mock.calls.length).toBe(callsBefore);
  });

  // ─── Unauthenticated → no polling ────────────────────────────────────────

  it("does not poll when unauthenticated", async () => {
    setupAuth(null);

    renderWithStore(<GamePage />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    expect(mockGetGame).not.toHaveBeenCalled();
  });

  // ─── Hand extraction parity ──────────────────────────────────────────────

  it("extracts hand as Card[] when hands[playerId] is an array", async () => {
    mockGetGame.mockResolvedValue(mockMyTurnGame as never);

    renderWithStore(<GamePage />);

    await waitFor(() => {
      expect(screen.getByTestId("hand-size").textContent).toBe(
        String(MY_HAND.length),
      );
    });
  });

  it("falls back to empty hand when hands[playerId] is a number", async () => {
    const gameWithNumericHand = {
      ...mockMyTurnGame,
      active: {
        ...mockMyTurnRound,
        hands: { [PLAYER_ID]: 5, [OTHER_PLAYER_ID]: 5 },
      },
    };
    mockGetGame.mockResolvedValue(gameWithNumericHand as never);

    renderWithStore(<GamePage />);

    await waitFor(() => {
      expect(screen.getByTestId("hand-size").textContent).toBe("0");
    });
  });

  it("falls back to empty hand when hands[playerId] is missing", async () => {
    const gameWithMissingHand = {
      ...mockMyTurnGame,
      active: { ...mockMyTurnRound, hands: {} },
    };
    mockGetGame.mockResolvedValue(gameWithMissingHand as never);

    renderWithStore(<GamePage />);

    await waitFor(() => {
      expect(screen.getByTestId("hand-size").textContent).toBe("0");
    });
  });
});

// ─── Action error vs stale badge parity (cross-layer behavioral) ──────────────

describe("GamePage action error semantics (Key Technical Decisions §6)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setupAuth();
    // Default: myTurn game so bid button is visible
    mockGetGame.mockResolvedValue(mockMyTurnGame as never);
    mockGetGamePlayers.mockResolvedValue([]);
    mockPerformAction.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("action failure shows actionError and does NOT show fetch error or stale badge", async () => {
    mockPerformAction.mockRejectedValue(new Error("Server error"));

    renderWithStore(<GamePage />);

    await waitFor(() => {
      expect(screen.getByTestId("bid-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("bid-button"));

    await waitFor(() => {
      expect(screen.getByTestId("action-error").textContent).toBe(
        "Server error",
      );
    });

    // Slice errors map NOT set — action errors don't pollute fetch error channel
    expect(screen.queryByText(/Failed to load game/)).toBeNull();
    // isStale = false — action failure doesn't trigger stale badge
    expect(screen.getByTestId("is-stale").textContent).toBe("false");
  });

  it("performAction succeeds but re-fetch fails: no actionError, stale state shows", async () => {
    mockGetGame
      .mockResolvedValueOnce(mockMyTurnGame as never) // initial load succeeds
      .mockRejectedValue(new Error("re-fetch failed")); // all subsequent fetches fail

    mockPerformAction.mockResolvedValue([]);

    renderWithStore(<GamePage />);

    await waitFor(() => {
      expect(screen.getByTestId("bid-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("bid-button"));

    await waitFor(() => {
      // re-fetch failed → stale state (game cached, error in slice)
      expect(screen.getByTestId("is-stale").textContent).toBe("true");
    });

    // actionError null — action completed server-side
    expect(screen.queryByTestId("action-error")).toBeNull();
    // Game content still visible (cached)
    expect(screen.getByTestId("score-board")).toBeInTheDocument();
  });

  it("rapid double-click results in one performAction call (actionInFlight guard)", async () => {
    // Make performAction slow so the second click fires while first is in-flight
    let resolveFirst!: (v: never[]) => void;
    const firstCallPromise = new Promise<never[]>((resolve) => {
      resolveFirst = resolve;
    });
    mockPerformAction.mockReturnValueOnce(firstCallPromise as never);
    mockPerformAction.mockResolvedValue([]);

    renderWithStore(<GamePage />);

    await waitFor(() => {
      expect(screen.getByTestId("bid-button")).toBeInTheDocument();
    });

    const bidBtn = screen.getByTestId("bid-button");
    fireEvent.click(bidBtn);
    // bidBtn is now disabled — second click is ignored
    fireEvent.click(bidBtn);

    act(() => {
      resolveFirst([]);
    });

    await waitFor(() => {
      expect(mockPerformAction).toHaveBeenCalledTimes(1);
    });
  });
});
