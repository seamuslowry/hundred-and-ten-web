
import { SUIT_SYMBOL } from "./card-labels";

interface RoundHeaderProps {
  phase: string;
  dealerPlayerId: string;
  bidderPlayerId: string | null;
  bidAmount: number | null;
  trump: string | null;
  activePlayerId: string;
  playerId: string;
  playerNames: Map<string, string>;
  onRefresh?: () => Promise<void>;
  isRefreshing?: boolean;
  isStale?: boolean;
}

const PHASE_LABEL: Record<string, string> = {
  BIDDING: "Bidding",
  TRUMP_SELECTION: "Selecting Trump",
  DISCARD: "Discarding",
  TRICKS: "Playing Tricks",
};

const BID_LABEL: Record<number, string> = {
  0: "Pass",
  15: "Fifteen",
  20: "Twenty",
  25: "Twenty Five",
  30: "Thirty",
  60: "Shoot the Moon",
};

function displayName(id: string, playerNames: Map<string, string>): string {
  return playerNames.get(id) ?? id.slice(0, 8);
}

export function RoundHeader({
  phase,
  dealerPlayerId,
  bidderPlayerId,
  bidAmount,
  trump,
  activePlayerId,
  playerId,
  playerNames,
  onRefresh = async () => {},
  isRefreshing = false,
  isStale = false,
}: RoundHeaderProps) {
  const isMyTurn = activePlayerId === playerId;
  const phaseLabel = PHASE_LABEL[phase] ?? phase;

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-gray-100 px-4 py-3 dark:bg-gray-800">
      {/* Phase + turn row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Phase</span>
          <span className="rounded-full bg-gray-200 px-3 py-1 text-sm font-semibold dark:bg-gray-700 dark:text-gray-100">
            {phaseLabel}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {isMyTurn ? (
            <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              Your turn
            </span>
          ) : (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className={`min-h-[44px] rounded-full px-3 text-sm font-medium ${
                isRefreshing
                  ? "cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
                  : "cursor-pointer bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              {`Waiting for ${displayName(activePlayerId, playerNames)} ↻`}
            </button>
          )}

          {isStale && (
            <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
              Reconnecting...
            </span>
          )}
        </div>
      </div>

      {/* Dealer + bidder info */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="text-gray-500 dark:text-gray-400">
          Dealer:{" "}
          <span className="font-medium text-gray-700 dark:text-gray-200">
            {displayName(dealerPlayerId, playerNames)}
          </span>
        </span>

        {(bidderPlayerId != null || phase === "BIDDING") && (
          <span className="text-gray-500 dark:text-gray-400">
            Bidder:{" "}
            {bidderPlayerId != null && bidAmount != null ? (
              <span className="font-medium text-gray-700 dark:text-gray-200">
                {displayName(bidderPlayerId, playerNames)} @ {BID_LABEL[bidAmount] ?? String(bidAmount)}
              </span>
            ) : (
              <span className="font-medium text-gray-400 dark:text-gray-500">(pending)</span>
            )}
          </span>
        )}
      </div>

      {/* Trump display */}
      {trump != null && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 dark:text-gray-400">Trump:</span>
          <span
            className={`font-semibold ${
              trump === "HEARTS" || trump === "DIAMONDS"
                ? "text-red-600 dark:text-red-400"
                : "text-gray-900 dark:text-gray-100"
            }`}
          >
            {SUIT_SYMBOL[trump]}
          </span>
        </div>
      )}
    </div>
  );
}
