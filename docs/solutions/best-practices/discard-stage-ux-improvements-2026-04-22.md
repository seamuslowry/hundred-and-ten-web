---
title: "Discard stage UX: single-click actions, lazy useState initializer, and frontend validation guards"
date: 2026-04-22
category: best-practices
module: discard-stage-ux
problem_type: best_practice
component: frontend_stimulus
severity: low
applies_when:
  - Implementing a discard or selection phase in a card game UI
  - Deciding whether to add confirmation dialogs for irreversible-feeling actions
  - Deriving initial component state from props at mount time
  - Deciding whether to guard zero-item or edge-case actions in the frontend
tags:
  - discard
  - ux
  - confirmation-dialog
  - auto-select
  - trump
  - use-state-initializer
  - frontend
---

# Discard stage UX: single-click actions, lazy useState initializer, and frontend validation guards

## Context

`components/game/discard-controls.tsx` accumulated three patterns worth documenting as the discard stage UI was refined:

1. **Two-click confirmation removed** — the component had a `confirming` state machine that required two clicks to submit a discard (first click → red "Confirm?" button; second click → submit). This added friction without meaningful safety since the backend rejects invalid discards anyway.
2. **Auto-select non-trump cards on mount** — `selected` was initialized to `[]`, requiring players to manually select every card to discard. Changed to pre-select all non-trump cards using a lazy `useState` initializer, so the common case (discard everything non-trump) is zero-effort.
3. **Allow 0-card discard** — the discard button was disabled when `selected.length === 0`, preventing players from keeping their entire hand. The guard was removed; the backend is authoritative on whether a 0-card discard is valid.

## Guidance

### 1. Single-click action controls

Do not use multi-step confirmation state for game action buttons. A single click should submit the action directly. Reserve confirmation dialogs for actions that are both irreversible **and** destructive in a way the backend cannot reject (e.g., permanent account deletion) — game action submission is neither.

```tsx
// Before — two-click confirmation state machine
const [confirming, setConfirming] = useState(false);

function handleClick() {
  if (!confirming) {
    setConfirming(true);
  } else {
    onDiscard(selected);
  }
}

<button
  onClick={handleClick}
  className={confirming ? "bg-red-600" : "bg-blue-600"}
>
  {confirming ? `Confirm discard ${selected.length} cards?` : "Discard"}
</button>

// After — single-click
<button type="button" onClick={() => onDiscard(selected)}>
  {`Discard ${selected.length} card${selected.length !== 1 ? "s" : ""}`}
</button>
```

### 2. Lazy useState initializer for derived initial state

When initial state is derived from props (e.g., filtering cards), use a lazy `useState` initializer — a function passed to `useState` that is called once at mount — rather than `useEffect`. This avoids an extra render cycle, prevents a flash from empty to pre-selected state, and does not trigger ESLint's `react-hooks/exhaustive-deps` rule.

```tsx
// Before — empty initial selection, player must select manually
const [selected, setSelected] = useState<CardType[]>([]);

// After — pre-select non-trump cards at mount
const [selected, setSelected] = useState<CardType[]>(() =>
  cards.filter((c) => !isTrump(c, trump)),
);
```

The initializer runs exactly once. If `cards` or `trump` change after mount, `selected` is **not** re-initialized — this is intentional. In the current game flow, `DiscardControls` mounts only when `phase === "DISCARD" && myTurn`, so the hand and trump suit are fixed for the component's lifetime.

### 3. Inline temporary client-side logic

When adding client-side logic that will be superseded by a backend field, keep it inline and co-located rather than extracting to a shared utility. This makes the temporary nature visible and the eventual deletion self-contained.

```tsx
// Inline in discard-controls.tsx — NOT extracted to lib/card-utils.ts
// Client-side trump determination. Joker and Ace of Hearts are always trump.
// Any card matching the elected trump suit is also trump.
// Note: the backend is the authoritative source for trump rules; this logic
// is cosmetic (drives auto-selection defaults) and will be removed once the
// backend exposes per-card trump status.
function isTrump(card: CardType, trump: SelectableSuit | null): boolean {
  return (
    card.suit === "JOKER" ||
    (card.number === "ACE" && card.suit === "HEARTS") ||
    (trump !== null && card.suit === trump)
  );
}
```

### 4. Frontend disabled guards vs. backend authorization

Only disable action buttons for structural reasons (e.g., a required field is missing, an async action is in-flight). Do not guard against game-rule violations in the UI — the backend enforces all authorization. This keeps the frontend simple and avoids two sources of truth as rules evolve.

```tsx
// Before — UI enforcing a game rule
disabled={disabled || selected.length === 0}

// After — UI only enforcing structural readiness (disabled = action in-flight)
disabled={disabled}
```

