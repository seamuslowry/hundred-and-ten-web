import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BidHistoryPanel } from "../bid-history-panel";
import type { SpikeBid } from "@/lib/api/types";

vi.mock("@/lib/firebase", () => ({ auth: {} }));

const playerNames = new Map([
  ["player-1", "Alice"],
  ["player-2", "Bob"],
]);

describe("BidHistoryPanel", () => {
  it("renders each bid with player name and amount label", () => {
    const bids: SpikeBid[] = [
      { player_id: "player-1", amount: 15 },
      { player_id: "player-2", amount: 20 },
    ];
    render(<BidHistoryPanel bidHistory={bids} playerNames={playerNames} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Fifteen")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Twenty")).toBeInTheDocument();
  });

  it("displays amount 0 as 'Pass'", () => {
    const bids: SpikeBid[] = [{ player_id: "player-1", amount: 0 }];
    render(<BidHistoryPanel bidHistory={bids} playerNames={playerNames} />);
    expect(screen.getByText("Pass")).toBeInTheDocument();
  });

  it("renders nothing when bid history is empty", () => {
    const { container } = render(
      <BidHistoryPanel bidHistory={[]} playerNames={playerNames} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("resolves player names from map with fallback to truncated ID", () => {
    const bids: SpikeBid[] = [{ player_id: "unknown-player-id-xyz", amount: 15 }];
    render(<BidHistoryPanel bidHistory={bids} playerNames={playerNames} />);
    // Falls back to first 8 chars of ID
    expect(screen.getByText("unknown-")).toBeInTheDocument();
  });

  it("displays 15 as 'Fifteen'", () => {
    const bids: SpikeBid[] = [{ player_id: "player-1", amount: 15 }];
    render(<BidHistoryPanel bidHistory={bids} playerNames={playerNames} />);
    expect(screen.getByText("Fifteen")).toBeInTheDocument();
  });

  it("displays 20 as 'Twenty'", () => {
    const bids: SpikeBid[] = [{ player_id: "player-1", amount: 20 }];
    render(<BidHistoryPanel bidHistory={bids} playerNames={playerNames} />);
    expect(screen.getByText("Twenty")).toBeInTheDocument();
  });

  it("displays 25 as 'Twenty Five'", () => {
    const bids: SpikeBid[] = [{ player_id: "player-1", amount: 25 }];
    render(<BidHistoryPanel bidHistory={bids} playerNames={playerNames} />);
    expect(screen.getByText("Twenty Five")).toBeInTheDocument();
  });

  it("displays 30 as 'Thirty'", () => {
    const bids: SpikeBid[] = [{ player_id: "player-1", amount: 30 }];
    render(<BidHistoryPanel bidHistory={bids} playerNames={playerNames} />);
    expect(screen.getByText("Thirty")).toBeInTheDocument();
  });

  it("displays 60 as 'Shoot the Moon'", () => {
    const bids: SpikeBid[] = [{ player_id: "player-1", amount: 60 }];
    render(<BidHistoryPanel bidHistory={bids} playerNames={playerNames} />);
    expect(screen.getByText("Shoot the Moon")).toBeInTheDocument();
  });
});
