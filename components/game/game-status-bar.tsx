"use client";

import type { GameStatus } from "@/lib/api/types";

interface GameStatusBarProps {
  phase: GameStatus;
  myTurn: boolean;
  isStale: boolean;
  activePlayerId?: string | null;
}

const phaseLabels: Record<GameStatus, string> = {
  BIDDING: "Bidding",
  TRUMP_SELECTION: "Selecting Trump",
  DISCARD: "Discarding",
  TRICKS: "Playing Tricks",
  WON: "Game Over",
};

export function GameStatusBar({
  phase,
  myTurn,
  isStale,
  activePlayerId,
}: GameStatusBarProps) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-gray-100 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-500">Phase</span>
        <span className="font-semibold">{phaseLabels[phase]}</span>
      </div>

      <div className="flex items-center gap-3">
        {phase !== "WON" && (
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              myTurn ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600"
            }`}
          >
            {myTurn
              ? "Your turn"
              : `Waiting for ${activePlayerId?.slice(0, 8) ?? "..."}`}
          </span>
        )}

        {isStale && (
          <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-700">
            Reconnecting...
          </span>
        )}
      </div>
    </div>
  );
}
