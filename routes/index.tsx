import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { SignInButton } from "@/components/auth/sign-in-button";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/" });
  const returnTo =
    typeof (search as Record<string, unknown>).returnTo === "string" &&
    ((search as Record<string, string>).returnTo.startsWith("/")
      ? (search as Record<string, string>).returnTo
      : null);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: returnTo || "/lobbies" });
    }
  }, [user, loading, navigate, returnTo]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (user) return null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Hundred and Ten</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          The classic Irish card game
        </p>
      </div>
      <SignInButton />
    </main>
  );
}
