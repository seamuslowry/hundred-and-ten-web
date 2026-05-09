---
title: Replacing eslint-plugin-react with @eslint-react/eslint-plugin for ESLint 10
date: 2026-05-09
category: docs/solutions/tooling-decisions
module: eslint
problem_type: tooling_decision
component: development_workflow
severity: medium
applies_when:
  - Upgrading ESLint from v9 to v10 in a Vite + React + TypeScript project
  - Using ESLint flat config (eslint.config.mjs)
  - Currently depending on eslint-plugin-react v7.x
symptoms:
  - "npm install reports eslint-plugin-react peer dep unsatisfied for eslint@^10"
  - "eslint-plugin-react@7.x peer dep range caps at eslint ^9.7 — no v10 support"
resolution_type: dependency_update
tags:
  - eslint
  - eslint-plugin-react
  - eslint-react
  - flat-config
  - vite
  - react
  - typescript
  - dependency-upgrade
---

# Replacing eslint-plugin-react with @eslint-react/eslint-plugin for ESLint 10

## Context

`eslint-plugin-react@7.x` caps its ESLint peer dependency at `^9.7` with no ESLint 10 support planned. It is the sole blocker for upgrading from ESLint 9 to ESLint 10 in a Vite + React + TypeScript flat-config project — all other common plugins (`eslint-plugin-react-hooks`, `@typescript-eslint/*`, `eslint-plugin-prettier`, `eslint-config-prettier`) already support ESLint 10.

`@eslint-react/eslint-plugin` is the actively maintained successor built for ESLint 10 (`eslint: ^10.3.0` peer dep). It preserves React-specific lint signal that relying on `react-hooks` + TypeScript alone would lose — notably `no-array-index-key` and `jsx-no-target-blank`.

## Guidance

### 1. Install in the correct order

Peer dep resolution fails if you install `@eslint-react/eslint-plugin` before ESLint 10 is present. The required sequence:

```bash
# Step 1: bump ESLint first
npm install --save-dev eslint@^10

# Step 2: remove the old plugin
npm uninstall eslint-plugin-react

# Step 3: install the new plugin
npm install --save-dev @eslint-react/eslint-plugin
```

### 2. Choose a preset

At `@eslint-react/eslint-plugin@5.7.5`, `recommended` and `recommended-typescript` have identical rule sets. The only practical difference is that `recommended-typescript` adds `settings["react-x"]` for version/import detection, which the `recommended` preset also auto-injects.

| Preset | Peer deps | Key difference |
|---|---|---|
| `recommended` | `eslint ^10.3.0` | Starting point; no typed linting required |
| `recommended-typescript` | + `typescript` | Same rules; explicit `settings["react-x"]` block |
| `recommended-type-checked` | + `parserOptions.project` | Adds `no-leaked-conditional-rendering`; requires typed linting (slower) |

For a minimal-diff migration, `recommended` is the right choice.

### 3. Update `eslint.config.mjs`

The new plugin uses `extends` (flat config preset injection). The preset self-registers under `@eslint-react/` — do not re-add it under `plugins:`.

**Before:**
```js
import react from "eslint-plugin-react";

// inside defineConfig block:
plugins: {
  react,
  "react-hooks": reactHooks,
  "@typescript-eslint": tseslint,
  prettier,
},
settings: {
  react: { version: "detect" },
},
rules: {
  ...react.configs.recommended.rules,
  ...reactHooks.configs.recommended.rules,
  ...tseslint.configs.recommended.rules,
  "react/react-in-jsx-scope": "off",
  "prettier/prettier": "error",
},
```

**After:**
```js
import eslintReact from "@eslint-react/eslint-plugin";

// inside defineConfig block:
extends: [eslintReact.configs.recommended],
plugins: {
  "react-hooks": reactHooks,   // still registered manually — see note below
  "@typescript-eslint": tseslint,
  prettier,
},
rules: {
  ...reactHooks.configs.recommended.rules,
  ...tseslint.configs.recommended.rules,
  "prettier/prettier": "error",
},
```

Three things to drop from the old config:
- `react` from `plugins:` — the preset self-registers its plugin object
- `settings.react.version: "detect"` — `@eslint-react` uses `settings["react-x"]` instead, which the preset auto-injects. Only add it manually to override the detected version.
- `"react/react-in-jsx-scope": "off"` — rule does not exist in the new plugin (JSX transform assumed)

`react-hooks` still requires manual registration under `plugins:` because `eslint-plugin-react-hooks@7.x` declares its namespace as a string in its config rather than self-registering the plugin object — the consumer must supply the plugin object explicitly.

### 4. Check for inline disables

If the codebase has `// eslint-disable-next-line react/...` comments, they become unknown-rule warnings after the swap because the rule namespace changes from `react/` to `@eslint-react/`. Grep for `eslint-disable.*react/` before migrating. (In this project there were none.)

## Examples

Post-swap `npm run lint` output (0 errors, 8 pre-existing warnings — all from latent issues in the codebase):

```
components/game/bid-history-panel.tsx
  26:20  warning  Do not use item index in the array as its key  @eslint-react/no-array-index-key

components/game/round-history.tsx
  14:63  warning  To prevent re-computation, consider using lazy initial state  @eslint-react/use-state

✖ 8 problems (0 errors, 8 warnings)
```

These warnings (6x `no-array-index-key`, 2x `use-state` lazy-init) were not surfaced by `eslint-plugin-react`. Build and test suite unaffected.

## Related

- GitHub issue #38 — "try different eslint plugin" (closed by PR #40)
- [ESLint hangs with missing globalIgnores](../developer-experience/eslint-fix-hang-missing-globalignores-2026-04-25.md) — ESLint flat config baseline for this repo
- [`@eslint-react/eslint-plugin` on npm](https://www.npmjs.com/package/@eslint-react/eslint-plugin)
