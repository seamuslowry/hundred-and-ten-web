import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CompletedRoundView } from "../completed-round-view";
import type {
  SpikeCompletedRound,
  SpikeCompletedNoBiddersRound,
} from "@/lib/api/types";

vi.mock("@/lib/firebase", () => ({ auth: {} }));

const playerNames = new Map([
  ["player-1", "Alice"],
  ["player-2", "Bob"],
  ["player-3", "Carol"],
]);

const completedRound: SpikeCompletedRound = {
  status: "COMPLETED",
  dealer_player_id: "player-1",
  bidder_player_id: "player-2",
  bid_amount: 20,
  trump: "HEARTS",
  bid_history: [
    { player_id: "player-1", amount: 0 },
    { player_id: "player-2", amount: 20 },
  ],
  hands: {
    "player-1": [{ number: "ACE", suit: "HEARTS" }],
    "player-2": [{ number: "KING", suit: "SPADES" }],
  },
  discards: {
    "player-1": [{ number: "TWO", suit: "CLUBS" }],
    "player-2": [],
  },
  tricks: [
    {
      bleeding: false,
      plays: [
        {
          type: "PLAY",
          player_id: "player-1",
          card: { number: "ACE", suit: "HEARTS" },
        },
        {
          type: "PLAY",
          player_id: "player-2",
          card: { number: "KING", suit: "SPADES" },
        },
      ],
      winning_play: {
        type: "PLAY",
        player_id: "player-1",
        card: { number: "ACE", suit: "HEARTS" },
      },
    },
    {
      bleeding: true,
      plays: [
        {
          type: "PLAY",
          player_id: "player-2",
          card: { number: "FIVE", suit: "HEARTS" },
        },
      ],
      winning_play: {
        type: "PLAY",
        player_id: "player-2",
        card: { number: "FIVE", suit: "HEARTS" },
      },
    },
  ],
  scores: {
    "player-1": 20,
    "player-2": -10,
  },
};

const noBidderRound: SpikeCompletedNoBiddersRound = {
  status: "COMPLETED_NO_BIDDERS",
  dealer_player_id: "player-1",
  initial_hands: {
    "player-1": [{ number: "JACK", suit: "DIAMONDS" }],
    "player-2": [{ number: "TEN", suit: "CLUBS" }],
  },
};

const noop = vi.fn();

