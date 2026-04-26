import { useCallback, useState } from "react";
import { usePolling } from "./use-polling";
import { useAuth } from "./use-auth";
import { getGame } from "@/lib/api/games";
import type {
  Game,
  ActiveRound,
  ActiveGameState,
  CompletedRound,
  Card,
  PlayerInGame,
} from "@/lib/api/types";

interface UseGameStateOptions {
  gameId: string;
  /** Polling interval in ms when waiting for opponents. Default 3000. */
  interval?: number;
}

function isActiveRound(active: ActiveGameState): active is ActiveRound {
  return active.status !== "WON";
}

export function useGameState({ gameId, interval = 3000 }: UseGameStateOptions) {
  const { user } = useAuth();
  const playerId = user?.uid ?? "";

  // pollingEnabled is derived from game state. It starts true so the initial
  // fetch fires. We use the React-recommended "adjust state during render"
  // pattern: track the last game status key we processed and update
  // pollingEnabled synchronously when it changes, avoiding setState-in-effect.
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const [lastGameKey, setLastGameKey] = useState<string | null>(null);

  const fetcher = useCallback(() => {
    return getGame(playerId, gameId);
  }, [playerId, gameId]);

  const {
    data: game,
    loading,
    error,
    isStale,
    refetch,
  } = usePolling<Game>({
    fetcher,
    interval,
    enabled: !!playerId && pollingEnabled,
  });

  // Derive active round from game.active when it is an in-progress round
  const activeRound: ActiveRound | null =
    game && isActiveRound(game.active) ? game.active : null;

  // Derive completed rounds directly from game.completed_rounds
  const completedRounds: CompletedRound[] = game?.completed_rounds ?? [];

  // Derive hand from activeRound.hands[playerId]; fall back to [] when missing
  // or when the value is a number (opponent hand size, not card array)
  const rawHand = activeRound?.hands[playerId];
  const hand: Card[] = Array.isArray(rawHand) ? rawHand : [];

  // Derive turn / completion. A game is complete when active status is WON.
  const myTurn = activeRound?.active_player_id === playerId;
  const isCompleted = !!game && game.active.status === "WON";
  const winner: PlayerInGame | null =
    game && !isActiveRound(game.active)
      ? { id: game.active.winner_player_id, type: "human" }
      : null;

  // Derive phase from active round status, or null when no active round
  const phase: ActiveRound["status"] | null = activeRound?.status ?? null;

  // Key that captures the polling-relevant state: active round status + active player
  const currentKey = `${activeRound?.status ?? "none"}:${activeRound?.active_player_id ?? ""}:${isCompleted}`;
  if (currentKey !== lastGameKey) {
    setLastGameKey(currentKey);
    setPollingEnabled(!myTurn && !isCompleted);
  }

  return {
    game,
    activeRound,
    completedRounds,
    isCompleted,
    winner,
    loading,
    error,
    isStale,
    refetch,
    myTurn,
    hand,
    playerId,
    phase,
  };
}
