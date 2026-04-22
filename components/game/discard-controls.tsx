import { useState } from "react";
import type { Card as CardType, SelectableSuit } from "@/lib/api/types";
import { Hand, cardEquals } from "./hand";

// Client-side trump determination. Joker and Ace of Hearts are always trump.
// Any card matching the elected trump suit is also trump.
// Note: the backend is the authoritative source for trump rules; this logic
// is cosmetic (drives auto-selection defaults) and will be removed once the
// backend exposes per-card trump status.
function isTrump(card: CardType, trump: SelectableSuit | null): boolean {
  return (
    card.suit === "JOKER" ||
    (card.number === "ACE" && card.suit === "HEARTS") ||
    (trump !== null && card.suit === trump)
  );
}

interface DiscardControlsProps {
  cards: CardType[];
  trump: SelectableSuit | null;
  disabled?: boolean;
  onDiscard: (cards: CardType[]) => void;
}

export function DiscardControls({
  cards,
  trump,
  disabled,
  onDiscard,
}: DiscardControlsProps) {
  const [selected, setSelected] = useState<CardType[]>(() =>
    cards.filter((c) => !isTrump(c, trump)),
  );

  function toggleCard(card: CardType) {
    setSelected((prev) => {
      const exists = prev.some((c) => cardEquals(c, card));
      if (exists) return prev.filter((c) => !cardEquals(c, card));
      return [...prev, card];
    });
  }

  return (
    <div className="space-y-3">
      <Hand
        cards={cards}
        selectedCards={selected}
        selectable
        disabled={disabled}
        onSelect={toggleCard}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onDiscard(selected)}
          disabled={disabled || selected.length === 0}
          className="min-h-[44px] rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {`Discard ${selected.length} card${selected.length !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
