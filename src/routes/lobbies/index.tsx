import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { GameCard } from "@/components/game/game-card";
import { LobbyCard } from "@/components/lobby/lobby-card";
import { useAuth } from "@/lib/hooks/use-auth";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchLobbiesList } from "@/store/lobbies/thunks";
import { selectLobbyList } from "@/store/lobbies/selectors";
import { fetchGamesList } from "@/store/games/thunks";
import { selectGameList } from "@/store/games/selectors";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/lobbies/")({
  component: LobbiesPage,
});

function LobbiesContent() {
  const { user } = useAuth();
  const playerId = user?.uid ?? "";
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!playerId) return;
    dispatch(fetchLobbiesList({ playerId }));
    dispatch(fetchGamesList({ playerId }));
  }, [dispatch, playerId]);

  const games = useAppSelector((s) => selectGameList(s));
  const gamesLoading = useAppSelector((s) => s.games.listLoading);
  const gamesError = useAppSelector((s) => s.games.listError);

  const lobbies = useAppSelector((s) => selectLobbyList(s));
  const listLoading = useAppSelector((s) => s.lobbies.listLoading);
  const listError = useAppSelector((s) => s.lobbies.listError);

  // Sort: invites first, then rest
  const inviteLobbies = lobbies.filter((l) =>
    l.invitees.some((i) => i.id === playerId),
  );
  const otherLobbies = lobbies.filter(
    (l) => !l.invitees.some((i) => i.id === playerId),
  );

  // Loading guard: only show spinner before any data has landed.
  const showLoading = listLoading && lobbies.length === 0;
  const showGamesLoading = gamesLoading && games.length === 0;

  return (
    <main className="mx-auto max-w-2xl p-4">
      <section aria-labelledby="games-heading" className="mb-8">
        <h2
          id="games-heading"
          className="text-2xl font-bold dark:text-gray-100"
        >
          Your Games
        </h2>
        {showGamesLoading && (
          <p className="mt-4 text-gray-500 dark:text-gray-400">
            Loading games...
          </p>
        )}
        {gamesError && (
          <p className="mt-4 text-red-500 dark:text-red-400">{gamesError}</p>
        )}
        {!showGamesLoading && !gamesError && (
          <div className="mt-4 space-y-2">
            {games.map((game) => (
              <GameCard key={game.id} game={game} playerId={playerId} />
            ))}
            {games.length === 0 && (
              <p className="text-gray-500 dark:text-gray-400">
                No games in progress.
              </p>
            )}
          </div>
        )}
      </section>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-gray-100">Lobbies</h1>
        <Link
          to="/lobbies/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          style={{
            minHeight: 44,
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          New Lobby
        </Link>
      </div>

      {showLoading && (
        <p className="mt-4 text-gray-500 dark:text-gray-400">
          Loading lobbies...
        </p>
      )}
      {listError && (
        <p className="mt-4 text-red-500 dark:text-red-400">{listError}</p>
      )}

      {!showLoading && !listError && (
        <div className="mt-4 space-y-2">
          {inviteLobbies.map((lobby) => (
            <LobbyCard key={lobby.id} lobby={lobby} isInvite />
          ))}
          {otherLobbies.map((lobby) => (
            <LobbyCard key={lobby.id} lobby={lobby} />
          ))}
          {lobbies.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400">
              No lobbies yet. Create one to get started!
            </p>
          )}
        </div>
      )}
    </main>
  );
}

export function LobbiesPage() {
  return (
    <RequireAuth>
      <LobbiesContent />
    </RequireAuth>
  );
}
