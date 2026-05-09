---
title: "fix: Address 8 ESLint warnings exposed by @eslint-react upgrade"
type: fix
status: active
date: 2026-05-09
---

# fix: Address 8 ESLint warnings exposed by @eslint-react upgrade

## Overview

Resolve all 8 lint warnings currently emitted by `npm run lint`. These are latent issues surfaced (not introduced) by the recent migration from `eslint-plugin-react` to `@eslint-react/eslint-plugin` for ESLint 10 compatibility. Goal: bring the project to a clean lint baseline (0 warnings, 0 errors) so future lint output is signal, not noise.

## Problem Frame

After the ESLint 10 + `@eslint-react/eslint-plugin` upgrade (see `docs/solutions/tooling-decisions/eslint-plugin-react-to-eslint-react-upgrade-2026-05-09.md`), `npm run lint` reports 0 errors and 8 warnings:

- 6× `@eslint-react/no-array-index-key` — list items keyed by their map index
- 2× `@eslint-react/use-state` — non-lazy `useState` initial values that allocate a new collection on every render

None block the build. All represent real (if low-severity) React-correctness signal that the previous plugin missed. With them resolved, `npm run lint` becomes a meaningful pre-commit/CI gate again.

## Requirements Trace

- R1. `npm run lint` exits clean (0 errors, 0 warnings) on `main`.
- R2. Each list-key fix uses a content-derived composite key that is provably unique within its render scope. No raw index keys, no `// eslint-disable` escape hatches.
- R3. Each `useState` fix uses a function initializer (`useState(() => …)`) without changing observed behavior or types.
- R4. No regression in rendered behavior — keyed lists must still update correctly across re-renders, and `useState` defaults must remain identity-stable across renders (which they already are with lazy init).

## Scope Boundaries

- Not changing list semantics, ordering, or filtering — only key derivation.
- Not refactoring components beyond what the lint fix requires (e.g., not extracting helpers unless duplication crosses a clear threshold).
- Not adding tests — these components have no existing test coverage and adding it is out of scope for a lint cleanup. Verification is via lint output and manual smoke (game view renders, round history expands).
- Not changing the lint config itself — the rules are correct; the code should conform.
- Not altering `routeTree.gen.ts` or anything in `globalIgnores`.

---

## Context & Research

### Relevant Code and Patterns

- **API types** (`lib/api/types.ts`):
  - `Card` = `{ number: CardNumber, suit: Suit }` — no id field.
  - `Trick` = `{ bleeding, plays: EnactedPlay[], winningPlay: EnactedPlay | null }` — no id field; identified by its winning play within a round.
  - `EnactedBid` = `{ type: "BID", playerId, amount }` — unique per `(playerId, amount)` within a round's bid history (per user confirmation).
  - `EnactedPlay` = `{ type: "PLAY", playerId, card }` — each card is played at most once per round, so `(playerId, card.number, card.suit)` is unique per round.

- **Data immutability invariant** (per user confirmation):
  - Cards never duplicated within a single list (hand, discards, received).
  - Bid histories unique by `(playerId, amount)`.
  - Tricks within a round uniquely identified by their `winningPlay` once completed.

- **Existing lazy-init reference**: none in this repo yet. The pattern is the standard React idiom: `useState(() => new Set())` instead of `useState(new Set())`.

### Institutional Learnings

- `docs/solutions/tooling-decisions/eslint-plugin-react-to-eslint-react-upgrade-2026-05-09.md` — explicitly notes these 8 warnings as latent issues exposed by the plugin swap, not introduced by it. Confirms scope: this plan resolves the residual cleanup that doc deferred.

### External References

None needed. The fixes are mechanical applications of well-established React patterns; the user has already provided the domain invariants that make content-derived keys safe.

---

## Key Technical Decisions

- **Content-derived composite keys over inline-disables.** The user explicitly preferred this approach. Backed by domain invariants: cards unique within lists, bids unique by `(playerId, amount)`, tricks uniquely identified by their winning play. No `eslint-disable` comments are introduced.
- **Trick keys use `winningPlay`.** Both trick-list call sites (`completed-round-view.tsx:181-231`, `trick-history.tsx:51-97`) only render *completed* tricks, so `winningPlay` is non-null at render time. Key formula: `${trick.winningPlay.playerId}-${trick.winningPlay.card.number}-${trick.winningPlay.card.suit}`. No defensive fallback — if `winningPlay` is ever null in these code paths it indicates an upstream bug we want to surface, not paper over.
- **Card keys drop the trailing `-${i}`.** `completed-round-view.tsx:40` already uses `${card.number}-${card.suit}-${i}`; the `-${i}` is the lint trigger and, given the no-duplicate invariant, the index suffix is redundant. Reduce to `${card.number}-${card.suit}`.
- **`discard-area.tsx` card keys** drop raw `key={i}` for the same reason. Use `${card.number}-${card.suit}`.
- **`bid-history-panel.tsx` keys** use `${bid.playerId}-${bid.amount}`.
- **Lazy initializers** wrap the existing constructor call in an arrow function: `useState<Set<number>>(() => new Set())`, `useState<Map<string, string>>(() => new Map())`. No type changes, no semantic changes — only defers the allocation past mount.

