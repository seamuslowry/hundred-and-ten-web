---
title: ESLint hangs indefinitely when non-source directories are missing from globalIgnores
date: 2026-04-25
category: developer-experience
module: tooling
problem_type: developer_experience
component: tooling
severity: high
root_cause: config_error
resolution_type: config_change
symptoms:
  - "npm run lint or npm run lint:fix hangs indefinitely at 100–130% CPU and never completes"
  - "ESLint process must be force-killed; no output or error is produced"
  - "Running with --debug shows ESLint traversing non-source directories (e.g. .infrastructure/.terraform)"
applies_when:
  - using ESLint 9 flat config (eslint.config.mjs) with eslint --fix .
  - repo contains non-source directories with large or binary files not covered by globalIgnores
  - migrating from ESLint 8 where .eslintignore or .gitignore handled exclusions
tags:
  - eslint
  - eslint-9
  - flat-config
  - globalignores
  - terraform
  - hang
  - developer-experience
---

# ESLint hangs indefinitely when non-source directories are missing from globalIgnores

## Problem

`npm run lint:fix` (and `npm run lint`) hangs at 100–130% CPU and never completes. ESLint 9 flat config, when invoked with `eslint .`, traverses the entire working directory — including directories like `.infrastructure/.terraform/` that contain large or binary files. Running `eslint-plugin-prettier` against a 229 MB Terraform provider binary (`terraform-provider-azurerm`) causes the process to stall permanently with no error output.

## Symptoms

- `npm run lint` or `npm run lint:fix` runs at >100% CPU indefinitely with no output
- Process must be killed manually (`Ctrl+C` or `kill <pid>`)
- Running `eslint --debug . 2>&1 | head -100` shows ESLint calculating config for files inside `.infrastructure/.terraform/providers/`
- The hang happens before any lint output is produced

## What Didn't Work

- Looking for `.eslintignore` — there is none, and ESLint 9 flat config silently ignores it even if one exists
- Assuming ESLint respects `.gitignore` — ESLint 9 dropped automatic `.gitignore` consultation; `.terraform` appears in `.gitignore` but ESLint never reads it
- Assuming hidden/dotfile directories are skipped — ESLint 9 only auto-ignores `node_modules/` and `.git/`; all other paths must be declared explicitly

## Solution

Add the non-source directory to the `globalIgnores` call in `eslint.config.mjs`:

```js
// eslint.config.mjs — before
globalIgnores(["dist/**", "out/**", "build/**", "routeTree.gen.ts"])

// eslint.config.mjs — after
globalIgnores([
  "dist/**",
  "out/**",
  "build/**",
  "routeTree.gen.ts",
  ".infrastructure/**",  // Terraform state + provider cache (up to 253 MB of binaries)
])
```

After this change, `npm run lint` completes in seconds.

**Diagnosing which paths are causing the hang:**

```bash
# Shows what ESLint is traversing — any non-source path appearing here needs a globalIgnores entry
eslint --debug . 2>&1 | head -100
```

## Why This Works

ESLint 9 flat config's `globalIgnores()` is the only mechanism for excluding paths from file traversal. Unlike ESLint 8, which auto-loaded `.eslintignore` and could optionally respect `.gitignore`, ESLint 9 has exactly three built-in ignores: `node_modules/`, `.git/`, and the config file itself. Everything else — Terraform directories, build tool caches, IDE folders — must be declared explicitly.

When `eslint .` runs without ignoring `.infrastructure/`, it recurses into `.terraform/providers/.../linux_amd64/` and queues `terraform-provider-azurerm` (229 MB ELF binary) for linting. The `eslint-plugin-prettier` rule invokes Prettier, which attempts to read and parse the entire binary into memory. Node.js uses worker threads for ESLint's parallel file processing, so two threads peg the CPU (hence >100%) with no forward progress and no error output.

## Prevention

1. **Keep `globalIgnores` up to date** after any `tofu init` / `terraform init` that downloads provider binaries — the `.terraform/` provider cache can grow to hundreds of MB and is not auto-excluded.

2. **Baseline `globalIgnores` for this project type** — any Vite + Terraform repo should have at minimum:
   ```js
   globalIgnores([
     "dist/**",
     "out/**",
     "build/**",
     "routeTree.gen.ts",       // TanStack Router generated file
     ".infrastructure/**",     // Terraform state, plans, and provider cache
   ])
   ```

3. **When migrating from ESLint 8 to 9** — audit your old `.eslintignore` and port every entry to `globalIgnores`. The `.eslintignore` file is silently ignored in ESLint 9 with no warning.

4. **Diagnosing future hangs** — if `npm run lint` hangs again, the first step is:
   ```bash
   eslint --debug . 2>&1 | head -100
   ```
   Any non-source path appearing in the debug output needs a `globalIgnores` entry.

## Related Issues

- No related GitHub issues found for this repo
- ESLint 9 migration guide: https://eslint.org/docs/latest/use/migrate-to-9.0.0 (see "Ignored Files" section)
