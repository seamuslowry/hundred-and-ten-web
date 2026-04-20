"use client";

import Link from "next/link";
import { useAuth } from "@/lib/hooks/use-auth";

export function AppHeader() {
  const { user, signOut } = useAuth();

  if (!user) return null;

  return (
    <header className="border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
      <nav className="flex items-center justify-between">
        <Link href="/lobbies" className="text-lg font-bold dark:text-gray-100">
          Hundred and Ten
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {user.displayName ?? user.email}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="min-h-[44px] rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Sign out
          </button>
        </div>
      </nav>
    </header>
  );
}
