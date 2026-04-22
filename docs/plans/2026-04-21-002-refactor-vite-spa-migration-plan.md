---
title: "refactor: Migrate from Next.js to Vite + TanStack Router SPA"
type: refactor
status: active
date: 2026-04-21
origin: docs/brainstorms/vite-spa-migration-requirements.md
---

# refactor: Migrate from Next.js to Vite + TanStack Router SPA

## Overview

Replace Next.js 16 with Vite 8 and TanStack Router (file-based routing) to produce a fully static SPA bundle deployable to Azure Static Web Apps at zero idle cost. The app is already functionally client-side — no API routes, no server actions, no RSC data fetching — so the migration eliminates infrastructure overhead without changing user-facing behavior.

## Problem Frame

Next.js SSR requires a running Node.js server, which incurs continuous Azure hosting costs even when no users are active. Azure Static Web Apps scales to zero and has a free tier, but requires a static bundle with no server runtime. Dynamic routes (e.g. `/games/:gameId`) use runtime-generated IDs, making Next.js `output: 'export'` impractical. A clean Vite migration is the right long-term path. (see origin: `docs/brainstorms/vite-spa-migration-requirements.md`)

## Requirements Trace

- R1/R1a/R1b. Replace Next.js with Vite; create `index.html` entry and `vite.config.ts`
- R2. Replace Next.js App Router with TanStack Router file-based routing
- R3. Build output is a fully static bundle (no Node.js runtime)
- R4. Dynamic segments (`:gameId`, `:lobbyId`) resolve client-side at runtime
- R5. `@/*` path alias continues to resolve to repo root
- R6. `NEXT_PUBLIC_API_URL` → `VITE_API_URL`; `process.env.*` → `import.meta.env.*`
- R7. Firebase auth works unchanged; authorized domains updated post-deploy (manual)
- R8. Tailwind CSS v4 build pipeline works with Vite
- R9. Remove all `"use client"` directives and `next/*` imports
- R10. Update `AGENTS.md` for new stack
- R11. Remove Next.js and all Next.js-specific dependencies
- R12/R13. Deploy to Azure Static Web Apps; add `staticwebapp.config.json` for SPA fallback

## Scope Boundaries

- No CI/CD pipeline or Azure resource provisioning — this migration produces the deployable artifact only
- No changes to game logic, UI components, or API integration patterns beyond removing Next.js dependencies
- No changes to the backend or API contract
- Vitest retained as-is (verified: zero Next.js dependency in `vitest.config.ts`)
- The existing Next.js branch is the rollback; no additional rollback strategy needed

## Context & Research

### Relevant Code and Patterns

**Files with `next/navigation` imports (need hook replacement):**
- `app/page.tsx` — `useRouter`, `useSearchParams`
- `app/lobbies/new/page.tsx` — `useRouter`
- `app/lobbies/[lobbyId]/lobby-detail.tsx` — `useParams`, `useRouter`
- `app/games/[gameId]/game-page.tsx` — `useParams`
- `components/auth/require-auth.tsx` — `useRouter`

**Files with `next/link` imports (need `<Link>` replacement):**
- `app/games/[gameId]/game-page.tsx`
- `app/lobbies/page.tsx`
- `app/lobbies/[lobbyId]/lobby-detail.tsx`
- `components/lobby/lobby-card.tsx`
- `components/app-header.tsx`

**Files with `next/font/google` (remove; handle fonts separately):**
- `app/layout.tsx` — loads `Geist` and `Geist_Mono`, injects `--font-geist-sans` / `--font-geist-mono` CSS vars

**Test file needing update:**
- `app/games/[gameId]/__tests__/game-page.test.tsx` — mocks `next/navigation` for `useParams`; all other test files have zero Next.js imports

**Firebase init (vestigial SSR guard to remove):**
- `lib/firebase.ts` — `typeof window === "undefined"` check; safe to remove in a pure SPA

