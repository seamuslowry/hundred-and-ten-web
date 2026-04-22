import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GamePage } from "../game-page";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useParams: vi.fn().mockReturnValue({ gameId: "game-abc" }),
    Link: ({ children, ...props }: { children: React.ReactNode; to: string }) => (
      <a href={props.to}>{children}</a>
    ),
  };
});

vi.mock("@/components/auth/require-auth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/hooks/use-game-state", () => ({
  useGameState: vi.fn(),
}));

vi.mock("@/components/game/game-board", () => ({
  GameBoard: ({
    onRefresh,
    isRefreshing,
  }: {
    onRefresh?: () => Promise<void>;
    isRefreshing?: boolean;
  }) => (
    <div>
      <span data-testid="refreshing">{String(isRefreshing)}</span>
      <button onClick={onRefresh}>Refresh</button>
    </div>
  ),
}));

vi.mock("@/components/game/score-board", () => ({
  ScoreBoard: () => <div />,
}));

import { useGameState } from "@/lib/hooks/use-game-state";

const mockUseGameState = vi.mocked(useGameState);

const baseState = {
  game: null,
  started: {
    status: "BIDDING" as const,
    id: "game-abc",
    name: "Test Game",
    active_player_id: "other",
    players: [],
    scores: {},
    bid_amount: null,
    bidder_player_id: null,
    dealer_player_id: "player-1",
    trump: null,
    tricks: [],
  },
  completed: null,
  loading: false,
  error: null,
  isStale: false,
  myTurn: false,
  hand: [],
  playerId: "player-1",
  phase: "BIDDING" as const,
  refetch: vi.fn().mockResolvedValue(undefined),
};

describe("GamePage handleRefresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGameState.mockReturnValue({
      ...baseState,
      refetch: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("resets isRefreshing to false after refetch resolves", async () => {
    render(<GamePage />);

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(screen.getByTestId("refreshing").textContent).toBe("false");
    });
  });

  it("resets isRefreshing to false after refetch rejects", async () => {
    mockUseGameState.mockReturnValue({
      ...baseState,
      refetch: vi.fn().mockRejectedValue(new Error("network error")),
    });

    render(<GamePage />);

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(screen.getByTestId("refreshing").textContent).toBe("false");
    });
  });
});
