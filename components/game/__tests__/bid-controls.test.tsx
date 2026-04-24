import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BidControls, BID_LABELS } from "../bid-controls";

vi.mock("@/lib/firebase", () => ({ auth: {} }));

describe("BID_LABELS", () => {
  it("maps 0 to 'Pass'", () => {
    expect(BID_LABELS[0]).toBe("Pass");
  });

  it("maps 15 to '15'", () => {
    expect(BID_LABELS[15]).toBe("15");
  });

  it("maps 20 to '20'", () => {
    expect(BID_LABELS[20]).toBe("20");
  });

  it("maps 25 to '25'", () => {
    expect(BID_LABELS[25]).toBe("25");
  });

  it("maps 30 to '30'", () => {
    expect(BID_LABELS[30]).toBe("30");
  });

  it("maps 60 to 'Shoot the Moon'", () => {
    expect(BID_LABELS[60]).toBe("Shoot the Moon");
  });
});

describe("BidControls", () => {
  it("renders 'Shoot the Moon' button instead of '60'", () => {
    render(
      <BidControls currentBid={null} onBid={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Shoot the Moon" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "60" })).toBeNull();
  });

  it("renders 'Pass' button", () => {
    render(
      <BidControls currentBid={null} onBid={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Pass" })).toBeInTheDocument();
  });

  it("renders buttons for 15, 20, 25, 30 with numeric labels", () => {
    render(
      <BidControls currentBid={null} onBid={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "15" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "20" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "25" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "30" })).toBeInTheDocument();
  });

  it("disables bids at or below currentBid when canMatchCurrentBid is false", () => {
    render(
      <BidControls currentBid={20} canMatchCurrentBid={false} onBid={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "15" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "20" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "25" })).not.toBeDisabled();
  });

  it("disables bids strictly below currentBid when canMatchCurrentBid is true", () => {
    render(
      <BidControls currentBid={20} canMatchCurrentBid={true} onBid={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "15" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "20" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "25" })).not.toBeDisabled();
  });

  it("disables all bid buttons when disabled prop is true", () => {
    render(
      <BidControls currentBid={null} disabled onBid={vi.fn()} />,
    );
    for (const name of ["15", "20", "25", "30", "Shoot the Moon", "Pass"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });
});
