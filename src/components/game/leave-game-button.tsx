import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { leaveGame } from "@/store/games/thunks";
import {
  isConditionError,
  messageFromRejection,
} from "@/lib/redux/condition-error";

interface LeaveGameButtonProps {
  gameId: string;
  playerId: string;
}

/**
 * Two-step "Leave game" control. The first tap reveals an inline confirmation
 * (no window.confirm — it's unreliable on mobile and untestable). Confirming
 * dispatches the leaveGame thunk and navigates back to the lobby list.
 * The backend replaces the departed player with a CPU so the game continues.
 */
export function LeaveGameButton({ gameId, playerId }: LeaveGameButtonProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const inFlight = useAppSelector(
    (s) => s.games.leaveInFlight[gameId] ?? false,
  );
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    try {
      await dispatch(leaveGame({ playerId, gameId })).unwrap();
    } catch (e) {
      if (isConditionError(e)) return; // duplicate call, ignore
      setError(messageFromRejection(e, "Unknown error"));
      return;
    }
    navigate({ to: "/lobbies" });
  };

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex min-h-[44px] items-center text-sm text-red-600 hover:underline dark:text-red-400"
      >
        Leave game
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Confirm leave game"
      className="flex flex-wrap items-center gap-2 text-sm"
    >
      <span className="text-gray-700 dark:text-gray-300">
        Leave this game? A CPU will take your seat.
      </span>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={inFlight}
        className="inline-flex min-h-[44px] items-center rounded bg-red-600 px-3 font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {inFlight ? "Leaving..." : "Yes, leave"}
      </button>
      <button
        type="button"
        onClick={() => {
          setConfirming(false);
          setError(null);
        }}
        disabled={inFlight}
        className="inline-flex min-h-[44px] items-center rounded border border-gray-300 px-3 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
      >
        Cancel
      </button>
      {error && (
        <p role="alert" className="w-full text-red-600 dark:text-red-400">
          Failed to leave game: {error}
        </p>
      )}
    </div>
  );
}
