---
title: "refactor: Move source files into src/ folder"
type: refactor
status: active
date: 2026-05-10
origin: docs/brainstorms/src-folder-migration-requirements.md
---

# refactor: Move source files into `src/` folder

## Overview

Move all application source code into a `src/` directory at the repo root, matching the standard Vite/React scaffold convention. Repoint the `@/*` path alias from `./*` to `./src/*` so existing imports continue to work unchanged. Update tooling configs and `AGENTS.md` to match.

## Problem Frame

Source code currently lives at the repo root alongside config files. This diverges from the standard Vite/React scaffold and visually mixes config with source. `AGENTS.md` also references an `app/` directory that does not exist — documentation drift to fix as part of this work. (See origin: `docs/brainstorms/src-folder-migration-requirements.md`.)

## Requirements Trace

- R1. All application source files live under `src/`; repo root contains only config, `index.html`, `public/`, `docs/`, `.github/`, `.infrastructure/`, `.context/`, and `AGENTS.md`.
- R2. `npm run dev`, `npm run build`, `npm run lint`, `npm test`, and `npx tsc --noEmit` all succeed against the new layout.
- R3. The built app is functionally identical — navigation between `/`, `/lobbies`, `/lobbies/new`, `/lobbies/$lobbyId`, and `/games/$gameId` works.
- R4. `AGENTS.md` accurately describes the new layout and contains no reference to a nonexistent `app/` directory.
- R5. The `@/*` import alias resolves to `src/*`, so the 141 existing `@/...` imports across the codebase continue to work without modification.

## Scope Boundaries

- No behavior changes — purely structural.
- No restructuring inside `src/` (folders move as-is).
- No changes to `public/`, `docs/`, `.github/`, or `.infrastructure/`.
- No changes to deployment configuration or `dist/` output structure.
- No new `app/` directory is being introduced; the stale reference in `AGENTS.md` is being removed, not materialized.
- The path alias name stays `@/`.

## Context & Research

### Relevant Code and Patterns

- `vite.config.ts:9-13` — TanStack Router plugin config (`routesDirectory`, `generatedRouteTree`, `routeFileIgnorePattern`).
- `vite.config.ts:17-21` — `@` alias resolution (currently `path.resolve(__dirname)`).
- `vite.config.ts:25-29` — Vitest config including `setupFiles: ["./vitest.setup.ts"]`.
- `tsconfig.json:17-19` — TypeScript path mapping for `@/*`.
- `index.html:10` — entry script reference `/main.tsx`.
- `eslint.config.mjs:40-46` — `globalIgnores` lists `routeTree.gen.ts` at the old path.
- `main.tsx` — relative imports (`./globals.css`, `./routeTree.gen.ts`) all live alongside `main.tsx` and move with it; no cross-boundary breakage from these.
- `.github/workflows/deploy.yaml:50` — uses `app_location: "."`, unaffected by source location.
- `.github/workflows/quality.yaml` — runs npm scripts only, unaffected.
- `.infrastructure/` — Terraform; no source path references (verified).

### Institutional Learnings

- `docs/brainstorms/vite-spa-migration-requirements.md` is prior art for how this project handled its last large structural refactor. Same pattern: minimize churn by moving cohesive groups together and updating tooling once.

## Key Technical Decisions

- **Repoint `@/*` to `src/*`, do not keep it at root.** This is the load-bearing decision. Without it, every one of the 141 `@/...` imports would need to change. With it, the diff is confined to tooling configs plus the file move itself.
- **Move `routeTree.gen.ts` into `src/` and let the TanStack Router plugin regenerate it there.** The file is generated, so deleting the old copy and reconfiguring `generatedRouteTree` is cleaner than moving it manually.
- **Move `vitest.setup.ts` into `src/`.** Treat it as test code colocated with source. Update `setupFiles` accordingly.
- **Use `**/routeTree.gen.ts` in `eslint.config.mjs` ignores rather than a path-specific entry.** Path-agnostic glob is more resilient to future structural changes and matches the spirit of "ignore the generated file wherever it lives."
- **`index.html` stays at the repo root** — Vite requires it there as the project root entry. The script tag becomes `src="/src/main.tsx"`.

## Open Questions

### Resolved During Planning

- Does TanStack Router work with `src/`? Yes — only `routesDirectory` config matters; the router has no opinion about source layout.
- Will any CI/infra config break? No — verified via grep across `.github/` and `.infrastructure/`. Workflows run npm scripts only.
- What about the 141 existing `@/...` imports? Unchanged because the alias is repointed.

### Deferred to Implementation

