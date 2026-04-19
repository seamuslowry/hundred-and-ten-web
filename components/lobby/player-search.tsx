"use client";

import { useState, useEffect, useCallback } from "react";
import { searchPlayers } from "@/lib/api/players";
import { invitePlayer } from "@/lib/api/lobbies";
import type { Player } from "@/lib/api/types";
import { useAuth } from "@/lib/hooks/use-auth";

interface PlayerSearchProps {
  lobbyId: string;
  onInvited: () => void;
}

export function PlayerSearch({ lobbyId, onInvited }: PlayerSearchProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);

  const search = useCallback(async () => {
    if (!user || query.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const players = await searchPlayers(user.uid, {
        searchText: query,
        offset: 0,
        limit: 10,
      });
      setResults(players);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [user, query]);

  useEffect(() => {
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [search]);

  async function handleInvite(playerId: string) {
    if (!user) return;
    setInviting(playerId);
    try {
      await invitePlayer(user.uid, lobbyId, playerId);
      onInvited();
      setResults((prev) => prev.filter((p) => p.id !== playerId));
    } catch {
      // error handled by API client
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
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        style={{ minHeight: 44 }}
      />
      {loading && <p className="mt-2 text-sm text-gray-500">Searching...</p>}
      {results.length > 0 && (
        <ul className="mt-2 space-y-1">
          {results.map((player) => (
            <li
              key={player.id}
              className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
            >
              <span className="text-sm">{player.name}</span>
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
