import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { leaveGame } from "@/store/games/thunks";
import {
  isConditionError,
  messageFromRejection,
} from "@/lib/redux/condition-error";

interface LeaveGameButtonProps {
  gameId: string;
  playerId: string;
  /** Called after the backend confirms the player has left. */
  onLeft: () => void;
}

const CONFIRM_TIMEOUT_MS = 3000;

/**
 * Two-step "Leave game" button. The first tap turns it red and changes its
 * text to ask for confirmation; tapping again within 3 seconds leaves. If not
 * confirmed in time it reverts, which counts as a "no". On success `onLeft`
 * is called and the player stays on the game view to watch how it ends. The
 * backend replaces the departed player with a CPU so the game continues.
 */
export function LeaveGameButton({
  gameId,
  playerId,
  onLeft,
}: LeaveGameButtonProps) {
  const dispatch = useAppDispatch();
  const inFlight = useAppSelector(
    (s) => s.games.leaveInFlight[gameId] ?? false,
  );
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!confirming || inFlight) return;
    const timer = setTimeout(() => setConfirming(false), CONFIRM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [confirming, inFlight]);

  const handleConfirm = async () => {
    setError(null);
    try {
      await dispatch(leaveGame({ playerId, gameId })).unwrap();
    } catch (e) {
      setConfirming(false);
      if (isConditionError(e)) return; // duplicate call, ignore
      setError(messageFromRejection(e, "Unknown error"));
      return;
    }
    onLeft();
  };

  const handleClick = () => {
    if (confirming) {
      void handleConfirm();
    } else {
      setError(null);
      setConfirming(true);
    }
  };

  const labels = ["Leave game", "Are you sure?", "Leaving..."];
  const current = inFlight
    ? "Leaving..."
    : confirming
      ? "Are you sure?"
      : "Leave game";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={inFlight}
        className={`min-h-[44px] rounded-lg px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
          confirming
            ? "bg-red-600 text-white hover:bg-red-700"
            : "bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
        }`}
      >
        {/* Stack every label in one grid cell so the button keeps the width of
            the longest one; the inactive labels are hidden, not removed. */}
        <span className="grid">
          {labels.map((label) => (
            <span
              key={label}
              aria-hidden={label !== current}
              className={`col-start-1 row-start-1 ${label === current ? "" : "invisible"}`}
            >
              {label}
            </span>
          ))}
        </span>
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Failed to leave game: {error}
        </p>
      )}
    </div>
  );
}
