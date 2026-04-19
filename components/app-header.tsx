"use client";

import Link from "next/link";
import { useAuth } from "@/lib/hooks/use-auth";

export function AppHeader() {
  const { user, signOut } = useAuth();

  if (!user) return null;

  return (
    <header className="border-b bg-white px-4 py-3">
      <nav className="mx-auto flex max-w-2xl items-center justify-between">
        <Link href="/lobbies" className="text-lg font-bold">
          Hundred and Ten
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {user.displayName ?? user.email}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="min-h-[44px] rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Sign out
          </button>
        </div>
      </nav>
    </header>
  );
}
