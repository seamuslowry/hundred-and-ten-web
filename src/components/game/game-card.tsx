import { Link } from "@tanstack/react-router";
import { isActiveRound } from "@/lib/api/types";
import type { Game } from "@/lib/api/types";

interface GameCardProps {
  game: Game;
  playerId: string;
}

export function GameCard({ game, playerId }: GameCardProps) {
  const isMyTurn =
    isActiveRound(game.active) && game.active.activePlayerId === playerId;

  return (
    <Link
      to="/games/$gameId"
      params={{ gameId: game.id }}
      className="block rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
      style={{ minHeight: 44 }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium dark:text-gray-100">{game.name}</h3>
        {isMyTurn && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900 dark:text-green-300">
            Your turn
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {game.players.length} player{game.players.length !== 1 ? "s" : ""}
      </p>
    </Link>
  );
}