- Whether `git mv` produces the cleanest history for the directory moves vs. plain `mv` — implementer's choice. `git mv` is preferred for rename detection.

---

## Output Structure

The end-state repo root and `src/` directory:

    .
    ├── .context/
    ├── .env*
    ├── .github/
    ├── .gitignore
    ├── .infrastructure/
    ├── .nvmrc
    ├── AGENTS.md
    ├── docs/
    ├── eslint.config.mjs
    ├── index.html
    ├── package.json
    ├── package-lock.json
    ├── public/
    ├── src/
    │   ├── components/
    │   ├── globals.css
    │   ├── lib/
    │   ├── main.tsx
    │   ├── routes/
    │   ├── routeTree.gen.ts        (regenerated)
    │   ├── store/
    │   └── vitest.setup.ts
    ├── tsconfig.json
    └── vite.config.ts

---

## Implementation Units

- U1. **Create `src/` and move source files**

**Goal:** Physically relocate source files and directories into `src/`, removing the old `routeTree.gen.ts` so it regenerates at the new path.

**Requirements:** R1, R3, R5

**Dependencies:** None

**Files:**
- Create: `src/` directory
- Move (root → `src/`):
  - `main.tsx`
  - `globals.css`
  - `vitest.setup.ts`
  - `routes/` (entire directory, including `__root.tsx`, `index.tsx`, `games/$gameId.tsx`, `lobbies/index.tsx`, `lobbies/new.tsx`, `lobbies/$lobbyId.tsx`, and any `__tests__/` subfolders)
  - `components/` (entire directory)
  - `lib/` (entire directory)
  - `store/` (entire directory)
- Delete: `routeTree.gen.ts` at repo root (will regenerate at `src/routeTree.gen.ts` from the TanStack Router plugin on next dev/build)

**Approach:**
- Use `git mv` for the moves so git tracks them as renames rather than delete+add. This preserves blame and reduces diff noise.
- Move whole directories together so relative imports inside them stay valid.
- Do not edit any source file in this unit — the alias repoint in U2 is what makes existing `@/...` imports keep working. The relative imports inside `main.tsx` (`./globals.css`, `./routeTree.gen.ts`) remain valid because all three move together.
- Delete the old `routeTree.gen.ts` rather than moving it; the plugin reconfigured in U2 will regenerate it at `src/routeTree.gen.ts`.

**Patterns to follow:**
- Existing directory layout inside the source folders is preserved verbatim. No reorganization within `src/`.

**Test scenarios:** Test expectation: none — pure file-system move with no behavior change. Verification of correctness lives in U4.

**Verification:**
- `git status` shows the moves as renames, not delete+add pairs.
- Repo root no longer contains `main.tsx`, `globals.css`, `vitest.setup.ts`, `routeTree.gen.ts`, `routes/`, `components/`, `lib/`, or `store/`.
- `src/` contains all moved items plus subdirectories intact.

---

- U2. **Update tooling configuration**

**Goal:** Point Vite, TypeScript, ESLint, and `index.html` at the new `src/` layout. This is the unit that makes existing `@/...` imports keep working.

**Requirements:** R1, R2, R5

**Dependencies:** U1

**Files:**
- Modify: `vite.config.ts`
- Modify: `tsconfig.json`
- Modify: `index.html`
- Modify: `eslint.config.mjs`

**Approach:**
- `vite.config.ts`:
  - TanStack Router plugin: `routesDirectory: "./src/routes"`, `generatedRouteTree: "./src/routeTree.gen.ts"`. Leave `routeFileIgnorePattern` unchanged.
  - Resolve alias: `"@": path.resolve(__dirname, "src")`.
  - Vitest `setupFiles`: `["./src/vitest.setup.ts"]`.
- `tsconfig.json`:
  - `paths`: `{ "@/*": ["./src/*"] }`.
- `index.html`:
  - Script tag: `<script type="module" src="/src/main.tsx"></script>`.
- `eslint.config.mjs`:
  - In `globalIgnores`, replace `"routeTree.gen.ts"` with `"**/routeTree.gen.ts"` so the ignore stays correct regardless of file location.

**Patterns to follow:**
- Existing config style — keep the same property ordering and formatting.

**Test scenarios:** Test expectation: none — config-only changes. Behavior is verified end-to-end in U4.

**Verification:**
- `vite.config.ts` references only `./src/...` paths for source-related config.
- `tsconfig.json` `paths` resolves `@/*` to `./src/*`.
- `index.html` references `/src/main.tsx`.
- `eslint.config.mjs` uses `**/routeTree.gen.ts` in `globalIgnores`.

---

