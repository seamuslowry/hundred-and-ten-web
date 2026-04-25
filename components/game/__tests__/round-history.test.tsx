import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RoundHistory } from "../round-history";
import type {
  SpikeCompletedWithBidderRound,
  SpikeCompletedNoBiddersRound,
} from "@/lib/api/types";

vi.mock("@/lib/firebase", () => ({ auth: {} }));

const playerNames = new Map([
  ["player-1", "Alice"],
  ["player-2", "Bob"],
]);

function makeCompletedRound(
  dealerId: string,
  bidderId: string,
  bidAmount: number,
): SpikeCompletedWithBidderRound {
  return {
    status: "COMPLETED",
    dealer_player_id: dealerId,
    trump: "SPADES",
    bid_history: [{ player_id: bidderId, amount: bidAmount }],
    bid: { player_id: bidderId, amount: bidAmount },
    initial_hands: {},
    discards: {},
    tricks: [],
    scores: { [bidderId]: bidAmount },
  };
}

function makeNoBidderRound(dealerId: string): SpikeCompletedNoBiddersRound {
  return {
    status: "COMPLETED_NO_BIDDERS",
    dealer_player_id: dealerId,
    initial_hands: {},
  };
}

const round1 = makeCompletedRound("player-1", "player-2", 20);
const round2 = makeNoBidderRound("player-2");
const round3 = makeCompletedRound("player-2", "player-1", 25);

describe("RoundHistory", () => {
  it("renders nothing when completedRounds is empty", () => {
    const { container } = render(
      <RoundHistory completedRounds={[]} playerNames={playerNames} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("all rounds start collapsed (no expanded content visible)", () => {
    render(
      <RoundHistory
        completedRounds={[round1, round2, round3]}
        playerNames={playerNames}
      />,
    );
    // Expanded content has "No bids — round was skipped" or "Trump:" etc.
    expect(screen.queryByText("No bids — round was skipped")).toBeNull();
    expect(screen.queryByText("Trump:")).toBeNull();
  });

  it("renders rounds in reverse order (most recent first)", () => {
    render(
      <RoundHistory
        completedRounds={[round1, round2, round3]}
        playerNames={playerNames}
      />,
    );
    const roundLabels = screen.getAllByText(/^Round \d+$/);
    // With 3 rounds, reversed display order is Round 3, Round 2, Round 1
    expect(roundLabels[0].textContent).toBe("Round 3");
    expect(roundLabels[1].textContent).toBe("Round 2");
    expect(roundLabels[2].textContent).toBe("Round 1");
  });

  it("shows correct original round indices (Round 1, Round 2, Round 3)", () => {
    render(
      <RoundHistory
        completedRounds={[round1, round2, round3]}
        playerNames={playerNames}
      />,
    );
    expect(screen.getByText("Round 1")).toBeInTheDocument();
    expect(screen.getByText("Round 2")).toBeInTheDocument();
    expect(screen.getByText("Round 3")).toBeInTheDocument();
  });

  it("expanding one round doesn't expand others", () => {
    render(
      <RoundHistory
        completedRounds={[round1, round2]}
        playerNames={playerNames}
      />,
    );
    const buttons = screen.getAllByRole("button");
    // Click the first button (Round 2 — most recent)
    fireEvent.click(buttons[0]);

    // Round 2 (no bidder) should be expanded — "No bids — round was skipped"
    expect(screen.getByText("No bids — round was skipped")).toBeInTheDocument();

    // Round 1 should still be collapsed
    // Only one expanded section, so Trump/Hands section for round1 shouldn't be visible
    expect(screen.queryByText("Trump:")).toBeNull();
  });

  it("can collapse a previously expanded round by clicking again", () => {
    render(
      <RoundHistory completedRounds={[round2]} playerNames={playerNames} />,
    );
    const button = screen.getByRole("button");
    // Expand
    fireEvent.click(button);
    expect(screen.getByText("No bids — round was skipped")).toBeInTheDocument();
    // Collapse
    fireEvent.click(button);
    expect(screen.queryByText("No bids — round was skipped")).toBeNull();
  });

  it("renders a single completed round correctly", () => {
    render(
      <RoundHistory completedRounds={[round1]} playerNames={playerNames} />,
    );
    expect(screen.getByText("Round 1")).toBeInTheDocument();
    expect(screen.getByText(/Dealer:.*Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Bidder:.*Bob.*@.*20/)).toBeInTheDocument();
  });

  it("shows Completed Rounds header", () => {
    render(
      <RoundHistory completedRounds={[round1]} playerNames={playerNames} />,
    );
    expect(screen.getByText("Completed Rounds")).toBeInTheDocument();
  });
});
