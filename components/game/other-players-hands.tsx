import type { Card as CardType } from "@/lib/api/types";

interface OtherPlayersHandsProps {
  hands: Record<string, CardType[] | number>;
  playerId: string;
  playerNames: Map<string, string>;
}

function displayName(id: string, playerNames: Map<string, string>): string {
  return playerNames.get(id) ?? id.slice(0, 8);
}

export function OtherPlayersHands({
  hands,
  playerId,
  playerNames,
}: OtherPlayersHandsProps) {
  const others = Object.entries(hands).filter(([pid]) => pid !== playerId);

  if (others.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Other Players
      </p>
      <ul className="flex flex-col gap-1">
        {others.map(([pid, value]) => {
          const count = Array.isArray(value) ? value.length : value;
          return (
            <li key={pid} className="text-sm text-gray-700 dark:text-gray-200">
              <span className="font-medium">
                {displayName(pid, playerNames)}
              </span>
              {`: ${count} card${count !== 1 ? "s" : ""}`}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
