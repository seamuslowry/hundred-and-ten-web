import type { Trick, Card as CardType } from "@/lib/api/types";
import { SUIT_SYMBOL, NUMBER_LABEL } from "./card-labels";

interface TrickAreaProps {
  tricks: Trick[];
  /** Map player IDs to display names (truncated IDs used as fallback) */
  playerNames?: Map<string, string>;
}

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
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Trick {tricks.length}
        </h3>
        {currentTrick.bleeding && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600 dark:bg-red-900 dark:text-red-300">
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
              ? "text-purple-600 dark:text-purple-400"
              : isRed
                ? "text-red-600 dark:text-red-400"
                : "text-gray-900 dark:text-gray-100";

          return (
            <div
              key={`${play.player_id}-${play.card.number}-${play.card.suit}`}
              className={`flex min-w-[56px] flex-col items-center rounded-lg border-2 p-2 ${
                isWinning
                  ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-900"
                  : "border-gray-200 dark:border-gray-600"
              }`}
            >
              <span className="text-xs text-gray-500 dark:text-gray-400">
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
