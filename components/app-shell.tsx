import type { ReactNode } from "react";
import { ErrorBoundary } from "./error-boundary";
import { AppHeader } from "./app-header";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <AppHeader />
      <div className="flex-1">{children}</div>
    </ErrorBoundary>
  );
}
