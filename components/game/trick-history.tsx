import { useState } from "react";
import type { Trick, Card as CardType } from "@/lib/api/types";
import { SUIT_SYMBOL, NUMBER_LABEL } from "./card-labels";

interface TrickHistoryProps {
  tricks: Trick[];
  playerNames?: Map<string, string>;
}

function cardLabel(card: CardType): string {
  if (card.suit === "JOKER") return "Joker";
  return `${NUMBER_LABEL[card.number]}${SUIT_SYMBOL[card.suit]}`;
}

function cardTextColor(card: CardType): string {
  if (card.suit === "JOKER") return "text-purple-600 dark:text-purple-400";
  if (card.suit === "HEARTS" || card.suit === "DIAMONDS")
    return "text-red-600 dark:text-red-400";
  return "text-gray-900 dark:text-gray-100";
}

export function TrickHistory({ tricks, playerNames }: TrickHistoryProps) {
  const [expanded, setExpanded] = useState(false);

  // All completed tricks = all except the last (current) trick
  const completedTricks = tricks.slice(0, -1);

  if (completedTricks.length === 0) return null;

  const count = completedTricks.length;
  const label = `${count} trick${count !== 1 ? "s" : ""} played`;

  function displayName(id: string): string {
    return playerNames?.get(id) ?? id.slice(0, 8);
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
      >
        <span>{label}</span>
        <span className="text-xs">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="mt-3 max-h-64 overflow-y-auto">
          <div className="flex flex-col-reverse gap-3">
            {completedTricks.map((trick, i) => (
              <div
                key={i}
                className="rounded border border-gray-100 p-2 dark:border-gray-700"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Trick {i + 1}
                  </span>
                  {trick.winningPlay && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      Won by {displayName(trick.winningPlay.playerId)}
                    </span>
                  )}
                  {trick.bleeding && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600 dark:bg-red-900 dark:text-red-300">
                      Bleeding
                    </span>
                  )}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {trick.plays.map((play) => {
                    const isWinning =
                      trick.winningPlay?.playerId === play.playerId;
                    return (
                      <div
                        key={`${play.playerId}-${play.card.number}-${play.card.suit}`}
                        className={`flex min-w-[50px] flex-col items-center rounded-lg border-2 p-1.5 ${
                          isWinning
                            ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-900"
                            : "border-gray-200 dark:border-gray-600"
                        }`}
                      >
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {displayName(play.playerId)}
                        </span>
                        <span
                          className={`text-base font-bold ${cardTextColor(play.card)}`}
                        >
                          {cardLabel(play.card)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