## Why This Matters

- **Confirmation dialogs add cost without benefit when the backend already rejects invalid actions.** The extra click slows down every valid discard to protect against a case the backend handles anyway.
- **Lazy initializer vs. useEffect for derived state:** `useEffect` causes a render cycle after mount — the component renders once with `[]`, then immediately re-renders with the filtered list. This is visible as a flash and triggers unnecessary re-renders. The lazy initializer is instantaneous.
- **Shared utilities for temporary logic create tracking debt.** If `isTrump` were in `lib/card-utils.ts`, deleting it when the backend ships the trump field requires finding and updating all import sites. Inline placement makes deletion a single-file change.
- **UI guards that duplicate backend rules drift.** Rules change on the server; a UI guard that once made sense may silently block valid actions after a backend update. Frontend checks are cosmetic — use them sparingly.

## When to Apply

- When a game action button has a multi-step confirmation — replace with single-click unless the action is irreversible and destructive outside of backend control.
- When a component needs initial state derived from props at mount time — use a lazy `useState` initializer, not `useEffect`.
- When adding client-side logic that the backend will eventually supersede — keep it inline with a comment, do not extract to a shared utility.
- When adding a `disabled` condition to an action button — ask whether it is enforcing a game rule (remove it; let the backend reject) or a structural requirement like `actionInFlight` (keep it).

## Examples

### Full before/after: DiscardControls

**Before:**

```tsx
interface DiscardControlsProps {
  cards: CardType[];
  disabled?: boolean;
  onDiscard: (cards: CardType[]) => void;
}

export function DiscardControls({ cards, disabled, onDiscard }: DiscardControlsProps) {
  const [selected, setSelected] = useState<CardType[]>([]);
  const [confirming, setConfirming] = useState(false);

  function toggleCard(card: CardType) {
    setSelected((prev) => {
      const exists = prev.some((c) => cardEquals(c, card));
      if (exists) return prev.filter((c) => !cardEquals(c, card));
      return [...prev, card];
    });
    setConfirming(false);
  }

  function handleDiscard() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    onDiscard(selected);
  }

  return (
    <div>
      <Hand cards={cards} selectedCards={selected} selectable disabled={disabled} onSelect={toggleCard} />
      <button
        onClick={handleDiscard}
        disabled={disabled || selected.length === 0}
        className={confirming ? "bg-red-600 ..." : "bg-blue-600 ..."}
      >
        {confirming
          ? `Confirm discard ${selected.length} card${selected.length !== 1 ? "s" : ""}?`
          : `Discard ${selected.length} card${selected.length !== 1 ? "s" : ""}`}
      </button>
      {confirming && (
        <button onClick={() => setConfirming(false)}>Cancel</button>
      )}
    </div>
  );
}
```

**After:**

```tsx
// Inline, temporary — remove when backend exposes per-card trump status
function isTrump(card: CardType, trump: SelectableSuit | null): boolean {
  return (
    card.suit === "JOKER" ||
    (card.number === "ACE" && card.suit === "HEARTS") ||
    (trump !== null && card.suit === trump)
  );
}

interface DiscardControlsProps {
  cards: CardType[];
  trump: SelectableSuit | null;
  disabled?: boolean;
  onDiscard: (cards: CardType[]) => void;
}

export function DiscardControls({ cards, trump, disabled, onDiscard }: DiscardControlsProps) {
  const [selected, setSelected] = useState<CardType[]>(() =>
    cards.filter((c) => !isTrump(c, trump)),
  );

  function toggleCard(card: CardType) {
    setSelected((prev) =>
      prev.some((c) => cardEquals(c, card))
        ? prev.filter((c) => !cardEquals(c, card))
        : [...prev, card],
    );
  }

  return (
    <div>
      <Hand cards={cards} selectedCards={selected} selectable disabled={disabled} onSelect={toggleCard} />
      <button
        onClick={() => onDiscard(selected)}
        disabled={disabled}
        className="bg-blue-600 ..."
      >
        {`Discard ${selected.length} card${selected.length !== 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
```

**Usage in `game-board.tsx`:**

```tsx
{phase === "DISCARD" && myTurn && (
  <DiscardControls
    cards={hand}
    trump={started.trump}
    disabled={actionInFlight}
    onDiscard={(cards) => doAction({ type: "DISCARD", cards })}
  />
)}
```

## Related

- `components/game/discard-controls.tsx` — primary implementation
- `components/game/game-board.tsx` — passes `trump={started.trump}` to `DiscardControls`
- `docs/solutions/ui-bugs/dealer-bid-at-current-value-disabled-2026-04-21.md` — analogous pattern (removing an overly strict frontend guard in a game control component)
