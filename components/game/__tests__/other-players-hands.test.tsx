import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OtherPlayersHands } from "../other-players-hands";
import type { Card } from "@/lib/api/types";

vi.mock("@/lib/firebase", () => ({ auth: {} }));

const ACE_HEARTS: Card = { number: "ACE", suit: "HEARTS" };

const playerNames = new Map([
  ["player-1", "Alice"],
  ["player-2", "Bob"],
  ["player-3", "Carol"],
]);

describe("OtherPlayersHands", () => {
  it("shows hand count for each player other than self", () => {
    render(
      <OtherPlayersHands
        hands={{ "player-1": 5, "player-2": 4, "player-3": 3 }}
        playerId="player-1"
        playerNames={playerNames}
      />,
    );
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText(/: 4 cards/)).toBeInTheDocument();
    expect(screen.getByText("Carol")).toBeInTheDocument();
    expect(screen.getByText(/: 3 cards/)).toBeInTheDocument();
  });

  it("excludes current player from the list", () => {
    render(
      <OtherPlayersHands
        hands={{ "player-1": 5, "player-2": 4 }}
        playerId="player-1"
        playerNames={playerNames}
      />,
    );
    expect(screen.queryByText(/Alice/)).toBeNull();
  });

  it("resolves player names from map with fallback to truncated ID", () => {
    render(
      <OtherPlayersHands
        hands={{ "unknown-player-id-xyz": 4 }}
        playerId="player-1"
        playerNames={playerNames}
      />,
    );
    expect(screen.getByText("unknown-")).toBeInTheDocument();
    expect(screen.getByText(/: 4 cards/)).toBeInTheDocument();
  });

  it("shows correct count when value is a Card array", () => {
    render(
      <OtherPlayersHands
        hands={{ "player-2": [ACE_HEARTS, ACE_HEARTS] }}
        playerId="player-1"
        playerNames={playerNames}
      />,
    );
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText(/: 2 cards/)).toBeInTheDocument();
  });

  it("renders nothing when all players are self", () => {
    const { container } = render(
      <OtherPlayersHands
        hands={{ "player-1": 5 }}
        playerId="player-1"
        playerNames={playerNames}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when hands map is empty", () => {
    const { container } = render(
      <OtherPlayersHands
        hands={{}}
        playerId="player-1"
        playerNames={playerNames}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows singular 'card' when count is 1", () => {
    render(
      <OtherPlayersHands
        hands={{ "player-2": 1 }}
        playerId="player-1"
        playerNames={playerNames}
      />,
    );
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText(/: 1 card$/)).toBeInTheDocument();
  });
});
