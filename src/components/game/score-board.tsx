import type { PlayerInGame } from "@/lib/api/types";

interface ScoreBoardProps {
  /** Players in seat order around the table. */
  players: PlayerInGame[];
  scores: Record<string, number>;
  currentPlayerId: string;
  playerNames?: Map<string, string>;
}

const highlight = "bg-blue-50 font-semibold dark:bg-blue-900";
const plain = "dark:text-gray-200";

export function ScoreBoard({
  players,
  scores,
  currentPlayerId,
  playerNames,
}: ScoreBoardProps) {
  if (players.length === 0) return null;

  // Mobile: two columns (name, score), one row per player.
  // sm and up: one column per player, names on top and scores beneath.
  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <h3 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
        Scores
      </h3>
      <dl className="grid grid-cols-[1fr_auto] gap-y-1 sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none sm:grid-rows-2 sm:gap-y-0 sm:text-center">
        {players.map(({ id }) => {
          const tone = id === currentPlayerId ? highlight : plain;
          return [
            <dt
              key={`${id}-name`}
              className={`rounded-l px-2 py-2 text-sm font-medium break-words sm:rounded-l-none sm:rounded-t ${tone}`}
            >
              {playerNames?.get(id) ?? id.slice(0, 8)}
              {id === currentPlayerId && " (you)"}
            </dt>,
            <dd
              key={`${id}-score`}
              className={`rounded-r px-2 py-2 font-mono sm:rounded-r-none sm:rounded-b ${tone}`}
            >
              {scores[id] ?? 0}
            </dd>,
          ];
        })}
      </dl>
    </div>
  );
}
