import { useCallback } from "react";
import { usePolling } from "./use-polling";
import { useAuth } from "./use-auth";
import { getSpikeGame } from "@/lib/api/games";
import { ApiError } from "@/lib/api/client";

interface UseLobbyGameStartOptions {
  lobbyId: string;
  /** Polling interval in ms. Default 5000. */
  interval?: number;
}

interface GameStartResult {
  started: boolean;
}

const DEFAULT_INTERVAL = 5000;

export function useLobbyGameStart({
  lobbyId,
  interval = DEFAULT_INTERVAL,
}: UseLobbyGameStartOptions) {
  const { user } = useAuth();
  const playerId = user?.uid ?? "";

  const fetcher = useCallback(async (): Promise<GameStartResult> => {
    try {
      await getSpikeGame(playerId, lobbyId);
      return { started: true };
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        return { started: false };
      }
      throw e;
    }
  }, [playerId, lobbyId]);

  const { data, error } = usePolling<GameStartResult>({
    fetcher,
    interval,
    enabled: !!playerId,
  });

  const gameStarted = data?.started ?? false;

  return { gameStarted, error };
}
