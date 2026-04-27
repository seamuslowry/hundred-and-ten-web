import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { LobbyCard } from "@/components/lobby/lobby-card";
import { useAuth } from "@/lib/hooks/use-auth";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchLobbiesList } from "@/store/lobbies/thunks";
import { selectLobbyList } from "@/store/lobbies/selectors";
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
  }, [dispatch, playerId]);

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

  return (
    <main className="mx-auto max-w-2xl p-4">
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

function LobbiesPage() {
  return (
    <RequireAuth>
      <LobbiesContent />
    </RequireAuth>
  );
}
