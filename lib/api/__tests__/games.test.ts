import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/firebase", () => ({
  getFirebaseAuth: vi.fn(),
}));

vi.mock("../client", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "../client";
import { getGame } from "../games";

const mockApiFetch = vi.mocked(apiFetch);

describe("getGame", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("calls apiFetch with the correct endpoint path", async () => {
    mockApiFetch.mockResolvedValue({} as never);

    await getGame("player-123", "game-456");

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/players/player-123/games/game-456",
    );
  });

  it("returns the Game response from apiFetch", async () => {
    const mockGame = {
      id: "game-456",
      name: "Test Game",
      status: "BIDDING",
      winner: null,
      players: [],
      scores: {},
      rounds: [],
    };
    mockApiFetch.mockResolvedValue(mockGame as never);

    const result = await getGame("player-123", "game-456");

    expect(result).toEqual(mockGame);
  });
});
