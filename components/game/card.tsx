"use client";

import type { Card as CardType } from "@/lib/api/types";
import { SUIT_SYMBOL, NUMBER_LABEL } from "./card-labels";

interface CardProps {
  card: CardType;
  selected?: boolean;
  suggested?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function Card({
  card,
  selected,
  suggested,
  disabled,
  onClick,
}: CardProps) {
  const isRed = card.suit === "HEARTS" || card.suit === "DIAMONDS";
  const isJoker = card.suit === "JOKER";

  const textColor = isJoker
    ? "text-purple-600"
    : isRed
      ? "text-red-600"
      : "text-gray-900";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !selected}
      className={`flex min-h-[60px] min-w-[44px] flex-col items-center justify-center rounded-lg border-2 px-2 py-1 transition-all ${
        selected
          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-300"
          : suggested
            ? "border-amber-400 bg-amber-50 ring-2 ring-amber-300"
            : "border-gray-200 bg-white hover:border-gray-400"
      } ${disabled && !selected ? "opacity-50" : "cursor-pointer"}`}
      aria-label={`${card.number} of ${card.suit}`}
      aria-pressed={selected}
    >
      {isJoker ? (
        <span className={`text-lg font-bold ${textColor}`}>Joker</span>
      ) : (
        <>
          <span className={`text-lg font-bold leading-tight ${textColor}`}>
            {NUMBER_LABEL[card.number]}
          </span>
          <span className={`text-sm ${textColor}`}>
            {SUIT_SYMBOL[card.suit]}
          </span>
        </>
      )}
    </button>
  );
}
