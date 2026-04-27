import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/auth/require-auth";
import { MemberList } from "@/components/lobby/member-list";
import { PlayerSearch } from "@/components/lobby/player-search";
import { useAuth } from "@/lib/hooks/use-auth";
import { useGamePolling } from "@/lib/hooks/use-game-polling";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchLobby, joinLobby, startGame } from "@/store/lobbies/thunks";
import { selectLobbyById } from "@/store/lobbies/selectors";
import { selectGameById } from "@/store/games/selectors";
import { selectPlayersByIds } from "@/store/players/selectors";

export const Route = createFileRoute("/lobbies/$lobbyId")({
  component: LobbyDetail,
});

function LobbyDetailContent() {
  const { lobbyId } = useParams({ from: "/lobbies/$lobbyId" });
  const { user } = useAuth();
  const playerId = user?.uid ?? "";
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Mount-time fetch
  useEffect(() => {
    if (!playerId) return;
    dispatch(fetchLobby({ playerId, lobbyId }));
  }, [dispatch, playerId, lobbyId]);

  // Polling for game start (reuses PR 1's hook directly with gameId: lobbyId)
  useGamePolling({ gameId: lobbyId, interval: 5000 });

  // Lobby data from selector
  const lobby = useAppSelector((s) => selectLobbyById(s, lobbyId));

  // Game data from games slice — this is the navigation signal
  const game = useAppSelector((s) => selectGameById(s, lobbyId));

  // Player IDs — memoized to keep selectPlayersByIds size-1 cache stable
  const playerIds = useMemo(
    () =>
      lobby
        ? [...lobby.invitees, ...lobby.players, lobby.organizer].map(
            (p) => p.id,
          )
        : [],
    [lobby],
  );
  const players = useAppSelector((s) => selectPlayersByIds(s, playerIds));
  const playerDetails = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players],
  );

  // Inline single-consumer derivations from lobbies slice
  const loading = useAppSelector((s) => s.lobbies.loading[lobbyId] ?? false);
  const error = useAppSelector((s) => s.lobbies.errors[lobbyId] ?? null);
  const actionInFlight = useAppSelector(
    (s) => s.lobbies.actionInFlight[lobbyId] ?? false,
  );

  // Local action error (per PR 1's error channel separation)
  const [actionError, setActionError] = useState<string | null>(null);

  // Single navigation signal — when game appears, navigate
  useEffect(() => {
    if (game) {
      navigate({ to: "/games/$gameId", params: { gameId: lobbyId } });
    }
  }, [game, lobbyId, navigate]);

  // Re-fetch lobby after PlayerSearch invites
  const handleInvited = useCallback(() => {
    if (!playerId) return;
    dispatch(fetchLobby({ playerId, lobbyId }));
  }, [dispatch, playerId, lobbyId]);

  const isOrganizer = lobby?.organizer.id === playerId;
  const isMember = isOrganizer || lobby?.players.some((p) => p.id === playerId);
  const isInvitee = lobby?.invitees.some((p) => p.id === playerId);

  async function handleJoin() {
    if (!playerId) return;
    setActionError(null);
    try {
      await dispatch(joinLobby({ playerId, lobbyId })).unwrap();
    } catch (e) {
      if (
        e != null &&
        typeof e === "object" &&
        (e as { name?: string }).name === "ConditionError"
      ) {
        return;
      }
      setActionError(
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : "Failed to join lobby",
      );
    }
  }

  async function handleStart() {
    if (!playerId) return;
    setActionError(null);
    try {
      await dispatch(startGame({ playerId, lobbyId })).unwrap();
      // No explicit navigate — startGame's internal fetchGame will populate
      // the games slice, triggering the navigation useEffect above.
    } catch (e) {
      if (
        e != null &&
        typeof e === "object" &&
        (e as { name?: string }).name === "ConditionError"
      ) {
        return;
      }
      setActionError(
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : "Failed to start game",
      );
    }
  }

  // Loading guard: only on initial render before data lands
  if (loading && !lobby) {
    return (
      <main className="mx-auto max-w-md p-4">
        <p className="text-gray-500">Loading lobby...</p>
      </main>
    );
  }

  if (error && !lobby) {
    return (
      <main className="mx-auto max-w-md p-4">
        <p className="text-red-500">{error}</p>
      </main>
    );
  }

  if (!lobby) {
    return (
      <main className="mx-auto max-w-md p-4">
        <p className="text-red-500">Lobby not found</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-4">
      <Link
        to="/lobbies"
        className="mb-3 inline-flex min-h-[44px] items-center text-sm text-blue-600 hover:underline"
      >
        &larr; Back to lobbies
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-gray-100">{lobby.name}</h1>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {lobby.accessibility === "PUBLIC" ? "Public" : "Private"}
        </span>
      </div>

      <div className="mt-4">
        <MemberList
          organizer={lobby.organizer}
          players={lobby.players}
          invitees={lobby.invitees}
          playerDetails={playerDetails}
        />
      </div>

      {!isMember && (isInvitee || lobby.accessibility === "PUBLIC") && (
        <button
          onClick={handleJoin}
          disabled={actionInFlight}
          className="mt-4 w-full rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-50"
          style={{ minHeight: 44 }}
        >
          {actionInFlight ? "Joining..." : "Join Lobby"}
        </button>
      )}

      {isOrganizer && (
        <div className="mt-6 space-y-4">
          <PlayerSearch lobbyId={lobbyId} onInvited={handleInvited} />

          <button
            onClick={handleStart}
            disabled={actionInFlight}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            style={{ minHeight: 44 }}
          >
            {actionInFlight ? "Starting..." : "Start Game"}
          </button>
        </div>
      )}

      {actionError && (
        <p className="mt-2 text-sm text-red-500 dark:text-red-400">
          {actionError}
        </p>
      )}
    </main>
  );
}

export function LobbyDetail() {
  return (
    <RequireAuth>
      <LobbyDetailContent />
    </RequireAuth>
  );
}
