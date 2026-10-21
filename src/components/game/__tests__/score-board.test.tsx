import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PlayerInGame } from "@/lib/api/types";
import { ScoreBoard } from "../score-board";

const players: PlayerInGame[] = [
  { id: "p1", type: "human" },
  { id: "p2", type: "cpu-easy" },
  { id: "p3", type: "cpu-easy" },
  { id: "p4", type: "cpu-easy" },
];
const names = new Map([
  ["p1", "Ann"],
  ["p2", "Bob"],
  ["p3", "Cy"],
  ["p4", "Di"],
]);

describe("ScoreBoard", () => {
  it("lists players in seat order with their scores, regardless of score order", () => {
    render(
      <ScoreBoard
        players={players}
        scores={{ p4: 50, p3: 30, p2: 10, p1: -5 }}
        currentPlayerId="p2"
        playerNames={names}
      />,
    );
    expect(screen.getAllByRole("term").map((c) => c.textContent)).toEqual([
      "Ann",
      "Bob (you)",
      "Cy",
      "Di",
    ]);
    expect(screen.getAllByRole("definition").map((c) => c.textContent)).toEqual(
      ["-5", "10", "30", "50"],
    );
  });

  it("shows 0 for players without a score yet", () => {
    render(<ScoreBoard players={players} scores={{}} currentPlayerId="p1" />);
    expect(screen.getAllByRole("definition").map((c) => c.textContent)).toEqual(
      ["0", "0", "0", "0"],
    );
  });

  it("renders nothing without players", () => {
    const { container } = render(
      <ScoreBoard players={[]} scores={{}} currentPlayerId="p1" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
