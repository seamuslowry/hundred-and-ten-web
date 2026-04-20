import type { GameStatus, SelectableSuit } from "@/lib/api/types";
import { SUIT_SYMBOL } from "./card-labels";

interface GameStatusBarProps {
  phase: GameStatus;
  myTurn: boolean;
  isStale: boolean;
  activePlayerId?: string | null;
  bidAmount?: number | null;
  bidderPlayerId?: string | null;
  dealerPlayerId?: string | null;
  playerId?: string | null;
  trump?: SelectableSuit | null;
}

const phaseLabels: Record<GameStatus, string> = {
  BIDDING: "Bidding",
  TRUMP_SELECTION: "Selecting Trump",
  DISCARD: "Discarding",
  TRICKS: "Playing Tricks",
  WON: "Game Over",
};

const SUIT_NAME: Record<SelectableSuit, string> = {
  HEARTS: "Hearts",
  DIAMONDS: "Diamonds",
  CLUBS: "Clubs",
  SPADES: "Spades",
};

function shortId(id: string, playerId?: string | null): string {
  return id.slice(0, 8) + (playerId && id === playerId ? " (you)" : "");
}

export function GameStatusBar({
  phase,
  myTurn,
  isStale,
  activePlayerId,
  bidAmount,
  bidderPlayerId,
  dealerPlayerId,
  playerId,
  trump,
}: GameStatusBarProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-gray-100 px-4 py-3 dark:bg-gray-800">
      {/* Phase + turn row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Phase
          </span>
          <span className="font-semibold dark:text-gray-100">
            {phaseLabels[phase]}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {phase !== "WON" && (
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                myTurn
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                  : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              {myTurn
                ? "Your turn"
                : `Waiting for ${activePlayerId?.slice(0, 8) ?? "..."}`}
            </span>
          )}

          {isStale && (
            <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
              Reconnecting...
            </span>
          )}
        </div>
      </div>

      {/* Persistent game info: dealer + bidder */}
      {phase !== "WON" && (dealerPlayerId || bidderPlayerId) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {dealerPlayerId && (
            <span className="text-gray-500 dark:text-gray-400">
              Dealer:{" "}
              <span className="font-medium text-gray-700 dark:text-gray-200">
                {shortId(dealerPlayerId, playerId)}
              </span>
            </span>
          )}
          {bidderPlayerId && (
            <span className="text-gray-500 dark:text-gray-400">
              Bid winner:{" "}
              <span className="font-medium text-gray-700 dark:text-gray-200">
                {shortId(bidderPlayerId, playerId)}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Bidding context: current standing bid during BIDDING phase */}
      {phase === "BIDDING" && (
        <div className="flex items-center gap-2 text-sm">
          {bidAmount != null && bidAmount > 0 ? (
            <span className="text-gray-500 dark:text-gray-400">
              Current bid:{" "}
              <span className="font-semibold text-gray-700 dark:text-gray-200">
                {bidAmount}
              </span>
            </span>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">
              No bids yet
            </span>
          )}
        </div>
      )}

      {/* Trump display */}
      {(phase === "DISCARD" || phase === "TRICKS") && trump != null && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 dark:text-gray-400">Trump:</span>
          <span
            className={`font-semibold ${
              trump === "HEARTS" || trump === "DIAMONDS"
                ? "text-red-600 dark:text-red-400"
                : "text-gray-900 dark:text-gray-100"
            }`}
          >
            {SUIT_SYMBOL[trump]} {SUIT_NAME[trump]}
          </span>
        </div>
      )}
    </div>
  );
}
