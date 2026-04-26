import { useCallback } from "react";
import { usePolling } from "./use-polling";
import { useAuth } from "./use-auth";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { selectMyTurn } from "@/store/games/selectors";
import { fetchGame } from "@/store/games/thunks";

interface UseGamePollingOptions {
  gameId: string;
  /** Polling interval in ms. Default 3000. */
  interval?: number;
}

interface UseGamePollingResult {
  refetch: () => Promise<void>;
}

export function useGamePolling({
  gameId,
  interval = 3000,
}: UseGamePollingOptions): UseGamePollingResult {
  const { user } = useAuth();
  const playerId = user?.uid ?? "";

  const myTurn = useAppSelector((s) => selectMyTurn(s, gameId, playerId));
  const isCompleted = useAppSelector(
    (s) => s.games.byId[gameId]?.active.status === "WON",
  );
  const dispatch = useAppDispatch();

  const fetcher = useCallback(
    () => dispatch(fetchGame({ playerId, gameId })).unwrap(),
    [dispatch, playerId, gameId],
  );

  const { refetch } = usePolling({
    fetcher,
    interval,
    enabled: !!playerId && !myTurn && !isCompleted,
  });

  return { refetch };
}
