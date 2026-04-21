import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GameStatusBar } from "../game-status-bar";

const noop = vi.fn().mockResolvedValue(undefined);

const defaultProps = {
  phase: "BIDDING" as const,
  myTurn: false,
  isStale: false,
  onRefresh: noop,
  isRefreshing: false,
};

describe("GameStatusBar", () => {
  it("shows 'Your turn' pill when myTurn is true", () => {
    render(<GameStatusBar {...defaultProps} myTurn={true} />);
    expect(screen.getByText("Your turn")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows Refresh button when myTurn is false and game is active", () => {
    render(
      <GameStatusBar
        {...defaultProps}
        myTurn={false}
        activePlayerId="abc12345"
      />,
    );
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(screen.queryByText("Your turn")).toBeNull();
  });

  it("shows neither turn indicator when phase is WON", () => {
    render(<GameStatusBar {...defaultProps} phase="WON" myTurn={false} />);
    expect(screen.queryByText("Your turn")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("calls onRefresh when Refresh button is clicked", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(
      <GameStatusBar {...defaultProps} myTurn={false} onRefresh={onRefresh} />,
    );

    fireEvent.click(screen.getByRole("button"));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("button is disabled when isRefreshing is true", () => {
    render(
      <GameStatusBar {...defaultProps} myTurn={false} isRefreshing={true} />,
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("disabled button does not call onRefresh when clicked", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(
      <GameStatusBar
        {...defaultProps}
        myTurn={false}
        isRefreshing={true}
        onRefresh={onRefresh}
      />,
    );

    fireEvent.click(screen.getByRole("button"));
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("Refresh button meets 44px touch target", () => {
    render(<GameStatusBar {...defaultProps} myTurn={false} />);
    const button = screen.getByRole("button");
    expect(button.className).toContain("min-h-[44px]");
  });
});
