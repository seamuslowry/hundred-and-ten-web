"use client";

import type { Trick, Card as CardType } from "@/lib/api/types";

interface TrickAreaProps {
  tricks: Trick[];
  /** Map player IDs to display names (truncated IDs used as fallback) */
  playerNames?: Map<string, string>;
}

const SUIT_SYMBOL: Record<string, string> = {
  HEARTS: "\u2665",
  DIAMONDS: "\u2666",
  CLUBS: "\u2663",
  SPADES: "\u2660",
  JOKER: "\u2606",
};

const NUMBER_LABEL: Record<string, string> = {
  TWO: "2",
  THREE: "3",
  FOUR: "4",
  FIVE: "5",
  SIX: "6",
  SEVEN: "7",
  EIGHT: "8",
  NINE: "9",
  TEN: "10",
  JACK: "J",
  QUEEN: "Q",
  KING: "K",
  ACE: "A",
  JOKER: "\u2606",
};

function cardLabel(card: CardType): string {
  if (card.suit === "JOKER") return "Joker";
  return `${NUMBER_LABEL[card.number]}${SUIT_SYMBOL[card.suit]}`;
}

export function TrickArea({ tricks, playerNames }: TrickAreaProps) {
  if (tricks.length === 0) return null;

  const currentTrick = tricks[tricks.length - 1];

  function displayName(playerId: string): string {
    return playerNames?.get(playerId) ?? playerId.slice(0, 8);
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-sm font-medium text-gray-500">
          Trick {tricks.length}
        </h3>
        {currentTrick.bleeding && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">
            Bleeding
          </span>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {currentTrick.plays.map((play) => {
          const isWinning =
            currentTrick.winning_play?.player_id === play.player_id;
          const isRed =
            play.card.suit === "HEARTS" || play.card.suit === "DIAMONDS";
          const textColor =
            play.card.suit === "JOKER"
              ? "text-purple-600"
              : isRed
                ? "text-red-600"
                : "text-gray-900";

          return (
            <div
              key={`${play.player_id}-${play.card.number}-${play.card.suit}`}
              className={`flex min-w-[56px] flex-col items-center rounded-lg border-2 p-2 ${
                isWinning ? "border-yellow-400 bg-yellow-50" : "border-gray-200"
              }`}
            >
              <span className="text-xs text-gray-500">
                {displayName(play.player_id)}
              </span>
              <span className={`text-lg font-bold ${textColor}`}>
                {cardLabel(play.card)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
