import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import gamesReducer from "@/store/games/slice";
import lobbiesReducer from "@/store/lobbies/slice";
import playersReducer from "@/store/players/slice";
import type { GamesState } from "@/store/games/slice";
import type { LobbiesState } from "@/store/lobbies/slice";
import type { PlayersState } from "@/store/players/slice";
import type { Game, Lobby } from "@/lib/api/types";
import { Home } from "../index";

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockNavigate = vi.hoisted(() => vi.fn());
const mockSearch = vi.hoisted(() => ({}) as Record<string, unknown>);

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearch: () => mockSearch,
    Link: ({
      children,
      to,
      params,
    }: {
      children: React.ReactNode;
      to: string;
      params?: Record<string, string>;
    }) => {
      const href = params
        ? Object.entries(params).reduce(
            (acc, [k, v]) => acc.replace(`$${k}`, v),
            to,
          )
        : to;
      return <a href={href}>{children}</a>;
    },
  };
});

vi.mock("@/components/auth/sign-in-button", () => ({
  SignInButton: () => <button>Sign in</button>,
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
  searchGames: vi.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { useAuth } from "@/lib/hooks/use-auth";
import { searchLobbies } from "@/lib/api/lobbies";
import { searchGames } from "@/lib/api/games";

const mockUseAuth = vi.mocked(useAuth);
const mockSearchLobbies = vi.mocked(searchLobbies);
const mockSearchGames = vi.mocked(searchGames);

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAYER_ID = "player-uid-123";
const OTHER_PLAYER_ID = "other-player-456";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const inviteLobby: Lobby = {
  id: "lobby-invite",
  name: "Invite Lobby",
  accessibility: "PRIVATE",
  organizer: { id: OTHER_PLAYER_ID, type: "human" },
  players: [],
  invitees: [{ id: PLAYER_ID, type: "human" }],
};

const otherLobby: Lobby = {
  id: "lobby-other",
  name: "Other Lobby",
  accessibility: "PUBLIC",
  organizer: { id: OTHER_PLAYER_ID, type: "human" },
  players: [],
  invitees: [],
};

const myTurnGame: Game = {
  id: "game-mine",
  name: "My Turn Game",
  players: [
    { id: PLAYER_ID, type: "human" },
    { id: OTHER_PLAYER_ID, type: "human" },
  ],
  scores: {},
  active: {
    status: "BIDDING",
    dealerPlayerId: OTHER_PLAYER_ID,
    bidHistory: [],
    bid: null,
    hands: {},
    trump: null,
    discards: {},
    tricks: [],
    activePlayerId: PLAYER_ID,
    queuedActions: [],
  },
  completedRounds: [],
};

const waitingGame: Game = {
  ...myTurnGame,
  id: "game-waiting",
  name: "Waiting Game",
  active: {
    ...(myTurnGame.active as object),
    activePlayerId: OTHER_PLAYER_ID,
  } as Game["active"],
};

const strangerGame: Game = {
  ...myTurnGame,
  id: "game-stranger",
  name: "Stranger Game",
  players: [{ id: OTHER_PLAYER_ID, type: "human" }],
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
            list: [],
            listLoading: false,
            listError: null,
            loading: {},
            actionInFlight: {},
            leaveInFlight: {},
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
            leaveInFlight: {},
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Home (games and lobbies)", () => {
  beforeEach(() => {
    setupAuth();
    mockSearchGames.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state on initial render and renders lobby cards after fetch (invitees first)", async () => {
    mockSearchLobbies.mockResolvedValue([otherLobby, inviteLobby]);

    renderWithStore(<Home />);

    // Loading state visible immediately (listLoading = true, no lobbies yet)
    expect(screen.getByText("Loading lobbies...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Invite Lobby")).toBeInTheDocument();
    });
    expect(screen.getByText("Other Lobby")).toBeInTheDocument();

    // Verify invitee partition: Invite Lobby renders before Other Lobby
    const inviteEl = screen.getByText("Invite Lobby");
    const otherEl = screen.getByText("Other Lobby");
    expect(
      inviteEl.compareDocumentPosition(otherEl) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // Invited badge appears on the invite lobby
    expect(screen.getByText("Invited")).toBeInTheDocument();

    // Loading message gone
    expect(screen.queryByText("Loading lobbies...")).toBeNull();
  });

  it("renders empty state when searchLobbies returns []", async () => {
    mockSearchLobbies.mockResolvedValue([]);

    renderWithStore(<Home />);

    await waitFor(() => {
      expect(
        screen.getByText("No lobbies yet. Create one to get started!"),
      ).toBeInTheDocument();
    });
  });

  it("renders error message when searchLobbies rejects", async () => {
    mockSearchLobbies.mockRejectedValue(new Error("Network down"));

    renderWithStore(<Home />);

    await waitFor(() => {
      expect(screen.getByText("Network down")).toBeInTheDocument();
    });
  });

  it("shows the player's ongoing games alongside lobbies", async () => {
    mockSearchLobbies.mockResolvedValue([otherLobby]);
    mockSearchGames.mockResolvedValue([myTurnGame, waitingGame, strangerGame]);

    renderWithStore(<Home />);

    await waitFor(() => {
      expect(screen.getByText("My Turn Game")).toBeInTheDocument();
    });
    expect(screen.getByText("Waiting Game")).toBeInTheDocument();
    expect(screen.queryByText("Stranger Game")).toBeNull();
    expect(screen.getByText("Other Lobby")).toBeInTheDocument();

    // Only the game where it is the player's move gets the badge
    expect(screen.getAllByText("Your turn")).toHaveLength(1);
    expect(screen.getByText("My Turn Game").closest("a")).toHaveAttribute(
      "href",
      "/games/game-mine",
    );
  });

  it("shows an empty state when the player has no ongoing games", async () => {
    mockSearchLobbies.mockResolvedValue([otherLobby]);
    mockSearchGames.mockResolvedValue([]);

    renderWithStore(<Home />);

    await waitFor(() => {
      expect(screen.getByText("No games in progress.")).toBeInTheDocument();
    });
  });

  it("still shows lobbies when loading games fails", async () => {
    mockSearchLobbies.mockResolvedValue([otherLobby]);
    mockSearchGames.mockRejectedValue(new Error("games down"));

    renderWithStore(<Home />);

    await waitFor(() => {
      expect(screen.getByText("games down")).toBeInTheDocument();
    });
    expect(screen.getByText("Other Lobby")).toBeInTheDocument();
  });

  it("shows the sign-in button instead of games when signed out", () => {
    setupAuth(null);

    renderWithStore(<Home />);

    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(screen.queryByText("Games")).toBeNull();
    expect(mockSearchGames).not.toHaveBeenCalled();
  });

  it('labels the games section simply "Games"', async () => {
    mockSearchLobbies.mockResolvedValue([]);

    renderWithStore(<Home />);

    expect(
      await screen.findByRole("heading", { name: "Games" }),
    ).toBeInTheDocument();
  });

  it("redirects to returnTo after sign-in instead of rendering home", async () => {
    mockSearch.returnTo = "/games/abc";

    renderWithStore(<Home />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/games/abc" });
    });
    expect(screen.queryByText("Games")).toBeNull();
    delete mockSearch.returnTo;
  });
});