**Environment variables:**
- `lib/api/client.ts` — `process.env.NEXT_PUBLIC_API_URL`
- `lib/firebase.ts` — `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `lib/api/__tests__/client.test.ts` — sets/deletes `process.env.NEXT_PUBLIC_API_URL` in test setup
- `.env.local` and `.env.local.example` — define all four vars

**Vitest config (no changes needed):**
- `vitest.config.ts` — already uses `defineConfig` from `vitest/config`, `jsdom`, `@` alias — fully Vite-compatible

**PostCSS config (superseded by Vite plugin):**
- `postcss.config.mjs` — currently uses `@tailwindcss/postcss`; will be replaced by `@tailwindcss/vite` Vite plugin

**`app-shell.tsx` (fully portable):**
- No Next.js imports; becomes the root layout component body with `<Outlet />` in place of `{children}`

### Institutional Learnings

- `docs/solutions/best-practices/use-client-directive-ssr-migration-2026-04-19.md` — confirms `"use client"` directives are meaningless in a Vite SPA; strip all 24 occurrences during migration

### External References

- TanStack Router v1.168+ — React 19 compatible; `@tanstack/router-plugin` (not the deprecated `@tanstack/router-vite-plugin`)
- Vite 8.0.9 — `@vitejs/plugin-react`; `index.html` at project root; `dist/` output
- Tailwind v4 + `@tailwindcss/vite` — dedicated Vite plugin is faster and cleaner than the PostCSS approach for Vite projects; no `postcss.config.js` needed when using the Vite plugin
- Azure Static Web Apps — `staticwebapp.config.json` with `navigationFallback`; place in `public/` so Vite copies it to `dist/`; `output_location: dist`
- Firebase 12 — no initialization differences in a pure SPA; `signInWithPopup` preferred; auth persistence is browser-local by default

## Key Technical Decisions

- **`@tanstack/router-plugin` not `@tanstack/router-vite-plugin`**: The latter is deprecated as of 2025; use `tanstackRouter()` from `@tanstack/router-plugin/vite`
- **`@tailwindcss/vite` plugin over PostCSS**: Vite-native plugin is faster, removes the need for `postcss.config.js`, and is the official recommendation for Vite projects in Tailwind v4. Replace `@tailwindcss/postcss` with `@tailwindcss/vite`.
- **`routeTree.gen.ts` committed to repo**: Official TanStack recommendation; provides stable TypeScript types without requiring a dev server run in CI; the file carries `// @ts-nocheck` and `/* eslint-disable */` headers auto-injected by the plugin
- **Geist font via `@fontsource/geist`**: Replaces `next/font/google`; allows defining `--font-geist-sans` / `--font-geist-mono` CSS vars in `globals.css` without a framework font loader
- **`vite.config.ts` absorbs Vitest config**: `vitest.config.ts` already uses `vitest/config`'s `defineConfig` (which re-exports Vite's config); merge into a single `vite.config.ts` to avoid dual config files
- **`staticwebapp.config.json` in `public/`**: Vite copies `public/` to `dist/` automatically; this ensures the file is present in the deployed bundle without extra build steps
- **`@/*` alias maps to repo root (`.`)**: Current project has no `src/` directory; all source lives at root level (`app/`, `components/`, `lib/`). The alias must resolve to `.` not `./src`. Note: avoid using `@/main`, `@/vite.config`, or `@/routeTree.gen` as import paths from within application code — these resolve to build-infrastructure files at the repo root.
- **`tanstackRouter()` plugin must precede `react()` in plugins array**: Required ordering per TanStack Router docs

## Open Questions

### Resolved During Planning

- **TanStack Router React 19 compatibility**: Confirmed — peer deps are `react >= 18.0.0 || >= 19.0.0`; pin `@tanstack/react-router@^1.168.23` and `@tanstack/router-plugin@^1.167.22`
- **Firebase init in Vite SPA**: No differences — the existing pattern works unchanged; only the env var prefix and the vestigial SSR guard need updating
- **Tailwind v4 with Vite**: Confirmed compatible; `@tailwindcss/vite` plugin is the recommended path and requires no `postcss.config.js`
- **Vitest Next.js dependency**: None — `vitest.config.ts` is already clean; zero Next.js references
- **`next/image` usage**: None found in any component — no image replacement needed
- **`routeTree.gen.ts` — commit or gitignore**: Commit it (official recommendation; stable types for CI)
- **Azure SWA `output_location`**: `dist` (Vite default); `app_location`: `/`