describe("CompletedRoundView — compact view", () => {
  it("shows round number (1-based) for COMPLETED round", () => {
    render(
      <CompletedRoundView
        round={completedRound}
        roundIndex={0}
        expanded={false}
        onToggle={noop}
        playerNames={playerNames}
      />,
    );
    expect(screen.getByText("Round 1")).toBeInTheDocument();
  });

  it("shows round number for later rounds", () => {
    render(
      <CompletedRoundView
        round={completedRound}
        roundIndex={2}
        expanded={false}
        onToggle={noop}
        playerNames={playerNames}
      />,
    );
    expect(screen.getByText("Round 3")).toBeInTheDocument();
  });

  it("shows dealer name for COMPLETED round", () => {
    render(
      <CompletedRoundView
        round={completedRound}
        roundIndex={0}
        expanded={false}
        onToggle={noop}
        playerNames={playerNames}
      />,
    );
    expect(screen.getByText(/Dealer:.*Alice/)).toBeInTheDocument();
  });

  it("shows bidder name and bid amount for COMPLETED round", () => {
    render(
      <CompletedRoundView
        round={completedRound}
        roundIndex={0}
        expanded={false}
        onToggle={noop}
        playerNames={playerNames}
      />,
    );
    expect(screen.getByText(/Bidder:.*Bob.*@.*20/)).toBeInTheDocument();
  });

  it("shows 'No bids' for COMPLETED_NO_BIDDERS round", () => {
    render(
      <CompletedRoundView
        round={noBidderRound}
        roundIndex={0}
        expanded={false}
        onToggle={noop}
        playerNames={playerNames}
      />,
    );
    expect(screen.getByText("No bids")).toBeInTheDocument();
  });

  it("shows per-round scores for COMPLETED round", () => {
    render(
      <CompletedRoundView
        round={completedRound}
        roundIndex={0}
        expanded={false}
        onToggle={noop}
        playerNames={playerNames}
      />,
    );
    // scores appear in compact header
    expect(screen.getByText(/Alice.*\+20/)).toBeInTheDocument();
    expect(screen.getByText(/Bob.*-10/)).toBeInTheDocument();
  });

  it("shows collapsed arrow (▼) when collapsed", () => {
    render(
      <CompletedRoundView
        round={completedRound}
        roundIndex={0}
        expanded={false}
        onToggle={noop}
        playerNames={playerNames}
      />,
    );
    expect(screen.getByText("▼")).toBeInTheDocument();
  });

  it("shows expanded arrow (▲) when expanded", () => {
    render(
      <CompletedRoundView
        round={completedRound}
        roundIndex={0}
        expanded={true}
        onToggle={noop}
        playerNames={playerNames}
      />,
    );
    expect(screen.getByText("▲")).toBeInTheDocument();
  });

  it("calls onToggle when the expand button is clicked", () => {
    const onToggle = vi.fn();
    render(
      <CompletedRoundView
        round={completedRound}
        roundIndex={0}
        expanded={false}
        onToggle={onToggle}
        playerNames={playerNames}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("expand button has min-h-[44px] touch target", () => {
    render(
      <CompletedRoundView
        round={completedRound}
        roundIndex={0}
        expanded={false}
        onToggle={noop}
        playerNames={playerNames}
      />,
    );
    const button = screen.getByRole("button");
    expect(button.className).toContain("min-h-[44px]");
  });
});

describe("CompletedRoundView — expanded COMPLETED round", () => {
  it("shows trump symbol and name", () => {
    render(
      <CompletedRoundView
        round={completedRound}
        roundIndex={0}
        expanded={true}
        onToggle={noop}
        playerNames={playerNames}
      />,
    );
    expect(screen.getByText("♥")).toBeInTheDocument();
    expect(screen.getByText("HEARTS")).toBeInTheDocument();
  });

  it("shows bid history via BidHistoryPanel", () => {
    render(
      <CompletedRoundView
        round={completedRound}
        roundIndex={0}
        expanded={true}
        onToggle={noop}
        playerNames={playerNames}
      />,
    );
    // BidHistoryPanel renders bid entries
    expect(screen.getByText("Pass")).toBeInTheDocument();
    expect(screen.getByText("Twenty")).toBeInTheDocument();
  });

  it("shows player hands section", () => {
    render(
      <CompletedRoundView
        round={completedRound}
        roundIndex={0}
        expanded={true}
        onToggle={noop}
        playerNames={playerNames}
      />,
    );
    expect(screen.getByText("Hands")).toBeInTheDocument();
    // Card label for ACE of HEARTS appears in both the hands section and the tricks section
    expect(screen.getAllByText("A♥").length).toBeGreaterThanOrEqual(1);
  });

  it("shows player discards section", () => {
    render(
      <CompletedRoundView
        round={completedRound}
        roundIndex={0}
        expanded={true}
        onToggle={noop}
        playerNames={playerNames}
      />,
    );
    expect(screen.getByText("Discards")).toBeInTheDocument();
    // Card label for TWO of CLUBS
    expect(screen.getByText("2♣")).toBeInTheDocument();
  });

  it("shows tricks with winning play and bleeding badge", () => {
    render(
      <CompletedRoundView
        round={completedRound}
        roundIndex={0}
        expanded={true}
        onToggle={noop}
        playerNames={playerNames}
      />,
    );
    expect(screen.getByText("Tricks")).toBeInTheDocument();
    expect(screen.getByText("Trick 1")).toBeInTheDocument();
    expect(screen.getByText(/Won by Alice/)).toBeInTheDocument();
    expect(screen.getByText("Bleeding")).toBeInTheDocument();
  });

  it("shows round scores section in expanded view", () => {
    render(
      <CompletedRoundView
        round={completedRound}
        roundIndex={0}
        expanded={true}
        onToggle={noop}
        playerNames={playerNames}
      />,
    );
    expect(screen.getByText("Round Scores")).toBeInTheDocument();
  });
});

describe("CompletedRoundView — expanded COMPLETED_NO_BIDDERS round", () => {
  it("shows 'No bids — round was skipped' message", () => {
    render(
      <CompletedRoundView
        round={noBidderRound}
        roundIndex={0}
        expanded={true}
        onToggle={noop}
        playerNames={playerNames}
      />,
    );
    expect(screen.getByText("No bids — round was skipped")).toBeInTheDocument();
  });

  it("shows initial hands for all players", () => {
    render(
      <CompletedRoundView
        round={noBidderRound}
        roundIndex={0}
        expanded={true}
        onToggle={noop}
        playerNames={playerNames}
      />,
    );
    expect(screen.getByText("Initial Hands")).toBeInTheDocument();
    // J♦ for JACK of DIAMONDS
    expect(screen.getByText("J♦")).toBeInTheDocument();
    // 10♣ for TEN of CLUBS
    expect(screen.getByText("10♣")).toBeInTheDocument();
  });

  it("does not show trump section for no-bidder round", () => {
    render(
      <CompletedRoundView
        round={noBidderRound}
        roundIndex={0}
        expanded={true}
        onToggle={noop}
        playerNames={playerNames}
      />,
    );
    expect(screen.queryByText("Trump:")).toBeNull();
  });

  it("does not show Discards section for no-bidder round", () => {
    render(
      <CompletedRoundView
        round={noBidderRound}
        roundIndex={0}
        expanded={true}
        onToggle={noop}
        playerNames={playerNames}
      />,
    );
    expect(screen.queryByText("Discards")).toBeNull();
  });

  it("does not show Tricks section for no-bidder round", () => {
    render(
      <CompletedRoundView
        round={noBidderRound}
        roundIndex={0}
        expanded={true}
        onToggle={noop}
        playerNames={playerNames}
      />,
    );
    expect(screen.queryByText("Tricks")).toBeNull();
  });

  it("does not show scores section for no-bidder round", () => {
    render(
      <CompletedRoundView
        round={noBidderRound}
        roundIndex={0}
        expanded={true}
        onToggle={noop}
        playerNames={playerNames}
      />,
    );
    expect(screen.queryByText("Round Scores")).toBeNull();
  });
});
