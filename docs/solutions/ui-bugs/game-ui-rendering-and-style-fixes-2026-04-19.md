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

`GameBoard` rendered `<ScoreBoard>` unconditionally in its completed-game branch, while `routes/games/$gameId.tsx` also renders a top-level `<ScoreBoard>`. At the time this was written, the fix was to gate `GameBoard`'s copy to mobile only using `lg:hidden` alongside a sidebar column.

**Note (2026-04-25):** The page layout was later restructured into a single column with no desktop sidebar. `game-board.tsx` still renders `<ScoreBoard>` in the completed branch (`game-board.tsx:82`) and `routes/games/$gameId.tsx` renders it at the top level — both unconditionally. The `lg:hidden` fix described below was not carried through the migration; the duplication concern remains but manifests as two scoreboards stacked in a single column rather than a sidebar duplication.

```tsx
// components/game/game-board.tsx — completed branch
// Before
<ScoreBoard game={game} />

// After (original fix — now superseded by layout restructure)
<div className="lg:hidden">
  <ScoreBoard game={game} />
</div>
```

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

// After — gate hover/cursor on the disabled prop via inline ternary
className={`... ${
  disabled
    ? ""
    : " hover:border-gray-400 dark:hover:border-gray-400"
} ${disabled && !selected ? "opacity-50" : "cursor-pointer"}`}
```

---

### Bug 4 — Bidder never shown

`game.phase === 'BIDDING' && game.bidder_player_id` can never be true: `bidder_player_id` is only populated by the server *after* bidding concludes, i.e. when the phase is no longer `BIDDING`. The intent is to show the bidder through `DISCARD` and `TRICKS` — exactly when the field is set.

```tsx
// components/game/game-status-bar.tsx (deleted 2026-04-24; replaced by round-header.tsx)
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

**Note (2026-04-25):** `game-status-bar.tsx` was deleted in the round-based game view migration. The bidder display moved to `components/game/round-header.tsx`. The API field also changed: `bidder_player_id: string | null` was replaced by `bid: EnactedBid | null` (a `{ type: "BID", playerId, amount }` object). `round-header.tsx` applies the same nullability principle: `{(bid != null || phase === "BIDDING") && ...}`. See `docs/solutions/integration-issues/spike-game-openapi-breaking-change-2026-04-25.md` for the full field migration.

## Prevention

- **Never use gray fills for interactive elements.** Reserve gray/neutral backgrounds for disabled or inert UI. Primary actions (including "soft" choices like Pass) should use a filled color token so enabled vs. disabled states are always visually distinct.
- **Gate hover/cursor classes on the `disabled` prop explicitly.** CSS `:hover` has no knowledge of application state. Extract the conditional into a variable for readability rather than inlining a ternary in the class string.
- **When displaying server-populated fields, read the API contract, not the phase name.** Check whether a field is set at phase start, on event, or at phase end. Use field nullability (`field && ...`) as the display condition rather than a phase gate unless you've confirmed the field is available throughout that phase.
- **Responsive sidebar patterns need a single owner per content block.** When the same component is rendered in both a main column (mobile) and a sidebar (desktop), use responsive visibility classes (`block lg:hidden` / `hidden lg:block`) rather than rendering from two places.

## Related Issues

- ~~`docs/solutions/best-practices/use-client-directive-ssr-migration-2026-04-19.md`~~ — deleted; that doc described `'use client'` directive cleanup after an SSR migration that never happened — the actual migration target was Vite SPA where `'use client'` is meaningless.
- This session also added dark mode (`dark:` Tailwind variants throughout), a `TrickHistory` collapsible component, `GameStatusBar` enhancements (standing bid, trump suit), responsive card sizing, and removal of hints/suggestions UI. Those are additive changes, not bugs. Note: `GameStatusBar` was subsequently deleted in the 2026-04-24 migration; its role is now split between `round-header.tsx` and the broader round-based game view.
