import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/auth/require-auth";
import { GameBoard } from "@/components/game/game-board";
import { ScoreBoard } from "@/components/game/score-board";
import { RoundHistory } from "@/components/game/round-history";
import { useGamePolling } from "@/lib/hooks/use-game-polling";
import { useAuth } from "@/lib/hooks/use-auth";
import { useAppSelector } from "@/store/hooks";
import {
  selectGameById,
  selectActiveRound,
  selectCompletedRounds,
  selectMyTurn,
  selectMyHand,
} from "@/store/games/selectors";
import { isWonGame } from "@/lib/api/types";
import { getGamePlayers } from "@/lib/api/games";
import { useParams, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

export const Route = createFileRoute("/games/$gameId")({
  component: GamePage,
});

function GameContent() {
  const { gameId } = useParams({ from: "/games/$gameId" });
  const { user } = useAuth();
  const playerId = user?.uid ?? "";

  // Polling controller
  const { refetch } = useGamePolling({ gameId, interval: 3000 });

  // Game state from selectors
  const game = useAppSelector((s) => selectGameById(s, gameId));
  const activeRound = useAppSelector((s) => selectActiveRound(s, gameId));
  const completedRounds = useAppSelector((s) =>
    selectCompletedRounds(s, gameId),
  );
  const myTurn = useAppSelector((s) => selectMyTurn(s, gameId, playerId));
  const hand = useAppSelector((s) => selectMyHand(s, gameId, playerId));

  // Inline single-consumer derivations (NOT exported selectors):
  const loading = useAppSelector((s) => s.games.loading[gameId] ?? false);
  const errorMsg = useAppSelector((s) => s.games.errors[gameId] ?? null);
  const isCompleted = game?.active.status === "WON";
  const winner =
    game && isWonGame(game.active)
      ? { id: game.active.winnerPlayerId, type: "human" as const }
      : null;
  const phase = activeRound?.status ?? null;
  const isStale = errorMsg !== null && game !== undefined;

  // Keep these as local useState:
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [playerNames, setPlayerNames] = useState<Map<string, string>>(
    new Map(),
  );

  useEffect(() => {
    if (!playerId || !gameId) return;
    getGamePlayers(playerId, gameId)
      .then((players) => {
        setPlayerNames(new Map(players.map((p) => [p.id, p.name])));
      })
      .catch(() => {
        // Fall back to truncated IDs (playerNames stays empty Map)
      });
  }, [playerId, gameId]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } catch {
      // error display deferred; isRefreshing resets via finally
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  if (loading && !game) {
    return (
      <main className="mx-auto max-w-2xl p-4">
        <p className="text-gray-500">Loading game...</p>
      </main>
    );
  }

  if (errorMsg && !game) {
    return (
      <main className="mx-auto max-w-2xl p-4">
        <p className="text-red-600">Failed to load game: {errorMsg}</p>
      </main>
    );
  }

  if (!phase && !isCompleted) {
    return (
      <main className="mx-auto max-w-2xl p-4">
        <p className="text-gray-500">Game not found.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl p-4 md:max-w-4xl lg:max-w-6xl">
      <Link
        to="/lobbies"
        className="mb-3 inline-flex min-h-[44px] items-center text-sm text-blue-600 hover:underline"
      >
        &larr; Back to lobbies
      </Link>
      <h1 className="mb-4 text-2xl font-bold dark:text-gray-100">
        Game {gameId.slice(0, 8)}
      </h1>
      <div className="flex flex-col gap-4">
        <ScoreBoard
          scores={game?.scores ?? {}}
          currentPlayerId={playerId}
          playerNames={playerNames}
        />
        <GameBoard
          gameId={gameId}
          activeRound={activeRound}
          isCompleted={isCompleted}
          winner={winner}
          hand={hand}
          scores={game?.scores ?? {}}
          playerNames={playerNames}
          myTurn={myTurn}
          isStale={isStale}
          playerId={playerId}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
        <RoundHistory
          completedRounds={completedRounds}
          playerNames={playerNames}
        />
      </div>
    </main>
  );
}

export function GamePage() {
  return (
    <RequireAuth>
      <GameContent />
    </RequireAuth>
  );
}
