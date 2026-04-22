
import { RequireAuth } from "@/components/auth/require-auth";
import { GameBoard } from "@/components/game/game-board";
import { ScoreBoard } from "@/components/game/score-board";
import { useGameState } from "@/lib/hooks/use-game-state";
import { useParams, Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";

function GameContent() {
  const { gameId } = useParams({ from: "/games/$gameId" });
  const {
    started,
    completed,
    loading,
    error,
    isStale,
    myTurn,
    hand,
    playerId,
    phase,
    refetch,
  } = useGameState({ gameId, interval: 30000 });

  const [isRefreshing, setIsRefreshing] = useState(false);

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

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl p-4">
        <p className="text-gray-500">Loading game...</p>
      </main>
    );
  }

  if (error && !started && !completed) {
    return (
      <main className="mx-auto max-w-2xl p-4">
        <p className="text-red-600">Failed to load game: {error.message}</p>
      </main>
    );
  }

  if (!phase) {
    return (
      <main className="mx-auto max-w-2xl p-4">
        <p className="text-gray-500">Game not found.</p>
      </main>
    );
  }

  const scores = started?.scores ?? completed?.scores ?? {};

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
      <div className="lg:grid lg:grid-cols-[1fr_280px] lg:gap-6">
        <GameBoard
          started={started}
          completed={completed}
          hand={hand}
          myTurn={myTurn}
          isStale={isStale}
          playerId={playerId}
          onActionComplete={refetch}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
        <aside className="hidden lg:flex lg:flex-col lg:gap-4">
          <ScoreBoard scores={scores} currentPlayerId={playerId} />
        </aside>
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