### Deferred to Implementation

- Exact ESLint flat config shape after removing `eslint-config-next`: `eslint-config-next` bundles `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-import`, and `@typescript-eslint`. The replacement config needs at minimum `eslint-plugin-react` + `eslint-plugin-react-hooks` + `@typescript-eslint/eslint-plugin`. Exact rule parity is implementation-time work.
- Whether `tsr.config.json` is preferred over inline plugin config in `vite.config.ts` — either works; choose at implementation time

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
CURRENT                          TARGET
─────────────────────────        ──────────────────────────────
Next.js App Router               TanStack Router (file-based)
  app/layout.tsx         →         routes/__root.tsx
  app/page.tsx           →         routes/index.tsx
  app/lobbies/page.tsx   →         routes/lobbies/index.tsx
  app/lobbies/new/...    →         routes/lobbies/new.tsx
  app/lobbies/[lobbyId]/ →         routes/lobbies/$lobbyId.tsx
  app/games/[gameId]/    →         routes/games/$gameId.tsx

Build entry
  (implicit Next.js)     →         index.html + main.tsx (at repo root, no src/ dir)

Env vars
  process.env.NEXT_PUBLIC_*  →     import.meta.env.VITE_*

CSS pipeline
  next built-in PostCSS  →         @tailwindcss/vite plugin in vite.config.ts

Fonts
  next/font/google       →         @fontsource/geist + CSS var definitions in globals.css

Deploy artifact
  .next/ (server)        →         dist/ (static bundle)
  Azure App Service      →         Azure Static Web Apps