- U3. **Update AGENTS.md**

**Goal:** Document the new layout accurately and remove the stale `app/` reference.

**Requirements:** R4

**Dependencies:** U1, U2 (so the documented state matches reality)

**Files:**
- Modify: `AGENTS.md`

**Approach:**
- Rewrite the **Project Structure** section to reflect the `src/` layout. List `src/routes/`, `src/components/`, `src/lib/`, `src/store/`, `src/main.tsx`, `src/globals.css`, `src/vitest.setup.ts`, `src/routeTree.gen.ts`.
- Remove the `app/` bullet (page-level components, game-page, lobby-detail, `globals.css`) — that directory does not exist. If the stated intent (a page-level layer separate from `components/`) is still desired, it's a separate follow-up; do not invent it here.
- Update path alias note: `@/*` maps to `./src/*`.
- Update the `index.html` and `main.tsx` references to note their post-move locations (`index.html` at repo root; `main.tsx` at `src/main.tsx`).
- Keep all other sections (Stack, Commands, Conventions, API Patterns, Routing, Environment Variables, Testing, Operational Notes) unchanged unless they reference moved files.

**Patterns to follow:**
- Existing AGENTS.md voice and section structure.

**Test scenarios:** Test expectation: none — documentation change.

**Verification:**
- AGENTS.md contains no `app/` reference.
- Project Structure section enumerates the new `src/` layout.
- Path alias documentation reads `@/*` maps to `./src/*`.

---

- U4. **Verify the migration end-to-end**

**Goal:** Confirm the app builds, tests pass, lint passes, types check, and the dev server serves a working app at all routes.

**Requirements:** R2, R3

**Dependencies:** U1, U2, U3

**Files:**
- None modified. This unit is verification only.

**Approach:**
- Run each command listed in Verification below in order. Each must succeed before moving to the next.
- If any command fails, the failure points to a missed config update — fix in U2 (or U1 for missed file moves) and rerun.
- Manual smoke-test the dev server to confirm route navigation works, since lint/type-check/build do not exercise routing at runtime.

**Patterns to follow:**
- Standard project verification commands documented in `AGENTS.md` and `package.json`.

**Test scenarios:**
- Happy path: `npm run dev` starts, `/` renders, console shows no errors. Navigate to `/lobbies`, `/lobbies/new`, an existing `/lobbies/$lobbyId` route, and an existing `/games/$gameId` route — each renders.
- Happy path: `npm run build` produces `dist/index.html` and JS bundles; the bundled `index.html` references the new entry path correctly.
- Happy path: `npm run preview` serves the production build and `/` renders.
- Edge case: Confirm `src/routeTree.gen.ts` is regenerated by the TanStack Router plugin on first `npm run dev` (the deleted root copy stays gone).

**Verification:**
- `npx tsc --noEmit` reports no errors.
- `npm run lint` passes.
- `npm test` passes (all existing Vitest suites green).
- `npm run build` succeeds and `dist/` contains `index.html` plus bundled JS.
- `npm run dev` serves the app; manual navigation across the five route paths in R3 works without console errors.
- `src/routeTree.gen.ts` exists after running dev or build; root `routeTree.gen.ts` does not.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| TanStack Router plugin doesn't regenerate `routeTree.gen.ts` at the new path on first run | U4 explicitly checks for `src/routeTree.gen.ts` after running dev. If missing, run `npm run build` which forces regeneration; if still missing, the plugin config in `vite.config.ts` is wrong (U2). |
| A file uses a relative import that crosses the new `src/` boundary in some non-obvious way | `npx tsc --noEmit` (R2) catches this immediately since all 141 `@/...` imports plus relative imports are typechecked. The 141 alias-based imports are insulated by U2; only intra-source relative imports are at risk, and those all move together in U1. |
| `routeTree.gen.ts` ignore in ESLint stops working after move | U2 switches the ESLint ignore to the path-agnostic glob `**/routeTree.gen.ts`. Verified by running `npm run lint` in U4. |
| Editor or local tooling caches old paths (e.g., TS server, Vite dev cache) | After the move, restart the TS server / dev server. Not a code risk; flagged for the implementer's awareness. |

## Sources & References

- **Origin document:** `docs/brainstorms/src-folder-migration-requirements.md`
- Related code: `vite.config.ts`, `tsconfig.json`, `index.html`, `eslint.config.mjs`, `main.tsx`
- Related prior art: `docs/brainstorms/vite-spa-migration-requirements.md`
- TanStack Router file-based routing config: `routesDirectory` and `generatedRouteTree` plugin options used in `vite.config.ts:9-13`
