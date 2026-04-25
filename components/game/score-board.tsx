interface ScoreBoardProps {
  scores: Record<string, number>;
  currentPlayerId: string;
  playerNames?: Map<string, string>;
}

export function ScoreBoard({
  scores,
  currentPlayerId,
  playerNames,
}: ScoreBoardProps) {
  const entries = Object.entries(scores).sort(([, a], [, b]) => b - a);

  if (entries.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <h3 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
        Scores
      </h3>
      <div className="flex flex-col gap-1">
        {entries.map(([playerId, score]) => (
          <div
            key={playerId}
            className={`flex items-center justify-between rounded px-3 py-2 ${
              playerId === currentPlayerId
                ? "bg-blue-50 font-semibold dark:bg-blue-900"
                : "dark:text-gray-200"
            }`}
          >
            <span className="text-sm">
              {playerNames
                ? (playerNames.get(playerId) ?? playerId.slice(0, 8))
                : playerId.slice(0, 8)}
              {playerId === currentPlayerId && " (you)"}
            </span>
            <span className="font-mono">{score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
