---
date: 2026-04-21
topic: vite-spa-migration
---

# Migrate from Next.js to Vite SPA (Azure Static Web Apps)

## Problem Frame

The app is currently built with Next.js 16 in SSR mode, which requires a running Node.js server at deploy time. Hosting this on Azure (the existing platform for the project) would incur continuous server costs even when no users are active. The goal is to eliminate the idle-cost problem by targeting Azure Static Web Apps, which scales to zero and has a free tier.

The app is already functionally a client-side SPA: all pages use `"use client"` components, there are no API routes, no server actions, and no static param generation. The Next.js server layer adds no user-facing value. However, dynamic routes (e.g. `/games/:gameId`, `/lobbies/:lobbyId`) use runtime-generated IDs that are not known at build time. While Next.js `output: 'export'` with a catch-all route and client-side redirect is technically possible, it was evaluated and rejected in favor of a clean migration — the workaround adds ongoing complexity, fights the framework, and provides no long-term benefit over a proper SPA build.

The migration replaces Next.js with Vite and TanStack Router, and includes a cleanup pass to remove patterns and conventions that were Next.js-specific.

## Requirements

**Framework Replacement**
- R1. Replace Next.js with Vite as the build tool and dev server.
- R1a. A root `index.html` entry point must be created as the Vite SPA entry, replacing Next.js's implicit HTML generation.
- R1b. A `vite.config.ts` must be created configuring the React plugin, the `@/*` path alias, and the static build output directory.
- R2. Replace Next.js App Router with TanStack Router for all client-side routing, using **file-based routing** with `@tanstack/router-plugin/vite`. Route files live in a `routes/` directory; TanStack Router generates `routeTree.gen.ts` at build time.
- R3. The build output must be a fully static bundle (HTML + JS + CSS assets) that can be served from a CDN or static host with no Node.js runtime.
- R4. Dynamic route segments (`:gameId`, `:lobbyId`) must resolve client-side at runtime without requiring build-time enumeration.
- R5. The `@/*` path alias must continue to resolve to the repo root.
- R6. The `NEXT_PUBLIC_API_URL` environment variable must be replaced with a Vite-compatible equivalent (`VITE_API_URL`), and all references updated throughout the codebase.

**Auth**
- R7. Firebase authentication (Google sign-in) must continue to work unchanged. Auth is entirely client-side and has no dependency on Next.js server features.
- R7a. The Azure Static Web Apps deployment URL must be added to the Firebase Console's authorized domains list before production sign-in will work. This is a post-deployment manual step.

**Styles**
- R8. The Tailwind CSS v4 / `@tailwindcss/postcss` build pipeline must be verified compatible with Vite and configured explicitly in `postcss.config.js` (Next.js previously handled this implicitly).

**Cleanup**
- R9. Remove all Next.js-specific patterns: `"use client"` directives, `next/link`, `next/navigation` imports, and any layout/page file conventions that are no longer applicable.
- R10. Update `AGENTS.md` to reflect the new stack: remove the SSR-default convention, update the commands section (dev/build/lint/test), document the Vite env var convention (`VITE_*` prefix), and reference TanStack Router instead of Next.js App Router.
- R11. Remove Next.js, its config (`next.config.ts`), and all unused Next.js dependencies from `package.json`.

**Deployment**
- R12. The project must be deployable to Azure Static Web Apps using the static bundle output.
- R13. A `staticwebapp.config.json` must be added to configure Azure Static Web Apps to serve the SPA fallback (redirect all non-asset paths to `index.html`) so client-side routing works on direct navigation and refresh.

## Success Criteria
- `npm run build` produces a static bundle with no Node.js server requirement.
- All existing routes (`/`, `/lobbies`, `/lobbies/new`, `/lobbies/:lobbyId`, `/games/:gameId`) render correctly in the built output.
- Direct navigation to a dynamic route (e.g. typing `/games/some-id` in the browser) works correctly after deployment to Azure Static Web Apps.
- Firebase Google sign-in works in the production build.
- `npm run dev` starts a local dev server with hot module replacement.
- No Next.js packages remain in `package.json`.
- No references to `NEXT_PUBLIC_API_URL` remain in the codebase.
- `npm run test` (Vitest) passes with no regressions.
- `npm run lint` and `npx tsc --noEmit` pass with no errors after migration.

## Scope Boundaries
- Deployment automation (CI/CD pipeline, GitHub Actions, Azure resource provisioning) is out of scope. This migration produces the deployable artifact; the pipeline can be added later.
- No changes to game logic, UI components, or API integration patterns beyond what is required to remove Next.js dependencies — except documentation updates required by the stack change (R10).
- No changes to the backend or API contract.
- Testing infrastructure (Vitest) is retained as-is; if it has a hard dependency on Next.js, only the minimal detachment change is in scope (see Outstanding Questions).
- The Next.js branch is retained until the Vite SPA passes all success criteria; no rollback strategy is needed beyond this.

## Key Decisions
- **TanStack Router over React Router v7**: User preference; type-safe route params are a good fit for this app's dynamic segments.
- **File-based routing (not code-based)**: Preferred for new projects per TanStack Router docs; files define routes, better scales as the app grows, better tooling support. Requires `@tanstack/router-plugin/vite` and a generated `routeTree.gen.ts`.
- **Vite over other bundlers**: De facto standard for React SPAs; fast DX, broad ecosystem, native static output.
- **Azure Static Web Apps as target**: Scales to zero, free tier available, consistent with existing Azure hosting.
- **Rejected `output: 'export'` in Next.js**: The catch-all + client-redirect workaround is technically feasible but adds ongoing complexity that fights the framework. A clean Vite migration has lower carrying cost.

## Dependencies / Assumptions
- The backend API at `VITE_API_URL` is already deployed and has no coupling to the Next.js frontend.
- Firebase config values will be inlined into the client bundle by Vite. This is expected — Firebase API keys are not secrets; security is enforced by Firebase security rules, not key secrecy.
- Firebase project configuration (API key, auth domain, etc.) is passed via environment variables and does not change — only the authorized domains list in the Firebase Console requires a manual update post-deployment.
- Vitest does not depend on Next.js internals (unverified — should be confirmed during planning).
- TanStack Router version compatibility with React 19 must be confirmed during planning; pin to a version with confirmed React 19 support.

## Outstanding Questions

### Resolve Before Planning
_(none)_

### Deferred to Planning
- [Affects R7][Needs research] Confirm TanStack Router version with confirmed React 19 support and pin accordingly.
- [Affects R7][Needs research] Confirm that the Firebase SDK initialization pattern works identically in a Vite app without any Next.js-specific wrapper.
- [Affects R8][Technical] Confirm Tailwind CSS v4 / `@tailwindcss/postcss` works with Vite and determine the correct PostCSS config.
- [Affects R9][Technical] Identify whether any component uses `next/image` or other Next.js-specific built-ins that need a Vite-compatible replacement.
- [Affects R11][Technical] Confirm Vitest has no hard dependency on Next.js transform/config; if it does, determine the minimal change to detach it.
- [Affects R12][Needs research] Confirm the exact Azure Static Web Apps build configuration for a Vite SPA (artifact location, app location settings).

## Next Steps
-> `/ce:plan` for structured implementation planning
