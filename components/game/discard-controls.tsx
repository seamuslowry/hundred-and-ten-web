"use client";

import { useState } from "react";
import type { Card as CardType } from "@/lib/api/types";
import { Hand, cardEquals } from "./hand";

interface DiscardControlsProps {
  cards: CardType[];
  disabled?: boolean;
  onDiscard: (cards: CardType[]) => void;
  suggestedCards?: CardType[];
}

export function DiscardControls({
  cards,
  disabled,
  onDiscard,
  suggestedCards = [],
}: DiscardControlsProps) {
  const [selected, setSelected] = useState<CardType[]>([]);
  const [confirming, setConfirming] = useState(false);

  function toggleCard(card: CardType) {
    setSelected((prev) => {
      const exists = prev.some((c) => cardEquals(c, card));
      if (exists) return prev.filter((c) => !cardEquals(c, card));
      return [...prev, card];
    });
    setConfirming(false);
  }

  function handleDiscard() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    onDiscard(selected);
  }

  return (
    <div className="space-y-3">
      <Hand
        cards={cards}
        selectedCards={selected}
        suggestedCards={suggestedCards}
        selectable
        disabled={disabled}
        onSelect={toggleCard}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleDiscard}
          disabled={disabled || selected.length === 0}
          className={`min-h-[44px] rounded-lg px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${
            confirming
              ? "bg-red-600 hover:bg-red-700"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {confirming
            ? `Confirm discard ${selected.length} card${selected.length !== 1 ? "s" : ""}?`
            : `Discard ${selected.length} card${selected.length !== 1 ? "s" : ""}`}
        </button>
        {confirming && (
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="min-h-[44px] rounded-lg bg-gray-200 px-4 py-2 font-medium text-gray-700 hover:bg-gray-300"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
