"use client";

import { useState, useEffect } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { LobbyCard } from "@/components/lobby/lobby-card";
import { useAuth } from "@/lib/hooks/use-auth";
import { searchLobbies } from "@/lib/api/lobbies";
import type { Lobby } from "@/lib/api/types";
import Link from "next/link";

function LobbiesContent() {
  const { user } = useAuth();
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    async function fetchLobbies() {
      try {
        const results = await searchLobbies(user!.uid, {
          searchText: "",
          offset: 0,
          limit: 50,
        });
        setLobbies(results);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load lobbies");
      } finally {
        setLoading(false);
      }
    }

    fetchLobbies();
  }, [user]);

  // Sort: invites first, then rest
  const inviteLobbies = lobbies.filter((l) =>
    l.invitees.some((i) => i.id === user?.uid),
  );
  const otherLobbies = lobbies.filter(
    (l) => !l.invitees.some((i) => i.id === user?.uid),
  );

  return (
    <main className="mx-auto max-w-2xl p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lobbies</h1>
        <Link
          href="/lobbies/new"
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

      {loading && <p className="mt-4 text-gray-500">Loading lobbies...</p>}
      {error && <p className="mt-4 text-red-500">{error}</p>}

      {!loading && !error && (
        <div className="mt-4 space-y-2">
          {inviteLobbies.map((lobby) => (
            <LobbyCard key={lobby.id} lobby={lobby} isInvite />
          ))}
          {otherLobbies.map((lobby) => (
            <LobbyCard key={lobby.id} lobby={lobby} />
          ))}
          {lobbies.length === 0 && (
            <p className="text-gray-500">
              No lobbies yet. Create one to get started!
            </p>
          )}
        </div>
      )}
    </main>
  );
}

export default function LobbiesPage() {
  return (
    <RequireAuth>
      <LobbiesContent />
    </RequireAuth>
  );
}