```

**Route file naming** — TanStack Router file-based conventions:
- `routes/__root.tsx` — root layout (wraps all routes)
- `routes/index.tsx` — `/`
- `routes/lobbies/index.tsx` — `/lobbies`
- `routes/lobbies/new.tsx` — `/lobbies/new`
- `routes/lobbies/$lobbyId.tsx` — `/lobbies/:lobbyId`
- `routes/games/$gameId.tsx` — `/games/:gameId`

**Hook mapping:**
- `useRouter().push(path)` → `useNavigate()` then `navigate({ to: path })`
- `useParams()` from `next/navigation` → `Route.useParams()` (type-safe, per-route)
- `useSearchParams()` → `useSearch()` from TanStack Router
- `<Link href="...">` → `<Link to="...">` from `@tanstack/react-router`
- `useRouter().back()` → `history.back()` or `useRouter()` from TanStack (same name, different import)

## Implementation Units

- [ ] **Unit 1: Install Vite, TanStack Router, and update package.json**

**Goal:** Install all new dependencies, remove Next.js and its ESLint config, and update `package.json` scripts.

**Requirements:** R1, R11

**Dependencies:** None

**Files:**
- Modify: `package.json`
- Delete: `next.config.ts`
- Delete: `next-env.d.ts`

**Approach:**
- Add to `dependencies`: `@tanstack/react-router`
- Add to `devDependencies`: `vite`, `@vitejs/plugin-react`, `@tanstack/router-plugin`, `@tailwindcss/vite`, `@fontsource/geist`, `@fontsource/geist-mono`
- Remove from `dependencies`: `next`
- Remove from `devDependencies`: `eslint-config-next`
- Update scripts: `dev` → `vite`, `build` → `tsc -b && vite build`, add `preview` → `vite preview`, update `clean` → targets `dist` and removes `out/` (a Next.js static export artifact), removing `.next`
- Delete `next.config.ts` (empty file, no longer needed)
- Delete `next-env.d.ts` (Next.js-generated type file)

**Test expectation:** none — pure dependency and config change; verified by `npm install` completing cleanly and `npm run dev` starting (covered in Unit 3 verification)

**Verification:**
- `package.json` has no `next` or `eslint-config-next` entries
- `npm install` completes without peer dependency errors

---

- [ ] **Unit 2: Create `vite.config.ts`, `index.html`, and `tsconfig.json` update**

**Goal:** Create the Vite build configuration and HTML entry point; update TypeScript config to remove Next.js-specific settings.

**Requirements:** R1, R1a, R1b, R3, R5, R8

**Dependencies:** Unit 1

**Files:**
- Create: `vite.config.ts`
- Create: `index.html`
- Modify: `tsconfig.json`
- Delete: `postcss.config.mjs` (superseded by `@tailwindcss/vite` plugin)
- Delete: `vitest.config.ts` (merged into `vite.config.ts`)

**Approach:**
- `vite.config.ts`: configure `tanstackRouter()` plugin (before `react()`), `react()` plugin, `tailwindcss()` plugin from `@tailwindcss/vite`, path alias `@` → `.` (repo root, not `./src`), build `outDir: 'dist'`
- Merge Vitest config into `vite.config.ts`: import `defineConfig` from `vitest/config`, add `test` block preserving existing settings (`environment: 'jsdom'`, `globals: true`, `setupFiles: ['./vitest.setup.ts']`). Delete `vitest.config.ts` after merging.
- `index.html`: place at project root; `<div id="root"></div>` mount point; `<script type="module" src="/main.tsx">` (entry at repo root, not `src/`); `<title>Hundred and Ten</title>`; viewport meta tag
- `tsconfig.json`: remove `next` plugin from `plugins` array, remove `.next/types/**/*.ts` from `include`, remove any `next` specific `lib` entries. Add `"jsx": "react-jsx"`, ensure `"moduleResolution": "bundler"`, add path alias `"@/*": ["./*"]` to match the `@` → `.` alias

**Test expectation:** none — config scaffolding; verified structurally and by `npm run build` (Unit 9)

**Verification:**
- `vite.config.ts` exists and references all three plugins in correct order
- `index.html` exists at repo root with correct mount point and script entry
- `vitest.config.ts` is deleted; single config file remains

---

- [ ] **Unit 3: Create TanStack Router root and route files; add `main.tsx` entry**

**Goal:** Create the router entry point and all route files, translating the existing Next.js page structure.

**Requirements:** R2, R4

**Dependencies:** Unit 2

**Files:**
- Create: `main.tsx` (at repo root — no `src/` directory in this project)
- Create: `routes/__root.tsx`
- Create: `routes/index.tsx`
- Create: `routes/lobbies/index.tsx`
- Create: `routes/lobbies/new.tsx`
- Create: `routes/lobbies/$lobbyId.tsx`
- Create: `routes/games/$gameId.tsx`
- Create: `routeTree.gen.ts` (auto-generated by plugin — see generation note below)

**Generation note for `routeTree.gen.ts`:** `main.tsx` imports from `./routeTree.gen.ts`, but this file does not exist until the dev server or build runs the plugin. Bootstrap sequence: (1) write all route files first, (2) write `main.tsx` with a `// @ts-ignore` on the `routeTree.gen` import temporarily, (3) run `npm run dev` to trigger generation, (4) remove the `// @ts-ignore`, (5) commit `routeTree.gen.ts` alongside `main.tsx`. Do not run `npx tsc --noEmit` until after generation — it will fail on the missing file. The generated file carries `// @ts-nocheck` at the top so its internals are excluded from type checking.
- Delete: `app/layout.tsx`
- Delete: `app/page.tsx`
- Delete: `app/lobbies/page.tsx`
- Delete: `app/lobbies/new/page.tsx`
- Delete: `app/lobbies/[lobbyId]/page.tsx` (server shell only — logic lives in `lobby-detail.tsx`)
- Delete: `app/games/[gameId]/page.tsx` (server shell only — logic lives in `game-page.tsx`)