---

## Open Questions

### Resolved During Planning

- *Should we use inline `eslint-disable` or content-derived keys?* → User chose content-derived keys; backed by data-uniqueness invariants.
- *What identifies a trick when it has no id?* → Its `winningPlay`. Both call sites only render completed tricks, where `winningPlay` is non-null.
- *Will fixing these warnings change rendered behavior?* → No. Lazy `useState` initializers produce identical state on first render. Content-derived keys produce stable identities for lists that the index keys were already producing stably (since the lists never reorder or splice).

### Deferred to Implementation

- *Are there any stale CI lint configurations that warn-as-error?* → To verify when running the lint check post-change. Not expected (config inspection shows `"prettier/prettier": "error"` is the only error-level rule), but worth confirming the expected `npm run lint` exit code is 0.

---

## Implementation Units

- U1. **Lazy-initialize `useState` collection allocations**

**Goal:** Convert the two `useState(new Set/Map())` call sites to lazy initializers, resolving both `@eslint-react/use-state` warnings.

**Requirements:** R1, R3, R4

**Dependencies:** None

**Files:**
- Modify: `components/game/round-history.tsx`
- Modify: `routes/games/$gameId.tsx`

**Approach:**
- `components/game/round-history.tsx:14`: `useState<Set<number>>(new Set())` → `useState<Set<number>>(() => new Set())`.
- `routes/games/$gameId.tsx:55-57`: `useState<Map<string, string>>(new Map())` → `useState<Map<string, string>>(() => new Map())`. Preserve the existing line break formatting if Prettier disagrees, let `npm run lint:fix` settle it.
- No other changes in either file.

**Patterns to follow:**
- Standard React lazy-init idiom; matches the lint rule's example: `useState(() => getValue())`.

**Test scenarios:**
- Test expectation: none — pure refactor of state initializer call shape, no behavioral change. Verified by lint passing and the affected views still rendering on a smoke check (round-history expand/collapse still works; game page still loads with player names).

**Verification:**
- `npm run lint` no longer emits the two `@eslint-react/use-state` warnings.
- Manual smoke: open a game route in dev, expand a completed round in the round history panel, confirm no console errors and the expand state behaves identically.

---

- U2. **Replace index keys with content-derived keys for card lists**

**Goal:** Resolve the four card-list `no-array-index-key` warnings (1 in `completed-round-view.tsx`, 2 in `discard-area.tsx`) by using `${card.number}-${card.suit}` as the key. Cards are guaranteed unique within these lists.

**Requirements:** R1, R2, R4

**Dependencies:** None (independent of U1)

**Files:**
- Modify: `components/game/completed-round-view.tsx`
- Modify: `components/game/discard-area.tsx`

**Approach:**
- `completed-round-view.tsx:40` (inside `CardList`): change `key={\`${card.number}-${card.suit}-${i}\`}` to `key={\`${card.number}-${card.suit}\`}`. The `i` parameter on the `.map` callback can also be removed since it's no longer referenced.
- `discard-area.tsx:38`: change `<Card key={i} card={card} disabled />` to `<Card key={\`${card.number}-${card.suit}\`} card={card} disabled />`. Drop unused `i` from the map callback.
- `discard-area.tsx:49`: same change for the `value.received.map` block.
- Do not touch the `Object.entries(...).map(([playerId, …]) => …)` blocks — they already use `key={playerId}` correctly and are not flagged.

**Patterns to follow:**
- Existing `Object.entries(...)` blocks in the same files use stable map-key-derived keys; this change brings the array maps in line.

**Test scenarios:**
- Test expectation: none — no behavioral change. Verified by lint output and a render smoke.

**Verification:**
- `npm run lint` no longer emits the three card-list warnings (`completed-round-view.tsx:40`, `discard-area.tsx:38`, `discard-area.tsx:49`).
- Manual smoke: expand a completed round, confirm initial-hand and discard card lists render identically, including the case where one player has 0 received cards (the conditional `value.received.length > 0` block must not regress).

---

- U3. **Replace index keys with `winningPlay`-derived keys for trick lists**

**Goal:** Resolve the two trick-list `no-array-index-key` warnings (`completed-round-view.tsx:183`, `trick-history.tsx:53`) by keying each completed trick on its winning play.

**Requirements:** R1, R2, R4

**Dependencies:** None (independent of U1, U2)

**Files:**
- Modify: `components/game/completed-round-view.tsx`
- Modify: `components/game/trick-history.tsx`

