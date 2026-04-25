import type { Card as CardType } from "@/lib/api/types";
import { SUIT_SYMBOL, NUMBER_LABEL } from "./card-labels";

interface CardProps {
  card: CardType;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function Card({ card, selected, disabled, onClick }: CardProps) {
  const isRed = card.suit === "HEARTS" || card.suit === "DIAMONDS";
  const isJoker = card.suit === "JOKER";

  const textColor = isJoker
    ? "text-purple-600 dark:text-purple-400"
    : isRed
      ? "text-red-600 dark:text-red-400"
      : "text-gray-900 dark:text-gray-100";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !selected}
      className={`flex min-h-[130px] min-w-[88px] flex-col items-center justify-center rounded-xl border-2 px-3 py-3 transition-all md:min-h-[160px] md:min-w-[110px] lg:min-h-[200px] lg:min-w-[140px] ${
        selected
          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-300 dark:bg-blue-900 dark:ring-blue-700"
          : "border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800" +
            (disabled
              ? ""
              : " hover:border-gray-400 dark:hover:border-gray-400")
      } ${disabled && !selected ? "opacity-50" : "cursor-pointer"}`}
      aria-label={`${card.number} of ${card.suit}`}
      aria-pressed={selected}
    >
      {isJoker ? (
        <span
          className={`text-2xl font-bold md:text-3xl lg:text-4xl ${textColor}`}
        >
          Joker
        </span>
      ) : (
        <>
          <span
            className={`text-3xl font-bold leading-tight md:text-4xl lg:text-5xl ${textColor}`}
          >
            {NUMBER_LABEL[card.number]}
          </span>
          <span className={`text-2xl md:text-3xl lg:text-4xl ${textColor}`}>
            {SUIT_SYMBOL[card.suit]}
          </span>
        </>
      )}
    </button>
  );
}
