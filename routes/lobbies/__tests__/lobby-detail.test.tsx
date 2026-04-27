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
import lobbiesReducer from "@/store/lobbies/slice";
import playersReducer from "@/store/players/slice";
import type { GamesState } from "@/store/games/slice";
import type { LobbiesState } from "@/store/lobbies/slice";
import type { PlayersState } from "@/store/players/slice";
import type { Lobby, Player, Game } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";
import { LobbyDetail } from "../$lobbyId";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAYER_ID = "player-uid-123";
const ORGANIZER_ID = "organizer-uid-999";
const INVITEE_ID = "invitee-uid-789";
const TEST_LOBBY_ID = "lobby-test-abc";

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: vi.fn(),
    useParams: vi.fn().mockReturnValue({ lobbyId: "lobby-test-abc" }),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  };
});

vi.mock("@/components/auth/require-auth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/api/lobbies", () => ({
  createLobby: vi.fn(),
  getLobby: vi.fn(),
  searchLobbies: vi.fn(),
  joinLobby: vi.fn(),
  invitePlayer: vi.fn(),
  startGame: vi.fn(),
  getLobbyPlayers: vi.fn(),
}));

vi.mock("@/lib/api/players", () => ({
  searchPlayers: vi.fn(),
}));

vi.mock("@/lib/api/games", () => ({
  getGame: vi.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { useAuth } from "@/lib/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";
import {
  getLobby,
  getLobbyPlayers,
  joinLobby as joinLobbyApi,
  invitePlayer as invitePlayerApi,
  startGame as startGameApi,
} from "@/lib/api/lobbies";
import { searchPlayers } from "@/lib/api/players";
import { getGame } from "@/lib/api/games";

const mockUseAuth = vi.mocked(useAuth);
const mockUseNavigate = vi.mocked(useNavigate);
const mockGetLobby = vi.mocked(getLobby);
const mockGetLobbyPlayers = vi.mocked(getLobbyPlayers);
const mockJoinLobby = vi.mocked(joinLobbyApi);
const mockInvitePlayer = vi.mocked(invitePlayerApi);
const mockStartGameApi = vi.mocked(startGameApi);
const mockSearchPlayers = vi.mocked(searchPlayers);
const mockGetGame = vi.mocked(getGame);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseLobby: Lobby = {
  id: TEST_LOBBY_ID,
  name: "Test Lobby",
  accessibility: "PUBLIC",
  organizer: { id: ORGANIZER_ID, type: "human" },
  players: [],
  invitees: [],
};

const lobbyAsOrganizer: Lobby = {
  ...baseLobby,
  organizer: { id: PLAYER_ID, type: "human" },
};

const lobbyPlayers: Player[] = [
  { id: ORGANIZER_ID, name: "Olivia Organizer", pictureUrl: null },
];

const lobbyPlayersAsOrganizer: Player[] = [
  { id: PLAYER_ID, name: "Me Myself", pictureUrl: null },
];

const startedGame: Game = {
  id: TEST_LOBBY_ID,
  name: "Test Lobby",
  players: [
    { id: PLAYER_ID, type: "human" },
    { id: ORGANIZER_ID, type: "human" },
  ],
  scores: { [PLAYER_ID]: 0, [ORGANIZER_ID]: 0 },
  active: {
    status: "BIDDING",
    dealerPlayerId: ORGANIZER_ID,
    bidHistory: [],
    bid: null,
    hands: { [PLAYER_ID]: [], [ORGANIZER_ID]: 5 },
    discards: {},
    trump: null,
    tricks: [],
    activePlayerId: ORGANIZER_ID,
    queuedActions: [],
  },
  completedRounds: [],
};

const completedGame: Game = {
  ...startedGame,
  active: {
    status: "WON",
    winnerPlayerId: PLAYER_ID,
  },
};

// ─── renderWithStore helper ───────────────────────────────────────────────────

function renderWithStore(
  ui: React.ReactElement,
  initialState?: {
    games?: Partial<GamesState>;
    lobbies?: Partial<LobbiesState>;
    players?: Partial<PlayersState>;
  },
) {
  const store = configureStore({
    reducer: {
      games: gamesReducer,
      lobbies: lobbiesReducer,
      players: playersReducer,
    },
    preloadedState: initialState
      ? {
          games: {
            byId: {},
            loading: {},
            actionInFlight: {},
            errors: {},
            ...initialState.games,
          },
          lobbies: {
            byId: {},
            list: [],
            loading: {},
            listLoading: false,
            errors: {},
            listError: null,
            actionInFlight: {},
            ...initialState.lobbies,
          },
          players: {
            byId: {},
            ...initialState.players,
          },
        }
      : undefined,
  });
  return {
    ...render(<Provider store={store}>{ui}</Provider>),
    store,
  };
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

function setupAuth(uid: string | null = PLAYER_ID) {
  mockUseAuth.mockReturnValue({
    user: uid ? ({ uid } as ReturnType<typeof useAuth>["user"]) : null,
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    getToken: vi.fn(),
  });
}

// ─── Shared mocks ────────────────────────────────────────────────────────────

let mockNavigate: ReturnType<typeof vi.fn>;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("LobbyDetail", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setupAuth();
    mockNavigate = vi.fn();
    mockUseNavigate.mockReturnValue(
      mockNavigate as unknown as ReturnType<typeof useNavigate>,
    );

    // Default: non-organizer viewing a public lobby
    mockGetLobby.mockResolvedValue(baseLobby);
    mockGetLobbyPlayers.mockResolvedValue(lobbyPlayers);
    // Default: game not started → 404
    mockGetGame.mockRejectedValue(new ApiError(404, "Not Found"));
    mockJoinLobby.mockResolvedValue(undefined);
    mockInvitePlayer.mockResolvedValue(undefined);
    mockStartGameApi.mockResolvedValue([]);
    mockSearchPlayers.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ─── 1. Happy path ──────────────────────────────────────────────────────

  it("shows loading on first render then renders lobby content with cached player names", async () => {
    // Stall the fetch so the loading state is visible
    let resolveLobby!: (l: Lobby) => void;
    mockGetLobby.mockReturnValue(
      new Promise<Lobby>((r) => {
        resolveLobby = r;
      }),
    );

    renderWithStore(<LobbyDetail />);

    expect(screen.getByText("Loading lobby...")).toBeInTheDocument();

    await act(async () => {
      resolveLobby(baseLobby);
    });

    await waitFor(() => {
      expect(screen.getByText("Test Lobby")).toBeInTheDocument();
    });

    // Accessibility badge
    expect(screen.getByText("Public")).toBeInTheDocument();
    // Player name resolved from cache via fetchLobby's playersUpserted
    expect(screen.getByText("Olivia Organizer")).toBeInTheDocument();
    // Loading is gone
    expect(screen.queryByText("Loading lobby...")).toBeNull();
  });

  // ─── 2. Loading guard during polls ──────────────────────────────────────

  it("subsequent polls do not replace lobby content with loading state", async () => {
    renderWithStore(<LobbyDetail />);

    await waitFor(() => {
      expect(screen.getByText("Test Lobby")).toBeInTheDocument();
    });

    // Advance several poll cycles (5s each)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    // Lobby content still visible; no loading state
    expect(screen.getByText("Test Lobby")).toBeInTheDocument();
    expect(screen.queryByText("Loading lobby...")).toBeNull();
  });

  // ─── 3. Action — Join ──────────────────────────────────────────────────

  it("non-member clicks Join → joinLobby called → re-fetch shows updated members", async () => {
    const updatedLobby: Lobby = {
      ...baseLobby,
      players: [{ id: PLAYER_ID, type: "human" }],
    };
    const updatedPlayers: Player[] = [
      ...lobbyPlayers,
      { id: PLAYER_ID, name: "Me Myself", pictureUrl: null },
    ];

    mockGetLobby
      .mockResolvedValueOnce(baseLobby)
      .mockResolvedValue(updatedLobby);
    mockGetLobbyPlayers
      .mockResolvedValueOnce(lobbyPlayers)
      .mockResolvedValue(updatedPlayers);

    renderWithStore(<LobbyDetail />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Join Lobby" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Join Lobby" }));

    await waitFor(() => {
      expect(mockJoinLobby).toHaveBeenCalledWith(PLAYER_ID, TEST_LOBBY_ID);
    });

    // Updated member list shows the joined player's name
    await waitFor(() => {
      expect(screen.getByText("Me Myself")).toBeInTheDocument();
    });
  });

  // ─── 4. Action — Invite (organizer flow) ────────────────────────────────

  it("organizer types in search → debounced search → click Invite → invitee appears", async () => {
    // Switch to organizer
    mockGetLobby.mockReset();
    mockGetLobbyPlayers.mockReset();
    mockGetLobby.mockResolvedValueOnce(lobbyAsOrganizer).mockResolvedValue({
      ...lobbyAsOrganizer,
      invitees: [{ id: INVITEE_ID, type: "human" }],
    });
    mockGetLobbyPlayers
      .mockResolvedValueOnce(lobbyPlayersAsOrganizer)
      .mockResolvedValue([
        ...lobbyPlayersAsOrganizer,
        { id: INVITEE_ID, name: "Ivan Invitee", pictureUrl: null },
      ]);
    mockSearchPlayers.mockResolvedValue([
      { id: INVITEE_ID, name: "Ivan Invitee", pictureUrl: null },
    ]);

    renderWithStore(<LobbyDetail />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Search players to invite..."),
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Search players to invite...");
    fireEvent.change(input, { target: { value: "ivan" } });

    // Wait for debounce (300ms) + search resolution
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    await waitFor(() => {
      expect(mockSearchPlayers).toHaveBeenCalledWith(PLAYER_ID, {
        searchText: "ivan",
        offset: 0,
        limit: 10,
      });
    });

    // Result row is visible
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Invite" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Invite" }));

    await waitFor(() => {
      expect(mockInvitePlayer).toHaveBeenCalledWith(
        PLAYER_ID,
        TEST_LOBBY_ID,
        INVITEE_ID,
      );
    });

    // Invitee appears in member list with cached name
    await waitFor(() => {
      expect(screen.getByText("Ivan Invitee")).toBeInTheDocument();
    });
    expect(screen.getByText("Pending Invites")).toBeInTheDocument();
  });

  // ─── 5. Action — Start (organizer) ──────────────────────────────────────

  it("organizer clicks Start → startGame called → fetchGame populates → navigate fires", async () => {
    mockGetLobby.mockResolvedValue(lobbyAsOrganizer);
    mockGetLobbyPlayers.mockResolvedValue(lobbyPlayersAsOrganizer);
    // Game initially absent (404), then present after start
    mockGetGame
      .mockRejectedValueOnce(new ApiError(404, "Not Found"))
      .mockResolvedValue(startedGame);

    renderWithStore(<LobbyDetail />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Start Game" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Start Game" }));

    await waitFor(() => {
      expect(mockStartGameApi).toHaveBeenCalledWith(PLAYER_ID, TEST_LOBBY_ID);
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/games/$gameId",
        params: { gameId: TEST_LOBBY_ID },
      });
    });
  });

  // ─── 6. Polling — game-start detection (non-organizer) ──────────────────

  it("non-organizer: polling detects game start and navigates", async () => {
    // First poll: 404. Then: game appears.
    mockGetGame
      .mockRejectedValueOnce(new ApiError(404, "Not Found"))
      .mockRejectedValueOnce(new ApiError(404, "Not Found"))
      .mockResolvedValue(startedGame);

    renderWithStore(<LobbyDetail />);

    await waitFor(() => {
      expect(screen.getByText("Test Lobby")).toBeInTheDocument();
    });

    // Initial poll fired (404). Advance through several 5s cycles.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/games/$gameId",
        params: { gameId: TEST_LOBBY_ID },
      });
    });
  });

  // ─── 7. Polling — 404 handling ──────────────────────────────────────────

  it("polling 404 errors do not show error UI and do not navigate", async () => {
    mockGetGame.mockRejectedValue(new ApiError(404, "Not Found"));

    renderWithStore(<LobbyDetail />);

    await waitFor(() => {
      expect(screen.getByText("Test Lobby")).toBeInTheDocument();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    // No "Not Found" error shown to user
    expect(screen.queryByText("Not Found")).toBeNull();
    // Lobby content still shown
    expect(screen.getByText("Test Lobby")).toBeInTheDocument();
    // Navigation not triggered
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // ─── 8. Constant cadence after failure (R10) ────────────────────────────

  it("polling cadence stays constant at 5s after repeated failures (no exponential backoff)", async () => {
    mockGetGame.mockRejectedValue(new ApiError(404, "Not Found"));

    renderWithStore(<LobbyDetail />);

    await waitFor(() => {
      expect(screen.getByText("Test Lobby")).toBeInTheDocument();
    });

    // Initial poll fires immediately on mount → record call count
    await waitFor(() => {
      expect(mockGetGame).toHaveBeenCalled();
    });
    const initialCalls = mockGetGame.mock.calls.length;

    // Each 5s cycle should add exactly one call (no backoff to 10s/20s/30s)
    for (let i = 1; i <= 4; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      await waitFor(() => {
        expect(mockGetGame.mock.calls.length).toBe(initialCalls + i);
      });
    }
  });

  // ─── 9. Action error semantics ──────────────────────────────────────────

  it("joinLobby rejection shows action error in UI; lobbies slice errors[lobbyId] unchanged", async () => {
    mockJoinLobby.mockRejectedValue(new Error("Join failed"));

    const { store } = renderWithStore(<LobbyDetail />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Join Lobby" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Join Lobby" }));

    await waitFor(() => {
      expect(screen.getByText("Join failed")).toBeInTheDocument();
    });

    // Slice errors map for this lobby is NOT polluted by action error
    const sliceErrors = store.getState().lobbies.errors[TEST_LOBBY_ID];
    // null after fetchLobby.fulfilled, not the action error
    expect(sliceErrors).toBe(null);
  });

  // ─── 10. ConditionError handling — rapid double-click on Start ──────────

  it("rapid double-click on Start results in only one startGame call", async () => {
    mockGetLobby.mockResolvedValue(lobbyAsOrganizer);
    mockGetLobbyPlayers.mockResolvedValue(lobbyPlayersAsOrganizer);

    // Make startGame slow so the second click fires while first is in-flight
    let resolveFirst!: () => void;
    mockStartGameApi.mockImplementationOnce(
      () =>
        new Promise<never[]>((resolve) => {
          resolveFirst = () => resolve([]);
        }),
    );
    mockStartGameApi.mockResolvedValue([]);

    renderWithStore(<LobbyDetail />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Start Game" }),
      ).toBeInTheDocument();
    });

    const startBtn = screen.getByRole("button", { name: "Start Game" });
    fireEvent.click(startBtn);
    // Button now disabled; second click ignored AND condition() blocks duplicate
    fireEvent.click(startBtn);

    await act(async () => {
      resolveFirst();
    });

    await waitFor(() => {
      expect(mockStartGameApi).toHaveBeenCalledTimes(1);
    });

    // No false "Action failed" displayed
    expect(screen.queryByText("Failed to start game")).toBeNull();
  });

  // ─── 11. PlayerSearch debounce ──────────────────────────────────────────

  it("PlayerSearch: typing fewer than 300ms apart does not fire api until idle", async () => {
    mockGetLobby.mockResolvedValue(lobbyAsOrganizer);
    mockGetLobbyPlayers.mockResolvedValue(lobbyPlayersAsOrganizer);

    renderWithStore(<LobbyDetail />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Search players to invite..."),
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Search players to invite...");

    // Type "alice" with 100ms between keystrokes
    fireEvent.change(input, { target: { value: "a" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    fireEvent.change(input, { target: { value: "al" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    fireEvent.change(input, { target: { value: "ali" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    fireEvent.change(input, { target: { value: "alice" } });

    // Less than 300ms since last keystroke → no api call yet
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(mockSearchPlayers).not.toHaveBeenCalled();

    // After idle 300ms total → fires once with the latest value
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    await waitFor(() => {
      expect(mockSearchPlayers).toHaveBeenCalledTimes(1);
    });
    expect(mockSearchPlayers).toHaveBeenCalledWith(PLAYER_ID, {
      searchText: "alice",
      offset: 0,
      limit: 10,
    });
  });

  // ─── 12. PlayerSearch query length ──────────────────────────────────────

  it("PlayerSearch: typing < 2 chars does not fire api", async () => {
    mockGetLobby.mockResolvedValue(lobbyAsOrganizer);
    mockGetLobbyPlayers.mockResolvedValue(lobbyPlayersAsOrganizer);

    renderWithStore(<LobbyDetail />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Search players to invite..."),
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Search players to invite...");
    fireEvent.change(input, { target: { value: "a" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(mockSearchPlayers).not.toHaveBeenCalled();
  });

  // ─── 13. PlayerSearch cache update populates member list name ──────────

  it("inviting a searched player surfaces the cached name in the member list", async () => {
    mockGetLobby.mockReset();
    mockGetLobbyPlayers.mockReset();
    // First fetch: organizer-only lobby. Second fetch (after invite): with invitee.
    // CRUCIALLY, getLobbyPlayers on re-fetch returns ONLY the organizer
    // — the invitee's name must come from the cache populated by searchPlayers.
    mockGetLobby.mockResolvedValueOnce(lobbyAsOrganizer).mockResolvedValue({
      ...lobbyAsOrganizer,
      invitees: [{ id: INVITEE_ID, type: "human" }],
    });
    mockGetLobbyPlayers.mockResolvedValue(lobbyPlayersAsOrganizer);
    mockSearchPlayers.mockResolvedValue([
      { id: INVITEE_ID, name: "Cached Invitee Name", pictureUrl: null },
    ]);

    renderWithStore(<LobbyDetail />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Search players to invite..."),
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Search players to invite...");
    fireEvent.change(input, { target: { value: "cached" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Invite" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Invite" }));

    await waitFor(() => {
      expect(mockInvitePlayer).toHaveBeenCalled();
    });

    // After re-fetch, invitee appears under "Pending Invites" with the
    // cached name from searchPlayers (NOT the raw ID).
    await waitFor(() => {
      expect(screen.getByText("Cached Invitee Name")).toBeInTheDocument();
    });
  });

  // ─── Review fix: completed game in slice does NOT force-redirect ───────────

  it("completed game (status='WON') in slice does NOT trigger navigation — user can view the lobby", async () => {
    // Pre-seed a WON game for this lobby. If selectActiveRound returned the
    // game (rather than null), the navigation effect would fire on first render
    // and redirect the user away from the lobby they just navigated to.
    renderWithStore(<LobbyDetail />, {
      games: { byId: { [TEST_LOBBY_ID]: completedGame } },
    });

    // Lobby content should render normally (after fetchLobby resolves).
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    // Navigate must NOT have been called by the in-progress game effect.
    // (No 5s polling progressed — we only assert against the initial render.)
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // ─── Review fix: per-action actionInFlight keys allow concurrent actions ───

  it("organizer's startGame click does not block invitePlayer click (per-action keys)", async () => {
    // Setup: organizer scenario with a pending invitee already in slice cache
    // so we don't have to drive the search debounce.
    setupAuth(PLAYER_ID);
    mockGetLobby.mockResolvedValue(lobbyAsOrganizer);
    mockGetLobbyPlayers.mockResolvedValue(lobbyPlayersAsOrganizer);

    // Hold startGame in flight by never resolving its promise.
    let resolveStart: (() => void) | undefined;
    mockStartGameApi.mockReturnValue(
      new Promise<never[]>((res) => {
        resolveStart = () => res([]);
      }),
    );
    // searchPlayers + invite both available.
    mockSearchPlayers.mockResolvedValue([
      { id: INVITEE_ID, name: "Invitee Name", pictureUrl: null },
    ]);
    mockInvitePlayer.mockResolvedValue(undefined);

    renderWithStore(<LobbyDetail />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Start Game/ }),
      ).toBeInTheDocument();
    });

    // Click Start — the thunk pends because we never resolve.
    fireEvent.click(screen.getByRole("button", { name: /Start Game/ }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Starting/ }),
      ).toBeInTheDocument();
    });

    // While Start is in flight, the organizer searches for and invites a player.
    const input = screen.getByPlaceholderText("Search players to invite...");
    fireEvent.change(input, { target: { value: "Invi" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Invite" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Invite" }));

    // The invite should go through despite startGame still being pending —
    // pre-fix, the shared actionInFlight[lobbyId] flag would have dropped it
    // as a ConditionError.
    await waitFor(() => {
      expect(mockInvitePlayer).toHaveBeenCalledTimes(1);
    });

    // Cleanup
    resolveStart?.();
  });

  // ─── Review fix: startPending UI feedback after startGame succeeds ─────────

  it("after startGame.fulfilled but before game appears, button shows 'Connecting to game...'", async () => {
    setupAuth(PLAYER_ID);
    mockGetLobby.mockResolvedValue(lobbyAsOrganizer);
    mockGetLobbyPlayers.mockResolvedValue(lobbyPlayersAsOrganizer);

    // startGame's POST resolves but the internal fetchGame fails — simulating
    // the partial-success case where polling has to recover.
    mockStartGameApi.mockResolvedValue([]);
    mockGetGame.mockRejectedValue(new Error("network blip"));

    renderWithStore(<LobbyDetail />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Start Game/ }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Start Game/ }));

    // After the thunk resolves successfully, the route shows "Connecting to game..."
    // because activeRound has not yet appeared in the games slice.
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Connecting to game/ }),
      ).toBeInTheDocument();
    });

    // The button is also disabled (preventing re-click).
    expect(
      screen.getByRole("button", { name: /Connecting to game/ }),
    ).toBeDisabled();
  });

  // ─── Review fix: PlayerSearch out-of-order race ───────────────────────────

  it("PlayerSearch ignores a stale search response when a newer search is in flight", async () => {
    setupAuth(PLAYER_ID);
    mockGetLobby.mockResolvedValue(lobbyAsOrganizer);
    mockGetLobbyPlayers.mockResolvedValue(lobbyPlayersAsOrganizer);

    // First search ("ali") will resolve LATE; second ("alex") will resolve EARLY.
    // Without the request-counter fix, the late "ali" response would clobber
    // the rendered results for the latest typed query "alex".
    let resolveAli: ((v: Player[]) => void) | undefined;
    const aliPromise = new Promise<Player[]>((res) => {
      resolveAli = res;
    });
    mockSearchPlayers.mockImplementationOnce(() => aliPromise);
    mockSearchPlayers.mockResolvedValueOnce([
      { id: "alex-id", name: "Alex Match", pictureUrl: null },
    ]);

    renderWithStore(<LobbyDetail />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Search players to invite..."),
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Search players to invite...");

    // Type "ali" → debounce fires → first search starts (still pending).
    fireEvent.change(input, { target: { value: "ali" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    // Type "alex" → debounce fires → second search starts and resolves immediately.
    fireEvent.change(input, { target: { value: "alex" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    // The "alex" results render.
    await waitFor(() => {
      expect(screen.getByText("Alex Match")).toBeInTheDocument();
    });

    // Now resolve the stale "ali" search with a different result set.
    resolveAli?.([
      { id: "ali-id-1", name: "Ali One", pictureUrl: null },
      { id: "ali-id-2", name: "Ali Two", pictureUrl: null },
    ]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // The stale "ali" results must NOT replace the visible "alex" results.
    expect(screen.queryByText("Ali One")).not.toBeInTheDocument();
    expect(screen.queryByText("Ali Two")).not.toBeInTheDocument();
    expect(screen.getByText("Alex Match")).toBeInTheDocument();
  });

  // ─── Review fix: fetchLobby rejection after a successful action ────────────

  it("shows a sync error banner when fetchLobby rejects but a cached lobby is still rendered", async () => {
    // Pre-seed the lobby in slice. fetchLobby on mount will fail.
    mockGetLobby.mockRejectedValue(new Error("Could not refresh lobby"));
    mockGetLobbyPlayers.mockRejectedValue(new Error("Could not refresh"));

    renderWithStore(<LobbyDetail />, {
      lobbies: { byId: { [TEST_LOBBY_ID]: baseLobby } },
      players: {
        byId: {
          [ORGANIZER_ID]: {
            id: ORGANIZER_ID,
            name: "Olivia Organizer",
            pictureUrl: null,
          },
        },
      },
    });

    // Lobby content renders from cache (heading visible).
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    // Sync error banner appears (status role) with "(showing cached data)".
    await waitFor(() => {
      expect(
        screen.getByText(/Could not refresh lobby.*showing cached data/),
      ).toBeInTheDocument();
    });
  });
});
