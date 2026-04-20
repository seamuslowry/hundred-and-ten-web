import type { PlayerInGame, Player } from "@/lib/api/types";

interface MemberListProps {
  organizer: PlayerInGame;
  players: PlayerInGame[];
  invitees: PlayerInGame[];
  playerDetails: Map<string, Player>;
}

function playerName(pig: PlayerInGame, details: Map<string, Player>): string {
  return details.get(pig.id)?.name || pig.id;
}

export function MemberList({
  organizer,
  players,
  invitees,
  playerDetails,
}: MemberListProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Players
        </h3>
        <ul className="mt-1 space-y-1">
          <li className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm dark:text-gray-200">
            {playerName(organizer, playerDetails)}
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
              Organizer
            </span>
          </li>
          {players.map((p) => (
            <li
              key={p.id}
              className="rounded-lg px-2 py-1 text-sm dark:text-gray-200"
            >
              {playerName(p, playerDetails)}
            </li>
          ))}
        </ul>
      </div>
      {invitees.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Pending Invites
          </h3>
          <ul className="mt-1 space-y-1">
            {invitees.map((p) => (
              <li
                key={p.id}
                className="rounded-lg px-2 py-1 text-sm text-gray-400 dark:text-gray-500"
              >
                {playerName(p, playerDetails)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