**Approach:**
- `main.tsx`: create router from `routeTree`, `RouterProvider` wrapper, `StrictMode`, mount to `#root`. Register router type via `declare module '@tanstack/react-router'`
- `routes/__root.tsx`: root layout — wraps with `<AuthProvider>`, `<AppShell>`, `<Outlet />` in place of `{children}`. Move `<html>` / `<body>` wrapper logic to `index.html`. No `Metadata` export (static title in `index.html`).
- Each leaf route: import the existing client component (`game-page.tsx`, `lobby-detail.tsx`, etc.) and re-export it as the route component via `createFileRoute`. No logic changes to the component files yet — hook replacements happen in Unit 4.
- `routeTree.gen.ts`: run `npm run dev` once to trigger generation (see generation note above); commit the output

**Patterns to follow:**
- TanStack Router file-based route structure (see High-Level Technical Design section)
- `components/app-shell.tsx` is already portable — use as-is with `<Outlet />`

**Test expectation:** none — structural scaffolding; behavior verified end-to-end in Unit 9

**Verification:**
- `npm run dev` starts without errors
- All 5 routes render their existing client component in the browser
- `routeTree.gen.ts` exists and is committed

---

- [ ] **Unit 4: Replace `next/navigation` and `next/link` hooks and components**

**Goal:** Swap all Next.js-specific routing imports for their TanStack Router equivalents across all affected files.

**Requirements:** R2, R9

**Dependencies:** Unit 3

**Files:**
- Modify: `routes/index.tsx` (the migrated home component — `app/page.tsx` is deleted in Unit 3, logic moves here)
- Modify: `routes/lobbies/new.tsx` (the migrated new-lobby component — `app/lobbies/new/page.tsx` is deleted in Unit 3, logic moves here rather than staying as a separate component)
- Modify: `app/lobbies/[lobbyId]/lobby-detail.tsx`
- Modify: `app/games/[gameId]/game-page.tsx`
- Modify: `components/auth/require-auth.tsx`
- Modify: `components/lobby/lobby-card.tsx`
- Modify: `components/app-header.tsx`
- Test: `app/games/[gameId]/__tests__/game-page.test.tsx`

**Approach:**
- `useRouter().push(path)` → `const navigate = useNavigate(); navigate({ to: path })`
- `useParams()` → `Route.useParams()` on each route file's `Route` export, or `useParams({ from: '/route/$param' })` — use the per-route type-safe form
- `useSearchParams()` → `useSearch()` from `@tanstack/react-router` (returns the full search object)
- `<Link href="...">` → `<Link to="...">` from `@tanstack/react-router`
- `require-auth.tsx`: the redirect-to-login pattern (`router.push('/?returnTo=...')`) — use `useNavigate()` + `useLocation()` to construct the `returnTo` param. **Validate that `returnTo` is a relative path** (starts with `/`) before navigating to it; reject external URLs to prevent open redirect. Fall back to `/lobbies` if the value is missing or invalid.
- The `<Suspense>` wrapper in `app/page.tsx` exists solely because Next.js's `useSearchParams()` requires it. In `routes/index.tsx`, remove the `<Suspense>` wrapper — TanStack Router's `useSearch()` does not require a Suspense boundary.
- `game-page.test.tsx`: replace `vi.mock('next/navigation', ...)` mock with TanStack Router's `createMemoryHistory` + `createRouter` test wrapper, or mock `Route.useParams` directly. TanStack Router exports `createRootRoute`, `createRoute`, `createMemoryHistory`, `createRouter` for test use.

**Test scenarios:**
- Happy path: `require-auth.tsx` renders children when user is authenticated
- Happy path: `require-auth.tsx` navigates to `/?returnTo=/games/abc` when unauthenticated on a protected route
- Security: `require-auth.tsx` rejects `returnTo=https://evil.com` and falls back to `/lobbies`
- Edge case: `require-auth.tsx` falls back to `/lobbies` when `returnTo` is absent
- Happy path: `game-page.test.tsx` — `handleRefresh` resets `isRefreshing` on resolve (existing test preserved)
- Happy path: `game-page.test.tsx` — `handleRefresh` resets `isRefreshing` on reject (existing test preserved)
- Edge case: `useParams` returns correct `gameId` value in `game-page.tsx` when route is `/games/abc123`
- Edge case: `useParams` returns correct `lobbyId` value in `lobby-detail.tsx`

