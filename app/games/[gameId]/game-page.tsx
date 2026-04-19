"use client";

import { RequireAuth } from "@/components/auth/require-auth";
import { useParams } from "next/navigation";

function GameContent() {
  const { gameId } = useParams<{ gameId: string }>();

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="text-2xl font-bold">Game {gameId}</h1>
      <p className="mt-2 text-gray-500">Game view coming soon...</p>
    </main>
  );
}

export function GamePage() {
  return (
    <RequireAuth>
      <GameContent />
    </RequireAuth>
  );
}
