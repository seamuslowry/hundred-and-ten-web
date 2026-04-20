---
title: Game UI rendering and style fixes (duplicate ScoreBoard, Pass button, card hover, bidder display)
date: 2026-04-19
category: ui-bugs
module: frontend
problem_type: ui_bug
component: tooling
severity: medium
symptoms:
  - ScoreBoard rendered twice on completed game view at lg+ viewport
  - Pass button appeared disabled at all times due to indistinguishable gray styling
  - Card hover effect fired on disabled/unplayable cards giving false affordance
  - Bidder info never displayed despite code intended to show it during BIDDING phase
root_cause: logic_error
resolution_type: code_fix
tags:
  - conditional-rendering
  - tailwind
  - responsive-layout
  - game-ui
  - css-disabled
  - react
  - next-js
---

# Game UI rendering and style fixes (duplicate ScoreBoard, Pass button, card hover, bidder display)

## Problem

A batch of UI polish bugs in the game view made the interface misleading or broken: a score board appeared twice on desktop, the Pass bid button always looked disabled, card hover effects fired even when cards couldn't be played, and the bidder was never displayed despite code that tried to show it.

## Symptoms

- **Duplicate ScoreBoard**: On completed games at `lg+` viewport, the score board rendered twice — once inside `GameBoard` and once in the sidebar column of `game-page.tsx`.
- **Pass button always gray**: The Pass button was visually indistinguishable from a disabled button at all times, even when it was the player's turn to bid.
- **Card hover on disabled hand**: Hovering over cards in an opponent's hand (or when it's not your turn) showed the same highlight as an actionable card, giving false affordance.
- **Bidder never shown**: The "Bidder: ..." label never appeared during any phase despite code intended to show it during `BIDDING`.

## Solution

### Bug 1 — Duplicate ScoreBoard

`GameBoard` rendered `<ScoreBoard>` unconditionally in its completed-game branch. `game-page.tsx` also renders `<ScoreBoard>` in its `lg+` sidebar. Fix: gate `GameBoard`'s copy to mobile only using `lg:hidden`.

```tsx
// components/game/game-board.tsx — completed branch
// Before
<ScoreBoard game={game} />

// After
<div className="lg:hidden">
  <ScoreBoard game={game} />
</div>
```

The sidebar in `game-page.tsx` is already inside a `hidden lg:block` column, so the scoreboard now appears exactly once at every breakpoint.

---

### Bug 2 — Pass button always looked disabled

The Pass button used `bg-gray-200 text-gray-700` — identical in appearance to any button with `disabled:opacity-50` applied on a gray background.

```tsx
// components/game/bid-controls.tsx
// Before
className="px-4 py-2 text-sm font-medium bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"

// After
className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
```

Pass now matches the visual language of the other bid buttons, and the disabled state is clearly distinct from the enabled state.

---

### Bug 3 — Card hover fires when disabled

CSS `:hover` is not suppressed by the HTML `disabled` attribute on non-form elements. The hover style was applied unconditionally.

```tsx
// components/game/card.tsx
// Before
className={`... hover:border-gray-400 ...`}

// After — gate hover/cursor on the disabled prop
const interactionClasses = disabled
  ? 'cursor-not-allowed opacity-60'
  : 'hover:border-gray-400 hover:shadow-md cursor-pointer';

className={`... ${interactionClasses}`}
```

---

### Bug 4 — Bidder never shown

`game.phase === 'BIDDING' && game.bidder_player_id` can never be true: `bidder_player_id` is only populated by the server *after* bidding concludes, i.e. when the phase is no longer `BIDDING`. The intent is to show the bidder through `DISCARD` and `TRICKS` — exactly when the field is set.

```tsx
// components/game/game-status-bar.tsx
// Before
{game.phase === 'BIDDING' && game.bidder_player_id && (
  <span>Bidder: {playerName(game.bidder_player_id)}</span>
)}

// After — field nullability is the correct guard; phase check is redundant and wrong
{game.bidder_player_id && (
  <span>Bidder: {playerName(game.bidder_player_id)}</span>
)}
```

`bidder_player_id` is set once after bidding and retained for the life of the round, so it is non-null exactly when it should be displayed.

## Prevention

- **Never use gray fills for interactive elements.** Reserve gray/neutral backgrounds for disabled or inert UI. Primary actions (including "soft" choices like Pass) should use a filled color token so enabled vs. disabled states are always visually distinct.
- **Gate hover/cursor classes on the `disabled` prop explicitly.** CSS `:hover` has no knowledge of application state. Extract the conditional into a variable for readability rather than inlining a ternary in the class string.
- **When displaying server-populated fields, read the API contract, not the phase name.** Check whether a field is set at phase start, on event, or at phase end. Use field nullability (`field && ...`) as the display condition rather than a phase gate unless you've confirmed the field is available throughout that phase.
- **Responsive sidebar patterns need a single owner per content block.** When the same component is rendered in both a main column (mobile) and a sidebar (desktop), use responsive visibility classes (`block lg:hidden` / `hidden lg:block`) rather than rendering from two places.

## Related Issues

- `docs/solutions/best-practices/use-client-directive-ssr-migration-2026-04-19.md` — same session; touches `score-board.tsx` and `game-status-bar.tsx` but covers a different problem (`'use client'` directive cleanup after SSR migration).
- This session also added dark mode (`dark:` Tailwind variants throughout), a `TrickHistory` collapsible component, `GameStatusBar` enhancements (standing bid, trump suit), responsive card sizing, and removal of hints/suggestions UI. Those are additive changes, not bugs.
