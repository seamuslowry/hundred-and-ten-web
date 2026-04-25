import { useState } from "react";
import type {
  SpikeCompletedRound,
  SpikeCompletedNoBiddersRound,
} from "@/lib/api/types";
import { CompletedRoundView } from "./completed-round-view";

interface RoundHistoryProps {
  completedRounds: (SpikeCompletedRound | SpikeCompletedNoBiddersRound)[];
  playerNames: Map<string, string>;
}

export function RoundHistory({
  completedRounds,
  playerNames,
}: RoundHistoryProps) {
  const [expandedSet, setExpandedSet] = useState<Set<number>>(new Set());

  if (completedRounds.length === 0) return null;

  function toggle(index: number) {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  // Render in reverse order (most recent first), but preserve original index for display
  const reversed = [...completedRounds]
    .map((round, originalIndex) => ({
      round,
      originalIndex,
    }))
    .reverse();

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700">
      <p className="border-b border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 dark:border-gray-700 dark:text-gray-300">
        Completed Rounds
      </p>
      {reversed.map(({ round, originalIndex }) => (
        <CompletedRoundView
          key={originalIndex}
          round={round}
          roundIndex={originalIndex}
          expanded={expandedSet.has(originalIndex)}
          onToggle={() => toggle(originalIndex)}
          playerNames={playerNames}
        />
      ))}
    </div>
  );
}
