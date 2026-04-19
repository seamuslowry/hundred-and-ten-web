"use client";

import { RequireAuth } from "@/components/auth/require-auth";

export default function LobbiesPage() {
  return (
    <RequireAuth>
      <main className="mx-auto max-w-2xl p-4">
        <h1 className="text-2xl font-bold">Lobbies</h1>
        <p className="mt-2 text-gray-500">Coming soon...</p>
      </main>
    </RequireAuth>
  );
}
