---
title: "Resolving @eslint-react/no-array-index-key: when to use content keys vs inline-disable"
date: 2026-05-09
problem_type: convention
module: react-keys
component: tooling
severity: low
applies_when:
  - "Resolving @eslint-react/no-array-index-key warnings on a list rendered from immutable per-render data"
  - "Choosing between fabricating a stable key from item content vs documenting that the item's identity IS its position"
related_components:
  - frontend_stimulus
tags:
  - eslint
  - eslint-react
  - react-keys
  - no-array-index-key
  - lint-warnings
  - typescript
  - react
---

# Resolving @eslint-react/no-array-index-key: when to use content keys vs inline-disable

## Context

After upgrading to `@eslint-react/eslint-plugin` (see [eslint-plugin-react to @eslint-react upgrade](../tooling-decisions/eslint-plugin-react-to-eslint-react-upgrade-2026-05-09.md)), the codebase had 6 `no-array-index-key` warnings on lists keyed by `key={i}` or `key={`...-${i}`}`. The lint rule is correct in spirit — index keys break when lists are reordered, filtered, or have items inserted in the middle — but it can't tell the difference between:

1. **Lists where the items have content-derived identity** that just happens to be missing in the rendering. Keys *should* exist; the developer just hasn't pulled them out yet.
2. **Lists where the item's identity IS its position** within an immutable parent. There is no truer key than the index, and inventing a fake content-hash would obscure that.

Conflating these two cases produces either bad fixes (silent collisions when content "looks unique" but isn't) or noisy escape hatches everywhere. This doc captures the decision rubric used to fix the 6 warnings cleanly.

## Guidance

### Step 1: Ask whether the items have content-derived identity

For each warning, look at what the items actually are and write down: *if I had to identify a single item in this list, what would I look for?* If the answer is a stable property or composite of properties on the item, the rule is right — use that as the key. If the answer is *"the third one,"* the rule is wrong for this list and should be disabled with a justification.

### Step 2a: Content-derived identity → composite key

When item identity is content-based, key on the smallest unique composite. Drop the `i` parameter from the map callback if it's no longer needed. Examples from this codebase:

| List | Item shape | Key |
|------|-----------|-----|
| Bid history within a round | `{ playerId, amount }` | `${bid.playerId}-${bid.amount}` |
| Cards in a hand, discard, or received pile | `{ number, suit }` | `${card.number}-${card.suit}` |
| Plays within a trick | `{ playerId, card }` | `${play.playerId}-${play.card.number}-${play.card.suit}` |

Verify uniqueness against the actual data invariants — *not* against the TypeScript type. The type may permit duplicates that the domain rules out.

```tsx
// Before
{bidHistory.map((bid, i) => (
  <li key={i}>...</li>
))}

// After
{bidHistory.map((bid) => (
  <li key={`${bid.playerId}-${bid.amount}`}>...</li>
))}
```

### Step 2b: Position IS the identity → inline-disable with rationale

When the item has no content-derived identity (or fabricating one would mislead future readers), use the index and explain why. This is the honest answer for things like "the Nth trick in a round" — there is no stable property that distinguishes trick #3 from trick #4 except that one came after the other.

```tsx
{completedRound.tricks.map((trick, i) => (
  <div
    // Tricks have no stable identity outside their order within
    // the round — index is the correct key here.
    // eslint-disable-next-line @eslint-react/no-array-index-key
    key={i}
    className="..."
  >
    ...
  </div>
))}
```

The disable comment must sit on the line directly above the `key={...}` attribute, not on the line above the `<div>`. JSX text nodes between the comment and the attribute will absorb the directive and ESLint will report it as `Unused eslint-disable directive`.

### Step 3: Avoid the failure modes

**Don't fabricate a "stable" key from content that isn't actually unique.** A key like `${trick.winningPlay.playerId}-${trick.winningPlay.card.number}-${trick.winningPlay.card.suit}` *seems* content-derived but only works because the winning play happens to be unique within a round — i.e., it's still derived from positional information (which trick was won by which play). Better to be honest: write `key={i}` with a comment than to invent identity that doesn't really exist.

**Don't use a content-only key with a defensive `?? trick.plays[0]` fallback to silence TypeScript.** That signals "I don't trust the invariant I just claimed," which is itself a code smell. If TypeScript is forcing a fallback, that's a hint the content-derived path doesn't actually work — go to Step 2b.

**Don't mass-disable the rule project-wide.** That throws away the genuine signal it provides for the cases where item identity IS content-based. Per-call-site decisions cost a few minutes of thought each but produce a codebase where every lint suppression is intentional.

## Why This Matters

A lint rule's job is to flag suspicious patterns. A suspicious pattern resolved by *thinking about what should be true* (and either fixing it or explaining why it's already correct) compounds into stronger code review signal: the next reader sees only intentional suppressions, each annotated with a domain reason. A lint rule's job is *not* to be silenced — and inline-disable comments are not failure, they're documentation when used correctly.

## When to Apply

- Resolving `@eslint-react/no-array-index-key` warnings (or the older `react/no-array-index-key`)
- Reviewing keyed lists in PR review and asking "could this collide?"
- Designing new components that render server-provided immutable lists where item identity is ambiguous

## Examples

### Example 1: Cards in a hand (content-derived)

Cards are unique within any hand, discard pile, or received pile (game rule, not type-system guarantee). Composite key works:

```tsx
{cards.map((card) => (
  <span key={`${card.number}-${card.suit}`} className={...}>
    {cardLabel(card)}
  </span>
))}
```

### Example 2: Tricks in a round (positional identity)

A `Trick` is `{ bleeding, plays, winningPlay }` — no `id`, no timestamp, no sequence number. Two completed tricks with the same winner playing the same card are theoretically distinguishable only by which one came first in the round. Use the index, document the choice:

```tsx
{completedTricks.map((trick, i) => (
  <div
    // Tricks have no stable identity outside their order within
    // the round — index is the correct key here.
    // eslint-disable-next-line @eslint-react/no-array-index-key
    key={i}
    className={...}
  >
    <span>Trick {i + 1}</span>
    {/* ... */}
  </div>
))}
```

### Example 3: Bids in a round (content-derived)

A bid is `{ playerId, amount }`. Within a single round, gameplay rules guarantee `(playerId, amount)` is unique (no player bids the same amount twice). Composite works:

```tsx
{bidHistory.map((bid) => (
  <li key={`${bid.playerId}-${bid.amount}`}>
    <span>{displayName(bid.playerId)}</span>: {BID_LABEL[bid.amount as BidValue]}
  </li>
))}
```

## Related

- [eslint-plugin-react to @eslint-react upgrade](../tooling-decisions/eslint-plugin-react-to-eslint-react-upgrade-2026-05-09.md) — the plugin upgrade that surfaced these 8 warnings as the trigger for this convention
- [Discard stage UX improvements](../best-practices/discard-stage-ux-improvements-2026-04-22.md) — companion convention for `useState` lazy initializer (the other lint-warning category resolved alongside the `no-array-index-key` work)
