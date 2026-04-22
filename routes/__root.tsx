import { createRootRoute, Outlet } from "@tanstack/react-router";
import { AuthProvider } from "@/components/auth/auth-provider";
import { AppShell } from "@/components/app-shell";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <AuthProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </AuthProvider>
  );
}
