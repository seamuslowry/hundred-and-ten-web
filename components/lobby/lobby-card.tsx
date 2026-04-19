import type { Lobby } from "@/lib/api/types";
import Link from "next/link";

interface LobbyCardProps {
  lobby: Lobby;
  isInvite?: boolean;
}

export function LobbyCard({ lobby, isInvite }: LobbyCardProps) {
  const playerCount = 1 + lobby.players.length; // organizer + players

  return (
    <Link
      href={`/lobbies/${lobby.id}`}
      className="block rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
      style={{ minHeight: 44 }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{lobby.name}</h3>
        <div className="flex items-center gap-2">
          {isInvite && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
              Invited
            </span>
          )}
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {lobby.accessibility === "PUBLIC" ? "Public" : "Private"}
          </span>
        </div>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        {playerCount} player{playerCount !== 1 ? "s" : ""}
      </p>
    </Link>
  );
}
