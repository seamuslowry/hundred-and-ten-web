
import { use, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AuthContext } from "./auth-provider";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = use(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      const returnTo = window.location.pathname;
      const safeReturnTo = returnTo.startsWith("/") ? returnTo : "/lobbies";
      navigate({ to: "/", search: { returnTo: safeReturnTo } });
    }
  }, [user, loading, navigate]);

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