**Verification:**
- No `next/navigation` or `next/link` imports remain in any file (`grep -r "next/navigation\|next/link" .` returns nothing)
- All existing passing tests in `game-page.test.tsx` continue to pass after mock replacement

---

- [ ] **Unit 5: Update environment variables and Firebase init**

**Goal:** Rename all `NEXT_PUBLIC_*` env vars to `VITE_*`, update access pattern from `process.env.*` to `import.meta.env.*`, and clean up the vestigial Firebase SSR guard.

**Requirements:** R6, R7

**Dependencies:** Unit 1 (can run in parallel with Units 3, 4, and 6 — touches only `lib/` files and env files)

**Files:**
- Modify: `lib/api/client.ts`
- Modify: `lib/firebase.ts`
- Modify: `lib/api/__tests__/client.test.ts`
- Modify: `.env.local`
- Modify: `.env.local.example`

**Approach:**
- In `lib/api/client.ts`: `process.env.NEXT_PUBLIC_API_URL` → `import.meta.env.VITE_API_URL`
- In `lib/firebase.ts`: rename all four `NEXT_PUBLIC_FIREBASE_*` → `VITE_FIREBASE_*`; change `process.env.*` → `import.meta.env.*`; remove `typeof window === 'undefined'` SSR guard — the app is always client-side
- In `lib/api/__tests__/client.test.ts`: update test setup that sets/deletes `process.env.NEXT_PUBLIC_API_URL` — Vitest with `jsdom` does not expose `import.meta.env` directly; use `vi.stubEnv('VITE_API_URL', value)` / `vi.unstubAllEnvs()` pattern instead, or set `import.meta.env.VITE_API_URL` directly in test setup (Vitest supports this)
- In `.env.local` and `.env.local.example`: rename all four `NEXT_PUBLIC_*` keys to `VITE_*`

**Patterns to follow:**
- `lib/api/__tests__/client.test.ts` — existing setup/teardown structure; update only the env var names and access mechanism

**Test scenarios:**
- Happy path: `apiFetch` uses `import.meta.env.VITE_API_URL` as base URL when set
- Error path: `apiFetch` throws a descriptive error when `VITE_API_URL` is not set (existing behavior preserved)
- Happy path: Firebase initializes without error when all `VITE_FIREBASE_*` vars are present
- Edge case: Calling `getFirebaseAuth()` in a test environment with no env vars returns `null` gracefully

**Verification:**
- `grep -r "NEXT_PUBLIC_" .` returns nothing (excluding `node_modules`)
- `npm run test` passes — all existing `client.test.ts` assertions still hold

---

- [ ] **Unit 6: Update fonts and `globals.css`**

**Goal:** Replace `next/font/google` with `@fontsource/geist` and update `globals.css` to define font CSS variables directly.

**Requirements:** R9, R11

**Dependencies:** Unit 2 (font package installed in Unit 1)

**Files:**
- Modify: `app/globals.css` (or its new location — imported via `main.tsx`)
- Modify: `routes/__root.tsx` (replaces `app/layout.tsx` as the CSS import point)

**Approach:**
- Install `@fontsource/geist` (sans) and `@fontsource/geist-mono` packages (added to Unit 1 devDependency list as `@fontsource/geist` and `@fontsource/geist-mono`)
- In `main.tsx` or `routes/__root.tsx`: import font CSS files from `@fontsource/geist` and `@fontsource/geist-mono` to register the font faces
- In `globals.css` `@theme` block: replace `var(--font-geist-sans)` and `var(--font-geist-mono)` with the literal font-family strings `'Geist', sans-serif` and `'Geist Mono', monospace` (or reference a CSS var that you define manually: `--font-geist-sans: 'Geist', sans-serif`)
- Remove `geistSans.variable` and `geistMono.variable` class names from `<html>` — the `<html>` element is now in `index.html` with static classes, or the font vars are defined globally without needing a class scope
- Move the `globals.css` import from `app/layout.tsx` to `main.tsx`

