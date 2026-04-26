import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DiscardArea } from "../discard-area";
import type { Card } from "@/lib/api/types";

vi.mock("@/lib/firebase", () => ({ auth: {} }));

const ACE_HEARTS: Card = { number: "ACE", suit: "HEARTS" };
const THREE_CLUBS: Card = { number: "THREE", suit: "CLUBS" };
const FIVE_SPADES: Card = { number: "FIVE", suit: "SPADES" };

const playerNames = new Map([
  ["player-1", "Alice"],
  ["player-2", "Bob"],
]);

describe("DiscardArea", () => {
  it("shows current player's discarded cards when discards[playerId] is DiscardRecord", () => {
    render(
      <DiscardArea
        discards={{
          "player-1": {
            discarded: [ACE_HEARTS, THREE_CLUBS],
            received: [],
          },
        }}
        playerId="player-1"
        playerNames={playerNames}
      />,
    );
    // Card component renders buttons with aria-label
    expect(
      screen.getByRole("button", { name: /ace of hearts/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /three of clubs/i }),
    ).toBeInTheDocument();
  });

  it("shows received cards for the current player", () => {
    render(
      <DiscardArea
        discards={{
          "player-1": {
            discarded: [THREE_CLUBS],
            received: [FIVE_SPADES],
          },
        }}
        playerId="player-1"
        playerNames={playerNames}
      />,
    );
    expect(screen.getByText("Received")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /five of spades/i }),
    ).toBeInTheDocument();
  });

  it("does not show received section when received is empty", () => {
    render(
      <DiscardArea
        discards={{
          "player-1": {
            discarded: [THREE_CLUBS],
            received: [],
          },
        }}
        playerId="player-1"
        playerNames={playerNames}
      />,
    );
    expect(screen.queryByText("Received")).toBeNull();
  });

  it("shows other players' discard counts", () => {
    render(
      <DiscardArea
        discards={{ "player-2": 3 }}
        playerId="player-1"
        playerNames={playerNames}
      />,
    );
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText(/: 3 cards/)).toBeInTheDocument();
  });

  it("renders nothing when discards map is empty", () => {
    const { container } = render(
      <DiscardArea
        discards={{}}
        playerId="player-1"
        playerNames={playerNames}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows '0 cards' when player's discard count is 0", () => {
    render(
      <DiscardArea
        discards={{ "player-2": 0 }}
        playerId="player-1"
        playerNames={playerNames}
      />,
    );
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText(/: 0 cards/)).toBeInTheDocument();
  });

  it("shows other player's discard count", () => {
    render(
      <DiscardArea
        discards={{
          "player-2": { discarded: [ACE_HEARTS], received: [] },
        }}
        playerId="player-1"
        playerNames={playerNames}
      />,
    );
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText(/: 1 card/)).toBeInTheDocument();
  });

  it("card components for current player are disabled (read-only)", () => {
    render(
      <DiscardArea
        discards={{
          "player-1": { discarded: [ACE_HEARTS], received: [] },
        }}
        playerId="player-1"
        playerNames={playerNames}
      />,
    );
    const cardBtn = screen.getByRole("button", { name: /ace of hearts/i });
    // disabled && !selected means the button is disabled
    expect(cardBtn).toBeDisabled();
  });
});
