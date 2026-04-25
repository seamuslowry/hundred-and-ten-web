import type { SpikeDiscard } from "@/lib/api/types";
import { Card } from "./card";

interface DiscardAreaProps {
  discards: Record<string, SpikeDiscard | number>;
  playerId: string;
  playerNames: Map<string, string>;
}

function displayName(id: string, playerNames: Map<string, string>): string {
  return playerNames.get(id) ?? id.slice(0, 8);
}

export function DiscardArea({
  discards,
  playerId,
  playerNames,
}: DiscardAreaProps) {
  const entries = Object.entries(discards);
  if (entries.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Discards
      </p>
      <div className="flex flex-col gap-2">
        {entries.map(([pid, value]) => {
          if (pid === playerId && typeof value === "object") {
            return (
              <div key={pid} className="flex flex-col gap-2">
                <div>
                  <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                    Your discards
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {value.discarded.map((card, i) => (
                      <Card key={i} card={card} disabled />
                    ))}
                  </div>
                </div>
                {value.received.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                      Received
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {value.received.map((card, i) => (
                        <Card key={i} card={card} disabled />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          const count =
            typeof value === "number" ? value : value.discarded.length;
          return (
            <p key={pid} className="text-sm text-gray-700 dark:text-gray-200">
              <span className="font-medium">
                {displayName(pid, playerNames)}
              </span>
              {`: ${count} card${count !== 1 ? "s" : ""}`}
            </p>
          );
        })}
      </div>
    </div>
  );
}
