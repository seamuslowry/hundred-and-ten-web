import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Card } from "@/lib/api/types";
import { Hand } from "../hand";

const cards = [
  { number: "ACE", suit: "HEARTS" },
  { number: "KING", suit: "SPADES" },
  { number: "FIVE", suit: "CLUBS" },
  { number: "TWO", suit: "DIAMONDS" },
  { number: "THREE", suit: "HEARTS" },
  { number: "FOUR", suit: "SPADES" },
] as Card[];

describe("Hand", () => {
  it("renders every card", () => {
    render(<Hand cards={cards} />);
    expect(screen.getAllByRole("button")).toHaveLength(cards.length);
  });

  it("wraps cards instead of scrolling horizontally", () => {
    const { container } = render(<Hand cards={cards} />);
    const row = screen.getAllByRole("button")[0].parentElement!;
    expect(row).toHaveClass("flex-wrap");
    expect(container.innerHTML).not.toContain("overflow-x");
  });
});
