"use client";

import { useCallback } from "react";
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
  /** Polling interval in ms. Default 3000. */
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
    enabled: !!playerId,
  });

  const started = game && isStartedGame(game) ? game : null;
  const completed = game && !isStartedGame(game) ? game : null;

  const myTurn = started?.active_player_id === playerId;

  const self = started?.players.find((p) => p.id === playerId && isSelf(p)) as
    | SelfInRound
    | undefined;

  const hand = self?.hand ?? [];

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
