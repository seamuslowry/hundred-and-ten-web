---
title: "React async handlers: memoization, error safety, prop consistency, and test coverage"
date: 2026-04-21
category: best-practices
module: game-page
problem_type: best_practice
component: frontend_stimulus
severity: medium
applies_when:
  - "Adding a manual refresh button alongside a polling hook in a React component"
  - "Wrapping async refetch calls in onClick event handlers"
  - "Defining optional vs required props on layered parent/child component interfaces"
  - "Testing error paths for async state-setting callbacks (e.g. isRefreshing resets)"
  - "Asserting that configuration values (e.g. polling intervals) are forwarded to inner hooks"
related_components:
  - testing_framework
tags:
  - react
  - usecallback
  - async-error-handling
  - optional-props
  - typescript
  - polling
  - testing
  - vitest
---

# React async handlers: memoization, error safety, prop consistency, and test coverage

## Context

When PR #2 (`feat/polling-manual-refresh`) added a Refresh button to the game page alongside a polling hook, a code review surfaced four compounding issues:

1. `GameBoard` declared `onRefresh`/`isRefreshing` as **required** while child `GameStatusBar` declared them **optional** — forcing every caller of `GameBoard` to supply a refresh feature.
2. `handleRefresh` was a plain `async function` inside the component body — new reference every render, unnecessary re-renders downstream.
3. `handleRefresh` used `try/finally` but no `catch` — rejected promise escapes as an unhandled rejection at runtime and in tests.
4. No test verified `isRefreshing` resets on the error path; no test asserted the interval value was forwarded correctly.

## Guidance

### 1. Match optional/required across layered component interfaces

When a prop is optional on a child, make it optional on the parent too. Required props on a wrapper that the wrapped component treats as optional force callers to supply a feature they may not need.

```typescript
// Before — GameBoard forces callers to supply refresh props
interface GameBoardProps {
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
}

// After — matches GameStatusBar's interface
interface GameBoardProps {
  onRefresh?: () => Promise<void>;
  isRefreshing?: boolean;
}
```

When passing these optional props down, use optional chaining at the call site: `onClick={() => onRefresh?.()}`.

### 2. Memoize async handlers with `useCallback` — and always `catch`

Inline `async function` declarations produce a new reference every render. Wrap with `useCallback` to stabilize the reference.

Also: `try/finally` alone does **not** prevent an unhandled rejection. When a React `onClick` returns a rejected promise, that rejection escapes the async function and becomes unhandled. `catch {}` (even empty) consumes it before it leaves:

```typescript
// Before — new reference every render; rejection escapes try/finally
async function handleRefresh() {
  setIsRefreshing(true);
  try {
    await refetch();
  } finally {
    setIsRefreshing(false); // runs, but error still propagates
  }
}

// After — stable reference; rejection consumed
import { useCallback, useState } from "react";

const handleRefresh = useCallback(async () => {
  setIsRefreshing(true);
  try {
    await refetch();
  } catch {
    // Swallow — isRefreshing resets via finally; surface errors when UX is ready
  } finally {
    setIsRefreshing(false);
  }
}, [refetch]);
```

The `catch {}` is not optional boilerplate. Without it, the rejection propagates out of the async function to the caller (the synthetic event handler), causing an unhandled promise rejection in both browser and test environments.

### 3. Test async error paths at the component level

To verify `isRefreshing` resets on both success and failure, mount the real page component with mocked dependencies. Stub `GameBoard` as a minimal div that exposes `onRefresh` as a button — this drives the actual handler in the page without rendering the full game UI:

```typescript
// routes/games/__tests__/game-page.test.tsx
vi.mock("@/lib/hooks/use-game-state", () => ({ useGameState: vi.fn() }));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useParams: vi.fn().mockReturnValue({ gameId: "game-abc" }),
    Link: ({ children, ...props }: { children: React.ReactNode; to: string }) => (
      <a href={props.to}>{children}</a>
    ),
  };
});
vi.mock("@/components/auth/require-auth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/game/game-board", () => ({
  GameBoard: ({
    onRefresh,
    isRefreshing,
  }: {
    onRefresh?: () => Promise<void>;
    isRefreshing?: boolean;
  }) => (
    <div>
      <span data-testid="refreshing">{String(isRefreshing)}</span>
      {/* Use a wrapper arrow — passes onClick's MouseEvent correctly */}
      <button onClick={() => onRefresh?.()}>Refresh</button>
    </div>
  ),
}));

it("resets isRefreshing to false after refetch rejects", async () => {
  mockUseGameState.mockReturnValue({
    ...baseState,
    refetch: vi.fn().mockRejectedValue(new Error("network error")),
  });

  render(<GamePage />);
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

  await waitFor(() => {
    expect(screen.getByTestId("refreshing").textContent).toBe("false");
  });
});
```