**Approach:**
- Both call sites only render completed tricks, so `trick.winningPlay` is non-null at render time. Key formula: `${trick.winningPlay.playerId}-${trick.winningPlay.card.number}-${trick.winningPlay.card.suit}`.
- `completed-round-view.tsx:181-231`: in `completedRound.tricks.map((trick, i) => …)`, replace `key={i}` (line 183) with the winningPlay composite. The `i` parameter is still used downstream as `Trick {i + 1}` (line 188), so keep it in the callback signature even though it's no longer the key. The `(trick, i)` destructure stays; only the `key=` value changes.
- `trick-history.tsx:51-97`: same treatment in `completedTricks.map((trick, i) => …)`. `i` is also still used for the `Trick {i + 1}` label (line 58), so keep the signature.
- TypeScript may complain that `trick.winningPlay` is possibly null (its type is `EnactedPlay | null`). Use a non-null assertion only if narrowing is awkward; preferred form: pull `const winning = trick.winningPlay;` out of the map body inside an early-return guard, or use the `!` postfix on the key expression with a comment justifying the invariant. Decision deferred to implementation since it depends on what TypeScript actually flags.

**Execution note:** Run `npx tsc --noEmit` after editing to confirm no new type errors slipped in around the non-null assumption.

**Patterns to follow:**
- The neighboring `trick.plays.map((play) => …)` blocks (e.g., `completed-round-view.tsx:206`, `trick-history.tsx:72`) already use `key={\`${play.playerId}-${play.card.number}-${play.card.suit}\`}` — exact same shape. Mirror it.

**Test scenarios:**
- Test expectation: none — no behavioral change. Verified by lint output, type-check, and render smoke.

**Verification:**
- `npm run lint` no longer emits the two trick-list warnings.
- `npx tsc --noEmit` reports no new errors.
- Manual smoke: expand a completed round with multiple tricks; confirm all tricks render with correct order, "Trick N" labels, winners, and bleeding indicators.

---

- U4. **Replace index keys with `(playerId, amount)` keys for bid history**

**Goal:** Resolve the remaining `no-array-index-key` warning (`bid-history-panel.tsx:26`).

**Requirements:** R1, R2, R4

**Dependencies:** None (independent of U1–U3)

**Files:**
- Modify: `components/game/bid-history-panel.tsx`

**Approach:**
- `bid-history-panel.tsx:25-35`: change `bidHistory.map((bid, i) => <li key={i}>` to `bidHistory.map((bid) => <li key={\`${bid.playerId}-${bid.amount}\`}>`. Drop the unused `i` parameter.
- Per user invariant: bid history entries are unique by `(playerId, amount)` within a round, so this composite is collision-free.

**Patterns to follow:**
- Mirrors the U2 / U3 pattern of content-derived composite keys.

**Test scenarios:**
- Test expectation: none — no behavioral change.

**Verification:**
- `npm run lint` no longer emits the `bid-history-panel.tsx` warning.
- Manual smoke: open a completed round with multiple bids, confirm bid list renders identically.

---

- U5. **Final lint baseline check**

**Goal:** Confirm the complete fix landed cleanly: 0 errors, 0 warnings, type-check passes, build succeeds.

**Requirements:** R1

**Dependencies:** U1, U2, U3, U4

**Files:** None modified directly. This is a verification gate.

**Approach:**
- Run `npm run lint` — expect `✖ 0 problems` or no output beyond the script header.
- Run `npx tsc --noEmit` — expect no errors.
- Run `npm run build` — expect successful production build (sanity check that no runtime-affecting change slipped in).
- If anything else surfaces (e.g., a Prettier disagreement after the edits), run `npm run lint:fix` and re-verify.

**Verification:**
- All three commands exit 0 and produce no warnings/errors.
- The institutional learnings doc (`docs/solutions/tooling-decisions/eslint-plugin-react-to-eslint-react-upgrade-2026-05-09.md`) is now strictly historical — its "8 pre-existing warnings" example is resolved. No edit to that doc is required (it accurately describes the state at the time of writing), but worth a note in the eventual PR description.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `trick.winningPlay` is null at render time despite the call-site guarantees, causing a runtime crash on the key expression | Run a manual smoke through a completed round after U3. If TypeScript is strict about the null case, use a `const winning = trick.winningPlay; if (!winning) return null;` guard rather than a non-null assertion — fail visibly rather than silently. |
| A future change introduces a bid where `(playerId, amount)` is no longer unique (e.g., bid amendments) | Out of scope; the type system permits it but the current data model and gameplay rules don't. Document the assumption in the U4 commit message so any future violator sees the breadcrumb. |
| Prettier reformats the multi-line `useState(() => new Map())` differently than expected and creates a noisy diff | Run `npm run lint:fix` once during U5 to let the formatter settle. |

---

## Sources & References

- Related learning: `docs/solutions/tooling-decisions/eslint-plugin-react-to-eslint-react-upgrade-2026-05-09.md`
- Lint rule docs: `@eslint-react/no-array-index-key`, `@eslint-react/use-state` (rules from `@eslint-react/eslint-plugin`)
- Affected files: `components/game/bid-history-panel.tsx`, `components/game/completed-round-view.tsx`, `components/game/discard-area.tsx`, `components/game/round-history.tsx`, `components/game/trick-history.tsx`, `routes/games/$gameId.tsx`
