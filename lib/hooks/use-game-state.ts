
import { useCallback, useState } from "react";
import { usePolling } from "./use-polling";
import { useAuth } from "./use-auth";
import { getGame } from "@/lib/api/games";
import type {
  StartedGame,
  CompletedGame,
  SelfInRound,
  OtherPlayerInRound,
} from "@/lib/api/types";

interface UseGameStateOptions {
  gameId: string;
  /** Polling interval in ms when waiting for opponents. Default 3000. */
  interval?: number;
}

function isStartedGame(game: StartedGame | CompletedGame): game is StartedGame {
  return game.status !== "WON";
}

function isSelf(
  player: SelfInRound | OtherPlayerInRound,
): player is SelfInRound {
  return "hand" in player;
}

export function useGameState({ gameId, interval = 3000 }: UseGameStateOptions) {
  const { user } = useAuth();
  const playerId = user?.uid ?? "";

  // pollingEnabled is derived from game state. It starts true so the initial
  // fetch fires. We use the React-recommended "adjust state during render"
  // pattern: track the last game status we processed and update pollingEnabled
  // synchronously when it changes, avoiding setState-in-effect.
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const [lastGameStatus, setLastGameStatus] = useState<string | null>(null);

  const fetcher = useCallback(() => {
    return getGame(playerId, gameId);
  }, [playerId, gameId]);

  const {
    data: game,
    loading,
    error,
    isStale,
    refetch,
  } = usePolling({
    fetcher,
    interval,
    enabled: !!playerId && pollingEnabled,
  });

  const started = game && isStartedGame(game) ? game : null;
  const completed = game?.status === "WON" ? (game as CompletedGame) : null;
  const myTurn = started?.active_player_id === playerId;

  // Derive a key that captures whether polling should be active.
  const currentKey = `${game?.status ?? "none"}:${started?.active_player_id ?? ""}`;
  if (currentKey !== lastGameStatus) {
    setLastGameStatus(currentKey);
    setPollingEnabled(!myTurn && completed === null);
  }

  const selfPlayer = started?.players.find(
    (p): p is SelfInRound => p.id === playerId && isSelf(p),
  );

  const hand = selfPlayer?.hand ?? [];

  return {
    game,
    started,
    completed,
    loading,
    error,
    isStale,
    refetch,
    myTurn,
    hand,
    playerId,
    phase: started?.status ?? (completed ? "WON" : null),
  };
}
