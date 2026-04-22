import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { useAuth } from "@/lib/hooks/use-auth";
import { createLobby } from "@/lib/api/lobbies";

export const Route = createFileRoute("/lobbies/new")({
  component: NewLobbyPage,
});

function NewLobbyContent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [accessibility, setAccessibility] = useState<"PUBLIC" | "PRIVATE">(
    "PUBLIC",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const lobby = await createLobby(user.uid, name.trim(), accessibility);
      navigate({ to: "/lobbies/$lobbyId", params: { lobbyId: lobby.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create lobby");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="text-2xl font-bold dark:text-gray-100">New Lobby</h1>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium dark:text-gray-200"
          >
            Lobby Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            style={{ minHeight: 44 }}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium dark:text-gray-200">
            Visibility
          </label>
          <div className="mt-1 flex gap-4">
            <label
              className="flex items-center gap-2 dark:text-gray-200"
              style={{ minHeight: 44 }}
            >
              <input
                type="radio"
                name="accessibility"
                value="PUBLIC"
                checked={accessibility === "PUBLIC"}
                onChange={() => setAccessibility("PUBLIC")}
              />
              Public
            </label>
            <label
              className="flex items-center gap-2 dark:text-gray-200"
              style={{ minHeight: 44 }}
            >
              <input
                type="radio"
                name="accessibility"
                value="PRIVATE"
                checked={accessibility === "PRIVATE"}
                onChange={() => setAccessibility("PRIVATE")}
              />
              Private
            </label>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          style={{ minHeight: 44 }}
        >
          {submitting ? "Creating..." : "Create Lobby"}
        </button>
      </form>
    </main>
  );
}

function NewLobbyPage() {
  return (
    <RequireAuth>
      <NewLobbyContent />
    </RequireAuth>
  );
}