**Test expectation:** none — visual/font change; no behavioral assertions

**Verification:**
- No `next/font` imports remain anywhere
- `npm run dev` shows Geist typeface rendered in the browser

---

- [ ] **Unit 7: Remove `"use client"` directives and clean up remaining Next.js artifacts**

**Goal:** Strip all 24 `"use client"` directives (meaningless in a Vite SPA) and remove any remaining Next.js-specific files or imports.

**Requirements:** R9, R11

**Dependencies:** Units 3–6

**Files:**
- Modify: all 24 files containing `"use client"` (all files in `lib/hooks/`, `app/` client components, `components/` interactive components — see research section for full list)
- Delete or modify: `eslint.config.mjs` (remove `eslint-config-next` reference)

**Approach:**
- For each file: remove the `"use client"` directive line. No other changes to these files in this unit.
- `eslint.config.mjs`: remove `eslint-config-next` import and its `extends`/`plugins` entries. Add `eslint-plugin-react`, `eslint-plugin-react-hooks`, and `@typescript-eslint/eslint-plugin` to replace the rules previously bundled by `eslint-config-next`. Retain `eslint-config-prettier` and `eslint-plugin-prettier`.
- Delete Next.js boilerplate SVGs from `public/` that are no longer used: `next.svg`, `vercel.svg` (and optionally `file.svg`, `globe.svg`, `window.svg` if they are not referenced by any component).
- Remove `import type { Metadata } from "next"` from `app/layout.tsx` (already deleted in Unit 3; confirm no stray references)

**Test expectation:** none — directive removal is non-behavioral

**Verification:**
- `grep -r '"use client"' .` returns nothing (excluding `node_modules`)
- `grep -r "from 'next'" .` and `grep -r 'from "next"' .` return nothing (excluding `node_modules`)
- `npm run lint` passes

---

- [ ] **Unit 8: Add `staticwebapp.config.json` and update `AGENTS.md`**

**Goal:** Add the Azure Static Web Apps SPA fallback config and update project documentation to reflect the new stack.

**Requirements:** R10, R12, R13

**Dependencies:** Unit 2

**Files:**
- Create: `public/staticwebapp.config.json`
- Modify: `AGENTS.md`

**Approach:**
- `public/staticwebapp.config.json`: set `navigationFallback.rewrite` to `/index.html` and `exclude` pattern for static assets (`/assets/*`, `/*.{png,jpg,gif,svg,ico,css,js,woff,woff2}`). Optionally add `globalHeaders` with `Cache-Control: no-cache` for the HTML document. Vite copies `public/` to `dist/` automatically — no build step needed.
- `AGENTS.md`: update the Stack section (Next.js 16 → Vite 8 + TanStack Router), update the Project Structure section (note `routes/` directory, `routeTree.gen.ts`), update commands (`npm run dev` now runs Vite, `npm run build` runs `tsc -b && vite build`, add `npm run preview`), remove the "SSR by default" convention, replace `NEXT_PUBLIC_API_URL` with `VITE_API_URL` in the API Patterns section, note `import.meta.env.VITE_*` for env var access

**Test expectation:** none — config and docs

**Verification:**
- `public/staticwebapp.config.json` exists and contains a valid `navigationFallback` block
- `AGENTS.md` has no references to Next.js, SSR default, or `NEXT_PUBLIC_*`

---

- [ ] **Unit 9: Final verification — build, test, lint, type-check**

**Goal:** Confirm all success criteria are met end-to-end.

**Requirements:** All (R1–R13), all success criteria

**Dependencies:** All prior units

**Files:**
- No new files; fix any issues found

