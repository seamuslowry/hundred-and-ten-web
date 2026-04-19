"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { RequireAuth } from "@/components/auth/require-auth";
import { MemberList } from "@/components/lobby/member-list";
import { PlayerSearch } from "@/components/lobby/player-search";
import { useAuth } from "@/lib/hooks/use-auth";
import Link from "next/link";
import {
  getLobby,
  getLobbyPlayers,
  joinLobby,
  startGame,
} from "@/lib/api/lobbies";
import type { WaitingGame, Player } from "@/lib/api/types";

function LobbyDetailContent() {
  const { lobbyId } = useParams<{ lobbyId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [lobby, setLobby] = useState<WaitingGame | null>(null);
  const [playerDetails, setPlayerDetails] = useState<Map<string, Player>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchLobby = useCallback(async () => {
    if (!user) return;
    try {
      const [lobbyData, players] = await Promise.all([
        getLobby(user.uid, lobbyId),
        getLobbyPlayers(user.uid, lobbyId),
      ]);
      setLobby(lobbyData);
      setPlayerDetails(new Map(players.map((p) => [p.id, p])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load lobby");
    } finally {
      setLoading(false);
    }
  }, [user, lobbyId]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      try {
        const [lobbyData, players] = await Promise.all([
          getLobby(user!.uid, lobbyId),
          getLobbyPlayers(user!.uid, lobbyId),
        ]);
        if (cancelled) return;
        setLobby(lobbyData);
        setPlayerDetails(new Map(players.map((p) => [p.id, p])));
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load lobby");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, lobbyId]);

  const isOrganizer = lobby?.organizer.id === user?.uid;
  const isMember =
    isOrganizer || lobby?.players.some((p) => p.id === user?.uid);
  const isInvitee = lobby?.invitees.some((p) => p.id === user?.uid);

  async function handleJoin() {
    if (!user) return;
    setActionLoading(true);
    try {
      await joinLobby(user.uid, lobbyId);
      await fetchLobby();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join lobby");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStart() {
    if (!user) return;
    setActionLoading(true);
    try {
      await startGame(user.uid, lobbyId);
      router.push(`/games/${lobbyId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start game");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-md p-4">
        <p className="text-gray-500">Loading lobby...</p>
      </main>
    );
  }

  if (error || !lobby) {
    return (
      <main className="mx-auto max-w-md p-4">
        <p className="text-red-500">{error || "Lobby not found"}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-4">
      <Link
        href="/lobbies"
        className="mb-3 inline-flex min-h-[44px] items-center text-sm text-blue-600 hover:underline"
      >
        &larr; Back to lobbies
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{lobby.name}</h1>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
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
          disabled={actionLoading}
          className="mt-4 w-full rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-50"
          style={{ minHeight: 44 }}
        >
          {actionLoading ? "Joining..." : "Join Lobby"}
        </button>
      )}

      {isOrganizer && (
        <div className="mt-6 space-y-4">
          <PlayerSearch lobbyId={lobbyId} onInvited={fetchLobby} />

          <button
            onClick={handleStart}
            disabled={actionLoading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            style={{ minHeight: 44 }}
          >
            {actionLoading ? "Starting..." : "Start Game"}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
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
