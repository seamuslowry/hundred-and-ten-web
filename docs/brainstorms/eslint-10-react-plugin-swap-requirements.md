# ESLint 10 upgrade: swap `eslint-plugin-react` for `@eslint-react/eslint-plugin`

**Status:** Requirements drafted
**Date:** 2026-05-09
**Tracks issue:** #38

## Problem

The repo is pinned to ESLint 9 because `eslint-plugin-react@7.37.5` declares `eslint: ^3 || ... || ^9.7` as its peer dependency and shows no signs of adding ESLint 10 support. ESLint 10.3.0 is current. Staying on ESLint 9 means we miss security and bug-fix releases on the rest of the lint toolchain and accumulate drift against the wider ecosystem (most other plugins already support ESLint 10).

## Goal

Unblock the ESLint 10 upgrade by replacing `eslint-plugin-react` with `@eslint-react/eslint-plugin`, an actively maintained plugin built for ESLint 10. Preserve approximately equivalent React-specific lint coverage. Land the change as a single, small PR.

## Non-goals

- Enabling typed linting (`parserOptions.project`). The `recommended` preset does not require it, and turning it on would expand scope materially and slow lint runs.
- Tightening lint rules beyond what the new plugin's `recommended` preset provides. Rule-tuning beyond preset defaults is a separate conversation.
- Bumping unrelated dev dependencies. `@typescript-eslint/*`, `eslint-plugin-react-hooks`, `eslint-plugin-prettier`, and `eslint-config-prettier` already support ESLint 10 and stay as-is.
- Resolving the parallel `typescript@^6` vs `@typescript-eslint`'s `typescript: <6.1.0` peer-dep range. Note it, leave it alone.

## Decision

**Swap `eslint-plugin-react` for `@eslint-react/eslint-plugin` using the `recommended` preset.** Bump `eslint` from `^9` to `^10`.

Rationale:
- It's the alternative nominated in issue #38, is actively maintained, and explicitly targets ESLint 10.
- The `recommended` preset preserves the React-specific signal that `eslint-plugin-react:recommended` provided today (e.g., `jsx-key`, `jsx-no-target-blank`, hook-adjacent JSX correctness) without requiring typed linting.
- Other plugins in `eslint.config.mjs` already work on ESLint 10, so the diff stays narrow.

## Scope

### In scope

- Update `package.json`:
  - Remove `eslint-plugin-react`.
  - Add `@eslint-react/eslint-plugin` (current: `^5.7.5`).
  - Bump `eslint` from `^9` to `^10`.
- Update `eslint.config.mjs`:
  - Replace the `eslint-plugin-react` import and registration with `@eslint-react/eslint-plugin`.
  - Replace `...react.configs.recommended.rules` with the equivalent `recommended` preset spread from `@eslint-react`.
  - Drop `react/react-in-jsx-scope` override (the new plugin doesn't include that rule).
  - Drop the `settings: { react: { version: 'detect' } }` block (not used by `@eslint-react`).
  - Keep `eslint-plugin-react-hooks`, `@typescript-eslint`, and `prettier` configuration unchanged.
- Run `npm run lint` and resolve resulting violations. The expected delta is small: rule names change (`@eslint-react/...` instead of `react/...`), so any existing inline disables referencing `react/*` rules need updating or removing.

### Out of scope (deferred)

- Migrating to typed linting or any `recommended-typescript` / `recommended-type-checked` preset.
- Adding new rule categories (a11y, import ordering, perf, etc.).
- Updating `@typescript-eslint/*` to track the latest TS peer-dep window.

## Success criteria

- `npm run lint` passes on `main` post-merge with no remaining `eslint-plugin-react` references.
- `npm run build` continues to succeed.
- `package.json` shows `eslint: ^10`, no `eslint-plugin-react`, and `@eslint-react/eslint-plugin` present.
- `eslint.config.mjs` no longer imports `eslint-plugin-react`.
- Issue #38 is closed by the resulting PR.

## Risks and assumptions

- **Rule coverage drift:** `@eslint-react`'s `recommended` is *similar to* but not identical to `eslint-plugin-react:recommended`. Some rules will appear that didn't fire before, and vice versa. Acceptable — the goal is "approximately equivalent React-specific signal," not bit-for-bit parity.
- **Inline disables:** Any `// eslint-disable-next-line react/...` comments in the codebase will become unknown-rule warnings under the new plugin. They need to be either renamed to the `@eslint-react/...` equivalent or removed if the rule no longer exists. This is the most likely source of churn; expect to handle a small number of these by hand.
- **Assumption (unverified):** No CI workflow, editor config, or pre-commit hook elsewhere in the repo pins `eslint@9` separately from `package.json`. If something does, that surfaces during implementation, not now.
- **Parallel constraint, not blocker:** `@typescript-eslint@8.59.2` declares `typescript: >=4.8.4 <6.1.0` and the repo runs `typescript@^6`. This is a pre-existing condition; the swap doesn't change it. Worth a separate ticket.

## References

- Issue #38: https://github.com/seamus-pinney/hundred-and-ten-web/issues/38
- `@eslint-react/eslint-plugin`: https://eslint-react.xyz
- Files affected: `package.json`, `eslint.config.mjs`, plus any source files with `react/*` inline disable comments.
