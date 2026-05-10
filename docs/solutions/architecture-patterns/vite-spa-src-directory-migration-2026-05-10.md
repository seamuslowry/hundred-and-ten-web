---
title: Migrating Source Files into src/ for Vite/React/TypeScript Projects
date: 2026-05-10
category: docs/solutions/architecture-patterns/
module: frontend
problem_type: architecture_pattern
component: tooling
severity: medium
applies_when:
  - A Vite/React/TypeScript project has source files living at the repo root alongside config files
  - The project already uses a @/* path alias (pointing to root or elsewhere)
  - You want to align with npm create vite conventions without rewriting existing imports
tags:
  - vite
  - tanstack-router
  - typescript
  - src-directory
  - path-alias
  - route-tree
  - project-structure
  - migration
---

# Migrating Source Files into `src/` for Vite/React/TypeScript Projects

## Context

Vite scaffolds (`npm create vite`) place all source code under `src/` by default. Projects that diverge from this convention — keeping `routes/`, `components/`, `lib/`, `store/`, `main.tsx`, etc. at the repo root alongside config files — create visual noise, confuse newcomers, and drift from tooling documentation expectations.

This pattern documents the canonical migration from a flat root layout to a `src/`-conventional layout for a project using Vite, React, TypeScript, TanStack Router, Vitest, and ESLint flat config.

## Guidance

### The Load-Bearing Decision: Repoint `@/*` to `./src/*`

The entire migration pivots on changing the `@` alias from the repo root to `src/`. Because all existing imports use `@/components/...`, `@/lib/...`, `@/store/...` etc., repointing the alias means **zero import edits** across the codebase — only 4 config files change.

### Config Changes

**`vite.config.ts`**

```typescript
// Before
tanstackRouter({
  routesDirectory: "./routes",
  generatedRouteTree: "./routeTree.gen.ts",
  routeFileIgnorePattern: ".test.tsx",
}),
resolve: {
  alias: {
    "@": path.resolve(__dirname),
  },
},
test: {
  setupFiles: ["./vitest.setup.ts"],
},

// After
tanstackRouter({
  routesDirectory: "./src/routes",
  generatedRouteTree: "./src/routeTree.gen.ts",
  routeFileIgnorePattern: ".test.tsx",
}),
resolve: {
  alias: {
    "@": path.resolve(__dirname, "src"),
  },
},
test: {
  setupFiles: ["./src/vitest.setup.ts"],
},
```

**`tsconfig.json`**

```json
// Before
"paths": { "@/*": ["./*"] }

// After
"paths": { "@/*": ["./src/*"] }
```

**`index.html`** (stays at repo root — Vite requires it there as the project entry)

```html
<!-- Before -->
<script type="module" src="/main.tsx"></script>

<!-- After -->
<script type="module" src="/src/main.tsx"></script>
```

**`eslint.config.mjs`** (globalIgnores)

```js
// Before
"routeTree.gen.ts",

// After
"**/routeTree.gen.ts",
```

The path-agnostic glob is needed because the generated file is now nested under `src/`, not at root. See also `docs/solutions/developer-experience/eslint-fix-hang-missing-globalignores-2026-04-25.md` — `globalIgnores` must explicitly declare all excluded paths in ESLint flat config.

### File Moves

Use `git mv` to preserve rename history and keep the diff clean:

```bash
git mv main.tsx src/main.tsx
git mv globals.css src/globals.css
git mv vitest.setup.ts src/vitest.setup.ts
git mv routes src/routes
git mv components src/components
git mv lib src/lib
git mv store src/store
```

Delete the old `routeTree.gen.ts` at root — the TanStack Router Vite plugin regenerates it at `src/routeTree.gen.ts` on the next build. Do not `git mv` it; the plugin output is the source of truth.

### What Stays at Root

`index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`, `eslint.config.mjs`, `.env*`, `.nvmrc`, `public/`, `docs/`, `.github/`, `.infrastructure/`

### TanStack Router First-Build Ordering Gotcha

`npm run build` runs `tsc -b && vite build`. TypeScript (`tsc`) runs **before** Vite, so on the first post-migration build `src/routeTree.gen.ts` does not exist yet. `tsc` fails because `src/main.tsx` imports `./routeTree.gen` and the file is missing.

Fix: run `npx vite build` standalone first. This triggers the TanStack Router Vite plugin, which regenerates the route tree at its new location. Then `npm run build` passes cleanly.

```bash
npx vite build    # generates src/routeTree.gen.ts at the new location
npm run build     # tsc now finds the file; full build succeeds
```

## Why This Matters

**Convention alignment** — Matches `npm create vite` defaults. Tooling docs, Stack Overflow answers, and AI assistants all assume `src/`. Staying aligned reduces friction for new contributors and tools.

**Import insulation via alias repoint** — Repointing `@/*` to `./src/*` rather than updating imports individually means the alias acts as a stable contract. The entire migration churn is confined to 4 config files. Any future structural changes inside `src/` only require alias-level updates, not import churn across the codebase.

**Config/source separation** — Root becomes config-only (`vite.config.ts`, `tsconfig.json`, `index.html`, etc.). `src/` becomes source-only. The distinction is immediately legible to new contributors.

## When to Apply

- A Vite/React/TypeScript project has source files living at the repo root alongside config files
- The project already uses a `@/*` path alias (whether pointing to root or elsewhere)
- You want to align with `npm create vite` conventions without rewriting existing imports
- Not needed if the project was scaffolded conventionally and already has a `src/` layout

## Examples

The complete before/after change surface for a project with 141 `@/...` imports:

| File | Change |
|------|--------|
| `vite.config.ts` | 4 path strings updated + alias target changed to `path.resolve(__dirname, "src")` |
| `tsconfig.json` | 1 paths entry: `"./*"` → `"./src/*"` |
| `index.html` | 1 script src: `/main.tsx` → `/src/main.tsx` |
| `eslint.config.mjs` | 1 ignore glob: `"routeTree.gen.ts"` → `"**/routeTree.gen.ts"` |
| All 141 `@/...` imports | **Zero changes** |

## Related

- `docs/solutions/developer-experience/eslint-fix-hang-missing-globalignores-2026-04-25.md` — `globalIgnores` baseline for this project; glob must match wherever TanStack Router writes `routeTree.gen.ts`
- TanStack Router `routesDirectory` and `generatedRouteTree` config in `vite.config.ts`
- Vite `resolve.alias` and `tsconfig.json` `paths` must stay in sync; a mismatch causes VS Code to resolve correctly while the build fails (or vice versa)
