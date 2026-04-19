"use client";

import type { SelectableSuit } from "@/lib/api/types";

interface TrumpSelectorProps {
  disabled?: boolean;
  onSelect: (suit: SelectableSuit) => void;
  suggestedSuit?: SelectableSuit;
}

const SUITS: { suit: SelectableSuit; symbol: string; color: string }[] = [
  { suit: "HEARTS", symbol: "\u2665", color: "text-red-600" },
  { suit: "DIAMONDS", symbol: "\u2666", color: "text-red-600" },
  { suit: "CLUBS", symbol: "\u2663", color: "text-gray-900" },
  { suit: "SPADES", symbol: "\u2660", color: "text-gray-900" },
];

export function TrumpSelector({
  disabled,
  onSelect,
  suggestedSuit,
}: TrumpSelectorProps) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium text-gray-500">Select Trump</h3>
      <div className="flex gap-3">
        {SUITS.map(({ suit, symbol, color }) => {
          const isSuggested = suggestedSuit === suit;
          return (
            <button
              key={suit}
              type="button"
              onClick={() => onSelect(suit)}
              disabled={disabled}
              className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border-2 bg-white px-4 py-2 text-2xl disabled:cursor-not-allowed disabled:opacity-50 ${color} ${
                isSuggested
                  ? "border-amber-400 ring-2 ring-amber-300"
                  : "border-gray-200 hover:border-blue-400 hover:bg-blue-50"
              }`}
              aria-label={suit.toLowerCase()}
            >
              {symbol}
            </button>
          );
        })}
      </div>
    </div>
  );
}
