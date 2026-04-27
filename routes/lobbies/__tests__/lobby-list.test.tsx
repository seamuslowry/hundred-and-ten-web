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
import type { Lobby } from "@/lib/api/types";
import { LobbiesPage } from "../index";

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
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
import { searchLobbies } from "@/lib/api/lobbies";

const mockUseAuth = vi.mocked(useAuth);
const mockSearchLobbies = vi.mocked(searchLobbies);

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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("LobbiesPage (lobby list)", () => {
  beforeEach(() => {
    setupAuth();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state on initial render and renders lobby cards after fetch (invitees first)", async () => {
    mockSearchLobbies.mockResolvedValue([otherLobby, inviteLobby]);

    renderWithStore(<LobbiesPage />);

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

    renderWithStore(<LobbiesPage />);

    await waitFor(() => {
      expect(
        screen.getByText("No lobbies yet. Create one to get started!"),
      ).toBeInTheDocument();
    });
  });

  it("renders error message when searchLobbies rejects", async () => {
    mockSearchLobbies.mockRejectedValue(new Error("Network down"));

    renderWithStore(<LobbiesPage />);

    await waitFor(() => {
      expect(screen.getByText("Network down")).toBeInTheDocument();
    });
  });
});
