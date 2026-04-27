import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { searchPlayersThunk, invitePlayer } from "@/store/lobbies/thunks";
import { selectPlayersByIds } from "@/store/players/selectors";
import { isConditionError } from "@/lib/redux/condition-error";

interface PlayerSearchProps {
  lobbyId: string;
  onInvited: () => void;
}

export function PlayerSearch({ lobbyId, onInvited }: PlayerSearchProps) {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const [query, setQuery] = useState("");
  const [resultIds, setResultIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);

  // resultIds reference is stable via useState; selectPlayersByIds' size-1
  // cache works because setResultIds is the only writer (new array per search).
  const results = useAppSelector((s) => selectPlayersByIds(s, resultIds));

  const search = useCallback(async () => {
    if (!user || query.length < 2) {
      setResultIds([]);
      return;
    }
    setLoading(true);
    try {
      const ids = await dispatch(
        searchPlayersThunk({ playerId: user.uid, searchText: query }),
      ).unwrap();
      setResultIds(ids);
    } catch {
      setResultIds([]);
    } finally {
      setLoading(false);
    }
  }, [user, query, dispatch]);

  useEffect(() => {
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [search]);

  async function handleInvite(targetPlayerId: string) {
    if (!user) return;
    setInviting(targetPlayerId);
    try {
      await dispatch(
        invitePlayer({
          playerId: user.uid,
          lobbyId,
          inviteeId: targetPlayerId,
        }),
      ).unwrap();
      onInvited();
      setResultIds((prev) => prev.filter((id) => id !== targetPlayerId));
    } catch (e) {
      if (isConditionError(e)) return;
      // error handled by caller via existing pattern
    } finally {
      setInviting(null);
    }
  }

  return (
    <div>
      <input
        type="text"
        placeholder="Search players to invite..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
        style={{ minHeight: 44 }}
      />
      {loading && (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Searching...
        </p>
      )}
      {results.length > 0 && (
        <ul className="mt-2 space-y-1">
          {results.map((player) => (
            <li
              key={player.id}
              className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-700"
            >
              <span className="text-sm dark:text-gray-200">{player.name}</span>
              <button
                onClick={() => handleInvite(player.id)}
                disabled={inviting === player.id}
                className="rounded-md bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                style={{ minHeight: 44 }}
              >
                {inviting === player.id ? "Inviting..." : "Invite"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