**Approach:**
- Run `npm run test` — all Vitest tests must pass
- Run `npm run lint` — no ESLint errors
- Run `npx tsc --noEmit` — no TypeScript errors
- Run `npm run build` — must produce `dist/` with `index.html`, JS chunks, and `staticwebapp.config.json`
- Inspect `dist/` for `staticwebapp.config.json` presence (copied from `public/`)
- Manually test in browser via `npm run preview`: navigate to `/`, `/lobbies`, `/games/test-id`; confirm direct URL navigation works (SPA fallback); confirm no Next.js console errors

**Test scenarios:**
- Happy path: `npm run build` exits 0 and `dist/` contains `index.html`
- Happy path: `dist/staticwebapp.config.json` exists (confirms `public/` copy works)
- Happy path: `npm run preview` → navigate to `/games/fake-id` directly → app renders game route (not 404)
- Edge case: `npx tsc --noEmit` passes with no `next` type references remaining

**Verification:**
- All success criteria from the requirements doc are satisfied
- `grep -r "next" package.json` shows only `@types/node`, dev tooling — no `next` framework package

## System-Wide Impact

- **Interaction graph:** All routes and components are affected. The auth flow (`AuthProvider` → `RequireAuth` → protected routes) is preserved but the redirect mechanism changes from `next/navigation` to TanStack Router's `useNavigate`.
- **Error propagation:** `ErrorBoundary` in `app-shell.tsx` is unchanged — carries forward to the root route layout.
- **State lifecycle risks:** `routeTree.gen.ts` must be regenerated if new route files are added; committing it means the file can drift if contributors add routes without running the dev server. Add a note to `AGENTS.md`.
- **API surface parity:** `lib/api/client.ts` env var rename is the only API-adjacent change; the `apiFetch` function signature is unchanged.
- **Integration coverage:** Firebase Google sign-in popup must be tested in a real browser environment — Vitest/jsdom cannot test OAuth popup behavior. Mark as a manual verification step.
- **Unchanged invariants:** The backend API contract, all game logic, all component visual output, and Vitest test infrastructure are explicitly not changed by this migration.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `@tanstack/router-plugin` plugin order (must precede `react()`) | Documented in Unit 2; easy to catch during dev server startup |
| `routeTree.gen.ts` staleness in CI | Commit the generated file; `vite build` also invokes the plugin and regenerates it |
| Firebase authorized domains not updated after deployment | Documented as post-deploy manual step; add to `AGENTS.md` operational notes |
| ESLint rules gap after removing `eslint-config-next` | Addressed in Unit 7 by adding `eslint-plugin-react` + `eslint-plugin-react-hooks` |
| Font rendering regression after removing `next/font` | `@fontsource/geist` provides identical typefaces; verify visually in Unit 9 |
| `import.meta.env` not available in Vitest test files by default | Use `vi.stubEnv()` in test setup — standard Vitest pattern; addressed in Unit 5 |

## Documentation / Operational Notes

- After deployment to Azure Static Web Apps, add the deployment URL to the Firebase Console authorized domains list (Firebase Console → Authentication → Settings → Authorized domains). Without this step, Google sign-in will fail with `auth/unauthorized-domain`.
- `routeTree.gen.ts` is auto-generated by the TanStack Router Vite plugin. If a contributor adds a new route file, they must run `npm run dev` (or `npm run build`) before committing to regenerate the type tree.
- `VITE_*` env vars are inlined into the client bundle at build time. Firebase config values will be visible in the built JS — this is expected and correct. Firebase API keys are not secrets; security is enforced by Firebase security rules.

## Sources & References

- **Origin document:** [docs/brainstorms/vite-spa-migration-requirements.md](docs/brainstorms/vite-spa-migration-requirements.md)
- TanStack Router docs: https://tanstack.com/router/latest/docs/framework/react/routing/file-based-routing
- Vite docs: https://vite.dev/guide/
- Tailwind CSS v4 + Vite: https://tailwindcss.com/docs/installation/vite
- Azure Static Web Apps config: https://learn.microsoft.com/en-us/azure/static-web-apps/configuration
- `@fontsource/geist`: https://fontsource.org/fonts/geist