> **Note:** Pass `onRefresh` to `onClick` via `() => onRefresh?.()`, not as `onClick={onRefresh}` directly. `onClick` expects `MouseEventHandler<HTMLButtonElement>`, and passing an `async () => Promise<void>` directly creates a type mismatch (wrong parameter list). The arrow wrapper fixes both the type and the optional-call.

### 4. Assert forwarded hook arguments with a spy-wrapping mock

To verify that a configuration value (e.g. polling interval) is correctly forwarded from one hook to an inner hook, use Vitest's `importOriginal` factory — it wraps the real implementation in a spy without replacing it, keeping real behaviour while enabling argument assertions.

> **Import ordering:** Place all `import` statements at the **top** of the file, before any `vi.mock` calls in source order. Vitest hoists `vi.mock` above imports at transform time, so the import will resolve to the mocked module regardless of where it appears. However, writing the import mid-file misleads readers into thinking order doesn't matter.

```typescript
// At top of file (imports hoisted by Vitest above vi.mock calls at build time)
import { usePolling } from "../use-polling";
import { useGameState } from "../use-game-state";

vi.mock("../use-polling", async (importOriginal) => {
  // importOriginal() returns the real module; vi.fn(actual.usePolling) wraps it in a spy
  const actual = (await importOriginal()) as typeof import("../use-polling");
  return { ...actual, usePolling: vi.fn(actual.usePolling) };
});

const mockUsePolling = vi.mocked(usePolling);

it("forwards the configured interval to usePolling when waiting for opponent", async () => {
  renderHook(() => useGameState({ gameId: GAME_ID, interval: 30000 }));

  await waitFor(() => expect(mockGetGame).toHaveBeenCalledTimes(1));

  expect(mockUsePolling).toHaveBeenCalledWith(
    expect.objectContaining({ interval: 30000 }),
  );
});
```

> **Type safety note:** `importOriginal<typeof import(...)>()` looks like a checked inference but is actually an unchecked cast. Using `as typeof import('../use-polling')` (shown above) makes the cast explicit and visible — prefer this over the generic form.

## Why This Matters

| Gap | Runtime impact |
|-----|----------------|
| Required props on parent, optional on child | Callers forced to plumb unused props; refactoring is harder |
| Unmemoized callback | Child subtrees re-render on every parent render |
| `try/finally` without `catch` on async onClick | Unhandled rejection in browser; phantom errors in test suite |
| No error-path test | `isRefreshing` can get stuck at `true`, permanently disabling the Refresh button after a network error |
| Interval not asserted | Polling can silently degrade (e.g. 3s instead of 30s) with no failing test |

## When to Apply

- Any component that holds `isLoading`/`isRefreshing`-style state and calls an async function from an event handler
- Any wrapper component that passes optional-in-child props through its own interface
- Any hook that accepts a configuration value and forwards it to an inner hook — assert the forwarded value in tests
- Any async `onClick` handler — always add `catch {}` if not surfacing errors to UI

## Related

- `components/game/game-status-bar.tsx` — the child component whose optional interface `GameBoard` now matches
- `lib/hooks/use-game-state.ts` — hooks that forward interval to `usePolling`
- `lib/hooks/__tests__/use-game-state.test.ts` — spy-wrapping mock example for `usePolling`
- `routes/games/__tests__/game-page.test.tsx` — error-path test for `handleRefresh`

## Notes

**ESLint constraint — deriving state that feeds the hook providing the data:** This codebase has custom rules banning `setState` inside `useEffect` and `ref.current` reads/writes during render. When `pollingEnabled` must be derived from game state, but game state comes from `usePolling` (which needs `pollingEnabled` as input), the only lint-compliant approach is React's "adjust state during render" pattern — compare a tracked key to the current one in the render body and call `setState` synchronously when they diverge. React re-runs the component before painting. Do **not** use `useEffect` or `useRef` for this case in this codebase.
