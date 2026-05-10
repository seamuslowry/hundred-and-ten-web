# Move Source Files Into `src/` Folder

**Status:** Requirements
**Date:** 2026-05-10
**Scope:** Lightweight (mechanical refactor, low ambiguity)

## Problem

The repo currently keeps all source code at the repository root alongside config files. `main.tsx`, `globals.css`, `routeTree.gen.ts`, and the source directories `routes/`, `components/`, `lib/`, and `store/` sit next to `vite.config.ts`, `tsconfig.json`, `package.json`, `eslint.config.mjs`, `index.html`, etc.

This works, but:

- It diverges from the standard Vite/React scaffold (`npm create vite` produces `src/`), so newcomers have to learn a non-standard layout.
- The repo root is crowded — config and source are visually mixed, which makes it harder to scan what kind of file is what.

`AGENTS.md` also references an `app/` directory that does not exist in the codebase, indicating the documented structure has already drifted from reality. This refactor is the right moment to fix that drift.

## Goal

Move all application source code into a `src/` directory at the repo root, matching the standard Vite/React convention, and update tooling and docs to match. End state should be visually indistinguishable from a project scaffolded with `npm create vite` (plus our additions).

## Non-Goals

- No behavior changes. The built app must be functionally identical before and after.
- No restructuring within `src/` (folders move as-is; we are not renaming `lib/` to `services/` or similar).
- No changes to `public/`, `docs/`, `.github/`, or `.infrastructure/`.
- No changes to the build output (`dist/`) or deployment configuration.
- We are not introducing a new `app/` directory. The `app/` reference in `AGENTS.md` is documentation drift to be removed, not a structure to materialize.

## Approach

**Repoint the `@/*` path alias to `src/*`** rather than keeping it at the repo root. This is the key decision: with the alias repointed, all 141 existing `@/...` imports across the codebase keep working unchanged. Only the alias config and a handful of root-relative paths in tooling need to change.

This works cleanly with TanStack Router. The router's file-based routing is configured by `routesDirectory` in `vite.config.ts`; pointing it at `./src/routes` is the only router-specific change needed.

## What Moves Into `src/`

- `main.tsx`
- `globals.css`
- `routeTree.gen.ts` (regenerated to its new location by the TanStack Router plugin)
- `routes/`
- `components/`
- `lib/`
- `store/`
- `vitest.setup.ts`

## What Stays At Repo Root

- `index.html` (Vite requires it at the project root)
- All config: `vite.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, `package-lock.json`, `.env*`, `.nvmrc`, `.gitignore`
- `public/` (Vite's static asset directory)
- `docs/`, `.github/`, `.infrastructure/`, `.context/`
- `AGENTS.md`

## Configuration Changes (Subject of the Brainstorm)

These are tooling decisions, not implementation details — they define what "moved to `src/`" means and need to be settled in this document.

- **`vite.config.ts`:**
  - TanStack Router plugin: `routesDirectory: "./src/routes"`, `generatedRouteTree: "./src/routeTree.gen.ts"`
  - Resolve alias: `"@"` → `path.resolve(__dirname, "src")`
  - Vitest `setupFiles`: `["./src/vitest.setup.ts"]`
- **`tsconfig.json`:**
  - `paths`: `{ "@/*": ["./src/*"] }`
- **`index.html`:**
  - Script tag: `src="/src/main.tsx"`
- **`AGENTS.md`:**
  - Update Project Structure section to reflect the `src/` layout
  - Remove the stale `app/` reference
  - Update the path alias note: "`@/*` maps to `./src/*`"

## Success Criteria

1. `npm run dev` starts the dev server and the app renders at `/` with no console errors.
2. `npm run build` produces a `dist/` directory with `index.html` and the same bundle structure as before.
3. `npm run lint` passes.
4. `npm test` passes (all existing Vitest suites green).
5. `npx tsc --noEmit` reports no errors.
6. Navigation between `/`, `/lobbies`, `/lobbies/new`, `/lobbies/$lobbyId`, and `/games/$gameId` works.
7. Repo root no longer contains `main.tsx`, `globals.css`, `routeTree.gen.ts`, `vitest.setup.ts`, `routes/`, `components/`, `lib/`, or `store/`.
8. `AGENTS.md` describes the new layout accurately and contains no references to a non-existent `app/` directory.

## Risks & Mitigations

- **Risk:** Hidden imports using relative paths that cross the new `src/` boundary break.
  - **Mitigation:** Move all source folders together in one step. Run `npx tsc --noEmit` and the test suite after the move; both will surface broken imports.
- **Risk:** TanStack Router's generated `routeTree.gen.ts` is regenerated at the wrong location or stale copies are committed.
  - **Mitigation:** Delete the old `routeTree.gen.ts` at root as part of the move; let the plugin regenerate at `src/routeTree.gen.ts` on first `npm run dev` or `npm run build`.
- **Risk:** `index.html` script path is wrong, producing a blank page on dev/build.
  - **Mitigation:** Verify the dev server loads the app and the production build's `index.html` references the bundled entry correctly.
- **Risk:** CI or deployment scripts hardcode root-relative paths to source files.
  - **Mitigation:** Grep `.github/` and `.infrastructure/` for references to the moved files before completing the migration. (Verified during planning.)

## Dependencies / Assumptions

- Assumes TanStack Router's `routesDirectory` config is the only router-specific path coupling. Verified: the router has no opinion about source layout beyond this config option.
- Assumes Vite supports the `index.html` → `/src/main.tsx` script reference, which is the documented Vite scaffold pattern.
- Assumes no external tooling (deployment, CI, editor configs) depends on root-level paths to the moved files. To be verified in planning by grepping `.github/` and `.infrastructure/`.

## Out of Scope / Deferred

- Renaming or reorganizing folders inside `src/` (e.g., colocating tests, splitting `lib/`).
- Introducing a separate `tests/` directory.
- Any change to the path alias name (keeping `@/`).
- Materializing the `app/` page-level concept that `AGENTS.md` currently mentions but does not exist.
