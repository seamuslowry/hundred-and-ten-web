import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DiscardControls } from "../discard-controls";
import type { Card } from "@/lib/api/types";

const ACE_HEARTS: Card = { number: "ACE", suit: "HEARTS" };
const JOKER: Card = { number: "JOKER", suit: "JOKER" };
const FIVE_HEARTS: Card = { number: "FIVE", suit: "HEARTS" };
const THREE_CLUBS: Card = { number: "THREE", suit: "CLUBS" };
const KING_SPADES: Card = { number: "KING", suit: "SPADES" };
const TWO_DIAMONDS: Card = { number: "TWO", suit: "DIAMONDS" };

describe("DiscardControls", () => {
  describe("auto-selection on mount", () => {
    it("pre-selects non-trump cards and leaves trump cards unselected", () => {
      // trump = HEARTS: FIVE_HEARTS is trump suit, ACE_HEARTS always trump
      // THREE_CLUBS and KING_SPADES are not trump
      const onDiscard = vi.fn();
      render(
        <DiscardControls
          cards={[ACE_HEARTS, FIVE_HEARTS, THREE_CLUBS, KING_SPADES]}
          trump="HEARTS"
          onDiscard={onDiscard}
        />,
      );
      // Button label reflects 2 pre-selected non-trump cards
      expect(
        screen.getByRole("button", { name: /discard 2 cards/i }),
      ).toBeInTheDocument();
      // onDiscard must NOT fire automatically on mount
      expect(onDiscard).not.toHaveBeenCalled();
    });

    it("does not pre-select the Joker even when trump is set", () => {
      const onDiscard = vi.fn();
      render(
        <DiscardControls
          cards={[JOKER, THREE_CLUBS]}
          trump="HEARTS"
          onDiscard={onDiscard}
        />,
      );
      // Only THREE_CLUBS pre-selected
      expect(
        screen.getByRole("button", { name: /discard 1 card$/i }),
      ).toBeInTheDocument();
    });

    it("does not pre-select Ace of Hearts even when trump is another suit", () => {
      const onDiscard = vi.fn();
      render(
        <DiscardControls
          cards={[ACE_HEARTS, THREE_CLUBS]}
          trump="CLUBS"
          onDiscard={onDiscard}
        />,
      );
      // ACE_HEARTS is always trump; THREE_CLUBS matches trump suit
      // Neither pre-selected
      expect(
        screen.getByRole("button", { name: /discard 0 cards/i }),
      ).toBeInTheDocument();
    });

    it("does not pre-select cards matching the trump suit", () => {
      const onDiscard = vi.fn();
      render(
        <DiscardControls
          cards={[FIVE_HEARTS, THREE_CLUBS]}
          trump="HEARTS"
          onDiscard={onDiscard}
        />,
      );
      // FIVE_HEARTS matches trump suit; THREE_CLUBS pre-selected
      expect(
        screen.getByRole("button", { name: /discard 1 card$/i }),
      ).toBeInTheDocument();
    });

    it("pre-selects all cards when trump is null (only Joker and Ace of Hearts exempt)", () => {
      const onDiscard = vi.fn();
      render(
        <DiscardControls
          cards={[THREE_CLUBS, KING_SPADES, TWO_DIAMONDS]}
          trump={null}
          onDiscard={onDiscard}
        />,
      );
      expect(
        screen.getByRole("button", { name: /discard 3 cards/i }),
      ).toBeInTheDocument();
    });

    it("pre-selects no cards when all cards are trump", () => {
      const onDiscard = vi.fn();
      render(
        <DiscardControls
          cards={[JOKER, ACE_HEARTS]}
          trump="CLUBS"
          onDiscard={onDiscard}
        />,
      );
      expect(
        screen.getByRole("button", { name: /discard 0 cards/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /discard 0 cards/i }),
      ).toBeDisabled();
    });

    it("does not pre-select Ace of Hearts when trump is HEARTS (double-trump overlap)", () => {
      // ACE_HEARTS is always trump AND matches trump suit — should still not be pre-selected
      const onDiscard = vi.fn();
      render(
        <DiscardControls
          cards={[ACE_HEARTS, THREE_CLUBS]}
          trump="HEARTS"
          onDiscard={onDiscard}
        />,
      );
      // Only THREE_CLUBS pre-selected
      expect(
        screen.getByRole("button", { name: /discard 1 card$/i }),
      ).toBeInTheDocument();
    });

    it("pre-selects all cards when none are trump", () => {
      const onDiscard = vi.fn();
      render(
        <DiscardControls
          cards={[THREE_CLUBS, KING_SPADES]}
          trump="HEARTS"
          onDiscard={onDiscard}
        />,
      );
      expect(
        screen.getByRole("button", { name: /discard 2 cards/i }),
      ).toBeInTheDocument();
    });
  });

  describe("single-click discard (no confirmation)", () => {
    it("calls onDiscard immediately on first button click", () => {
      const onDiscard = vi.fn();
      render(
        <DiscardControls
          cards={[THREE_CLUBS, KING_SPADES]}
          trump="HEARTS"
          onDiscard={onDiscard}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /discard/i }));
      expect(onDiscard).toHaveBeenCalledTimes(1);
      expect(onDiscard).toHaveBeenCalledWith([THREE_CLUBS, KING_SPADES]);
    });

    it("does not show a Cancel button", () => {
      render(
        <DiscardControls
          cards={[THREE_CLUBS]}
          trump="HEARTS"
          onDiscard={vi.fn()}
        />,
      );
      expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull();
    });
  });

  describe("manual card toggling", () => {
    it("calls onDiscard with updated selection after toggling a card off", () => {
      const onDiscard = vi.fn();
      render(
        <DiscardControls
          cards={[THREE_CLUBS, KING_SPADES]}
          trump="HEARTS"
          onDiscard={onDiscard}
        />,
      );
      // Both pre-selected; deselect THREE_CLUBS
      fireEvent.click(screen.getByRole("button", { name: /three of clubs/i }));
      fireEvent.click(screen.getByRole("button", { name: /discard 1 card$/i }));
      expect(onDiscard).toHaveBeenCalledTimes(1);
      expect(onDiscard).toHaveBeenCalledWith([KING_SPADES]);
    });

    it("calls onDiscard with a trump card when player manually selects it", () => {
      const onDiscard = vi.fn();
      render(
        <DiscardControls
          cards={[JOKER, THREE_CLUBS]}
          trump="HEARTS"
          onDiscard={onDiscard}
        />,
      );
      // THREE_CLUBS pre-selected, JOKER not; toggle JOKER on
      fireEvent.click(screen.getByRole("button", { name: /joker of joker/i }));
      fireEvent.click(screen.getByRole("button", { name: /discard 2 cards/i }));
      expect(onDiscard).toHaveBeenCalledTimes(1);
      expect(onDiscard).toHaveBeenCalledWith([THREE_CLUBS, JOKER]);
    });

    it("calls onDiscard with correct cards after toggling a card off then back on", () => {
      const onDiscard = vi.fn();
      render(
        <DiscardControls
          cards={[THREE_CLUBS, KING_SPADES]}
          trump="HEARTS"
          onDiscard={onDiscard}
        />,
      );
      // Deselect THREE_CLUBS then re-select it
      fireEvent.click(screen.getByRole("button", { name: /three of clubs/i }));
      fireEvent.click(screen.getByRole("button", { name: /three of clubs/i }));
      fireEvent.click(screen.getByRole("button", { name: /discard 2 cards/i }));
      expect(onDiscard).toHaveBeenCalledTimes(1);
      expect(onDiscard).toHaveBeenCalledWith([KING_SPADES, THREE_CLUBS]);
    });
  });

  describe("disabled state", () => {
    it("disables the discard button when disabled prop is true", () => {
      render(
        <DiscardControls
          cards={[THREE_CLUBS]}
          trump="HEARTS"
          disabled={true}
          onDiscard={vi.fn()}
        />,
      );
      expect(screen.getByRole("button", { name: /discard/i })).toBeDisabled();
    });
  });
});
