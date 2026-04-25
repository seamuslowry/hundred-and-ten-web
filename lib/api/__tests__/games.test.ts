import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/firebase", () => ({
  getFirebaseAuth: vi.fn(),
}));

vi.mock("../client", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "../client";
import { getSpikeGame } from "../games";

const mockApiFetch = vi.mocked(apiFetch);

describe("getSpikeGame", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("calls apiFetch with the correct spike endpoint path", async () => {
    mockApiFetch.mockResolvedValue({} as never);

    await getSpikeGame("player-123", "game-456");

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/players/player-123/games/game-456/spike",
    );
  });

  it("returns the SpikeGame response from apiFetch", async () => {
    const mockSpikeGame = {
      id: "game-456",
      name: "Test Game",
      status: "BIDDING",
      winner: null,
      players: [],
      scores: {},
      rounds: [],
    };
    mockApiFetch.mockResolvedValue(mockSpikeGame as never);

    const result = await getSpikeGame("player-123", "game-456");

    expect(result).toEqual(mockSpikeGame);
  });
});
