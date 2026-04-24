import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RoundHeader } from "../round-header";

vi.mock("@/lib/firebase", () => ({ auth: {} }));

const noop = vi.fn().mockResolvedValue(undefined);

const playerNames = new Map([
  ["player-1", "Alice"],
  ["player-2", "Bob"],
  ["player-3", "Carol"],
]);

const defaultProps = {
  phase: "BIDDING",
  dealerPlayerId: "player-1",
  bidderPlayerId: null,
  bidAmount: null,
  trump: null,
  activePlayerId: "player-2",
  playerId: "player-1",
  playerNames,
  onRefresh: noop,
  isRefreshing: false,
  isStale: false,
};

describe("RoundHeader", () => {
  it("displays phase badge and dealer name", () => {
    render(<RoundHeader {...defaultProps} />);
    expect(screen.getByText("Bidding")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("shows 'Your turn' pill when activePlayerId matches playerId", () => {
    render(
      <RoundHeader {...defaultProps} activePlayerId="player-1" playerId="player-1" />,
    );
    expect(screen.getByText("Your turn")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows bidder and bid amount when both are non-null", () => {
    render(
      <RoundHeader
        {...defaultProps}
        phase="DISCARD"
        bidderPlayerId="player-2"
        bidAmount={20}
      />,
    );
    expect(screen.getByText(/Bob.*@.*Twenty/)).toBeInTheDocument();
  });

  it("shows trump suit symbol when trump is non-null", () => {
    render(<RoundHeader {...defaultProps} trump="HEARTS" />);
    expect(screen.getByText("♥")).toBeInTheDocument();
  });

  it("shows '(pending)' when bidderPlayerId is null and phase is BIDDING", () => {
    render(
      <RoundHeader {...defaultProps} phase="BIDDING" bidderPlayerId={null} />,
    );
    expect(screen.getByText("(pending)")).toBeInTheDocument();
  });

  it("shows 'Waiting for Player N' with refresh button when not player's turn", () => {
    render(
      <RoundHeader {...defaultProps} activePlayerId="player-2" playerId="player-1" />,
    );
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button.textContent).toContain("Waiting for Bob");
    expect(button.textContent).toContain("↻");
  });

  it("shows 'Reconnecting...' when isStale is true", () => {
    render(<RoundHeader {...defaultProps} isStale={true} />);
    expect(screen.getByText("Reconnecting...")).toBeInTheDocument();
  });

  it("refresh button calls onRefresh when clicked", () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(
      <RoundHeader
        {...defaultProps}
        activePlayerId="player-2"
        playerId="player-1"
        onRefresh={onRefresh}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("refresh button is disabled when isRefreshing is true", () => {
    render(
      <RoundHeader
        {...defaultProps}
        activePlayerId="player-2"
        playerId="player-1"
        isRefreshing={true}
      />,
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("refresh button meets 44px touch target", () => {
    render(
      <RoundHeader {...defaultProps} activePlayerId="player-2" playerId="player-1" />,
    );
    const button = screen.getByRole("button");
    expect(button.className).toContain("min-h-[44px]");
  });

  it("shows diamonds trump symbol", () => {
    render(<RoundHeader {...defaultProps} trump="DIAMONDS" />);
    expect(screen.getByText("♦")).toBeInTheDocument();
  });

  it("shows clubs trump symbol", () => {
    render(<RoundHeader {...defaultProps} trump="CLUBS" />);
    expect(screen.getByText("♣")).toBeInTheDocument();
  });

  it("shows spades trump symbol", () => {
    render(<RoundHeader {...defaultProps} trump="SPADES" />);
    expect(screen.getByText("♠")).toBeInTheDocument();
  });

  it("does not show bidder section when not in BIDDING phase and bidderPlayerId is null", () => {
    render(
      <RoundHeader
        {...defaultProps}
        phase="TRICKS"
        bidderPlayerId={null}
        bidAmount={null}
      />,
    );
    expect(screen.queryByText("(pending)")).toBeNull();
    expect(screen.queryByText(/Bidder/)).toBeNull();
  });

  it("shows bidder section when bidderPlayerId is non-null regardless of phase", () => {
    render(
      <RoundHeader
        {...defaultProps}
        phase="TRICKS"
        bidderPlayerId="player-3"
        bidAmount={25}
      />,
    );
    expect(screen.getByText(/Carol.*@.*Twenty Five/)).toBeInTheDocument();
  });
});
