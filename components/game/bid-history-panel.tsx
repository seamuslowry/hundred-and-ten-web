
import type { SpikeBid } from "@/lib/api/types";

interface BidHistoryPanelProps {
  bidHistory: SpikeBid[];
  playerNames: Map<string, string>;
}

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

export function BidHistoryPanel({ bidHistory, playerNames }: BidHistoryPanelProps) {
  if (bidHistory.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Bid History
      </p>
      <ul className="flex flex-col gap-1">
        {bidHistory.map((bid, i) => (
          <li key={i} className="text-sm text-gray-700 dark:text-gray-200">
            <span className="font-medium">{displayName(bid.player_id, playerNames)}</span>
            {": "}
            <span>{BID_LABEL[bid.amount] ?? String(bid.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
