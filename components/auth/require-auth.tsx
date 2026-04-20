"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthContext } from "./auth-provider";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = use(AuthContext);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      const returnTo = window.location.pathname;
      router.push(`/?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
