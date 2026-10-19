import type { PlayerInGame } from "@/lib/api/types";

interface ScoreBoardProps {
  /** Players in seat order around the table. */
  players: PlayerInGame[];
  scores: Record<string, number>;
  currentPlayerId: string;
  playerNames?: Map<string, string>;
}

export function ScoreBoard({
  players,
  scores,
  currentPlayerId,
  playerNames,
}: ScoreBoardProps) {
  if (players.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <h3 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
        Scores
      </h3>
      <table className="w-full table-fixed text-center">
        <thead>
          <tr>
            {players.map(({ id }) => (
              <th
                key={id}
                scope="col"
                className={`truncate rounded-t px-2 py-2 text-sm font-medium ${
                  id === currentPlayerId
                    ? "bg-blue-50 font-semibold dark:bg-blue-900"
                    : "dark:text-gray-200"
                }`}
              >
                {playerNames?.get(id) ?? id.slice(0, 8)}
                {id === currentPlayerId && " (you)"}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {players.map(({ id }) => (
              <td
                key={id}
                className={`rounded-b px-2 py-2 font-mono ${
                  id === currentPlayerId
                    ? "bg-blue-50 font-semibold dark:bg-blue-900"
                    : "dark:text-gray-200"
                }`}
              >
                {scores[id] ?? 0}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
