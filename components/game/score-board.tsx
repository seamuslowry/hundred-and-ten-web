interface ScoreBoardProps {
  scores: Record<string, number>;
  currentPlayerId: string;
}

export function ScoreBoard({ scores, currentPlayerId }: ScoreBoardProps) {
  const entries = Object.entries(scores).sort(([, a], [, b]) => b - a);

  if (entries.length === 0) return null;

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium text-gray-500">Scores</h3>
      <div className="flex flex-col gap-1">
        {entries.map(([playerId, score]) => (
          <div
            key={playerId}
            className={`flex items-center justify-between rounded px-3 py-2 ${
              playerId === currentPlayerId ? "bg-blue-50 font-semibold" : ""
            }`}
          >
            <span className="text-sm">
              {playerId.slice(0, 8)}
              {playerId === currentPlayerId && " (you)"}
            </span>
            <span className="font-mono">{score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
