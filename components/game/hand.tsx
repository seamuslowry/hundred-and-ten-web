"use client";

import type { Card as CardType } from "@/lib/api/types";
import { Card } from "./card";

interface HandProps {
  cards: CardType[];
  selectedCards?: CardType[];
  suggestedCards?: CardType[];
  selectable?: boolean;
  multiSelect?: boolean;
  disabled?: boolean;
  onSelect?: (card: CardType) => void;
}

function cardKey(card: CardType): string {
  return `${card.number}-${card.suit}`;
}

function cardEquals(a: CardType, b: CardType): boolean {
  return a.number === b.number && a.suit === b.suit;
}

export function Hand({
  cards,
  selectedCards = [],
  suggestedCards = [],
  selectable = false,
  disabled = false,
  onSelect,
}: HandProps) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium text-gray-500">Your Hand</h3>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {cards.map((card) => (
          <Card
            key={cardKey(card)}
            card={card}
            selected={selectedCards.some((c) => cardEquals(c, card))}
            suggested={suggestedCards.some((c) => cardEquals(c, card))}
            disabled={disabled || !selectable}
            onClick={selectable && onSelect ? () => onSelect(card) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export { cardEquals };
