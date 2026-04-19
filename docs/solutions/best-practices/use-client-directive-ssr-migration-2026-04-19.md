---
title: "Removing stale 'use client' directives after static-to-SSR migration"
date: 2026-04-19
category: best-practices
module: hundred-and-ten-web
problem_type: best_practice
component: tooling
severity: medium
applies_when:
  - Migrating a Next.js app from output:export (static) to SSR
  - Auditing components after any architectural rendering change
  - Diagnosing unexpectedly large client bundles
tags: [nextjs, react, ssr, use-client, server-components, static-export, client-boundary]
---

# Removing stale 'use client' directives after static-to-SSR migration

## Context

This project was originally configured with `output: 'export'` in `next.config.ts`, making it a fully static site. In that mode, all components render client-side regardless, so `'use client'` directives were effectively no-ops on many components — they caused no harm but also provided no signal.

After migrating to SSR (removing `output: 'export'`), stale `'use client'` directives on pure display components unnecessarily opt them out of server rendering. Next.js treats any component with `'use client'` as a client component boundary, meaning it and all its descendants are bundled for the browser rather than rendered on the server.

Six components were carrying stale directives after the SSR migration: `game-status-bar.tsx`, `score-board.tsx`, `trick-area.tsx`, `lobby-card.tsx`, `member-list.tsx`, and `app-shell.tsx`.

## Guidance

**Decision rule:** A component needs `'use client'` if and only if it uses one or more of:

- Browser hooks: `useState`, `useEffect`, `useRef`, `useCallback`, `useMemo`, etc.
- Routing hooks: `useRouter`, `useParams`, `useSearchParams`
- Custom hooks that internally use any of the above
- Event handlers that run in the browser (`onClick`, `onChange`, form submission handlers, etc.)
- React class lifecycle methods: `componentDidCatch`, `componentDidMount`, etc.

**Pure display components** — those that only accept props and return JSX, with no hooks and no event handlers — do not need `'use client'` and are better as server components.

When auditing, work top-down through the component tree. A parent with `'use client'` makes all its children client components implicitly, so removing it from a parent can unlock server rendering for a whole subtree.

## Why This Matters

**Server rendering reduces time-to-first-render.** Server components produce HTML on the server and send it to the browser immediately, rather than waiting for JavaScript to download, parse, and execute before anything appears.

**Smaller client bundles.** Every component marked `'use client'` (and its entire import tree) gets included in the JavaScript bundle sent to the browser. Pure display components served as server components are never in the client bundle at all.

**Correct semantics.** `'use client'` is not a default or a safe fallback — it is an explicit opt-in to client rendering with real tradeoffs. Treating it as noise undermines the architectural intent of the React Server Components model.

**Stale directives accumulate silently.** A static-export app that migrates to SSR will have this problem universally if `'use client'` was used liberally during the static phase. The codebase will appear to work, but SSR benefits won't materialize until the audit is done.

## When to Apply

- **Immediately after any static→SSR migration** — stale directives are guaranteed to exist.
- **During code review** when a new component is added with `'use client'` — ask whether hooks or event handlers are actually present.
- **When diagnosing bundle size regressions** — a large client bundle is sometimes caused by a single `'use client'` pulling in a large subtree unnecessarily.
- **Periodically** after significant feature additions that introduce new components.

## Examples

### Before: Pure display component with stale `'use client'`

```tsx
// components/lobby/lobby-card.tsx
'use client';

import type { Lobby } from "@/lib/api/types";

interface LobbyCardProps {
  lobby: Lobby;
}

export default function LobbyCard({ lobby }: LobbyCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <h2 className="text-lg font-semibold">{lobby.name}</h2>
    </div>
  );
}
```

No hooks. No event handlers. The directive forces this into the client bundle unnecessarily.

### After: Server component

```tsx
// components/lobby/lobby-card.tsx
import type { Lobby } from "@/lib/api/types";

interface LobbyCardProps {
  lobby: Lobby;
}

export default function LobbyCard({ lobby }: LobbyCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <h2 className="text-lg font-semibold">{lobby.name}</h2>
    </div>
  );
}
```

Removing the directive makes Next.js render this on the server by default. No behavior change for a pure display component.

### Contrast: Component that legitimately needs `'use client'`

```tsx
// components/lobby/player-search.tsx
'use client';

import { useState } from "react";

export default function PlayerSearch() {
  const [query, setQuery] = useState("");
  return (
    <input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search players..."
    />
  );
}
```

`useState` and `onChange` both require a browser context. `'use client'` is correct and required here.

## Related Fix: TypeScript `unknown` from `.catch((e) => e)`

When writing tests that catch thrown errors with `.catch((e) => e)`, TypeScript types the caught value as `unknown`. Accessing properties directly on `unknown` produces `TS18046`.

```typescript
// Before (TS18046: 'error' is of type 'unknown'):
const error = await apiFetch("/test").catch((e) => e);
expect(error.message).toBe("Not found");
expect(error.status).toBe(404);

// After — cast at point of use:
const error = await apiFetch("/test").catch((e) => e);
expect((error as ApiError).message).toBe("Not found");
expect((error as ApiError).status).toBe(404);
```

This pattern appears in `lib/api/__tests__/client.test.ts`. The fix is a cast at the assertion site — no runtime behavior change, restores type safety.

## Related

- Next.js docs: [Server and Client Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
