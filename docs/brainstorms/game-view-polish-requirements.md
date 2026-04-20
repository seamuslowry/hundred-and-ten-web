---
date: 2026-04-19
topic: game-view-polish
---

# Game View Polish

## Problem Frame

The game view has four pre-merge defects and one layout gap that together degrade playability:

1. **Dark mode illegibility** — components use hardcoded light-mode Tailwind colors with no `dark:` variants; text and backgrounds become unreadable under `prefers-color-scheme: dark`.
2. **No current bidder context** — during the Bidding phase, players cannot see who is currently bidding or what the standing bid is.
3. **No trump display** — once trump is selected, it is never shown anywhere in the game view.
4. **No trick history** — only the current trick is visible; players cannot see what cards have already been played in prior tricks.
5. **Wasted space on large screens** — the layout caps at `max-w-2xl` regardless of screen size; there is no widening for tablet or desktop viewports.

## Requirements

**Dark Mode**
- R1. All game components must be legible in dark mode: text must have sufficient contrast against their backgrounds, and filled cards/panels that currently use hardcoded white or light-gray backgrounds must adapt to dark surfaces.
- R2. Semantic color meanings must be preserved in dark mode: amber = suggestions, blue = your turn / primary actions, yellow = winning play, red = error / confirm-destructive, green = game over. Only brightness/tone adjusts, not hue.
- R3. The fix should use Tailwind `dark:` variants rather than replacing the existing light-mode classes, so both modes are maintained in parallel.

**Bidding Context**
- R4. During the Bidding phase, the game view must show the current standing bid (the highest bid so far, or "No bids yet" if none).
- R5. During the Bidding phase, the game view must show who holds the current bid: player ID truncated to 8 characters (e.g., `abc12345`); if it's the local player, append "(you)" after the truncated ID (e.g., `abc12345 (you)`). Show nothing if no bids have been placed yet.

**Trump Display**
- R6. After trump has been selected (Discard and Tricks phases), the game view must display the trump suit symbol and name persistently — visible at all times during those phases, not only when it's your turn.

**Trick History**
- R7. During the Tricks phase, previously completed tricks must be visible to the player — at minimum: who played what card in each completed trick, and who won each trick.
- R8. Trick history is collapsed by default with a visible toggle showing how many tricks have been completed (e.g., "3 tricks played ▼"). When expanded, it is scroll-contained so it does not push the current-trick and hand controls off screen on small devices.

**Responsive Layout**
- R9. On screens between `max-w-2xl` (~672px) and the lg breakpoint (~1024px), the layout expands to a wider single column using available width rather than remaining fixed-narrow.
- R10. On screens ≥ lg breakpoint (~1024px), the layout uses a two-column arrangement: game info, trump display, and trick history on one side; active controls (hand, bid buttons, trump selector) on the other. The exact column proportions and element placement are a planning decision.
- R11. Mobile layout (< md breakpoint) must remain unchanged — 44px touch targets, horizontal scroll for the card hand.

## Success Criteria

- The game view is fully legible and usable in both light and dark mode.
- A player in the Bidding phase always knows who has the current bid and at what value.
- A player in Discard or Tricks phases always knows what trump is.
- A player in the Tricks phase can review all previously played tricks without leaving the game view.
- On a 1440px desktop, the game view makes meaningful use of the additional width; the narrow fixed column is gone.
- All existing mobile behaviors (touch targets, horizontal hand scroll, responsive panels) continue to work.

## Scope Boundaries

- No changes to game rules, API calls, or data model — all information needed for R4–R8 is already present in the game state returned by the existing API. If the trump suit is not directly accessible on the game state object, R6 would require a scope exception.
- No redesign of the lobby, auth, or any non-game views.
- No new animations or transitions unless they fall naturally out of the layout change.
- Accessibility beyond color contrast (e.g., screen reader support, keyboard navigation) is not in scope for this pass.

## Key Decisions

- **Tailwind `dark:` variants over CSS variables**: The existing `globals.css` already defines `--background`/`--foreground` with dark mode values, but component-level colors are all hardcoded Tailwind utilities. Extending per-component with `dark:` variants is the natural fit for this project and avoids introducing a new theming abstraction.
- **Trick history placement**: Collapsible or scroll-contained below the current trick, not a modal or separate page. Keeps the player oriented in the current trick while history is accessible.
- **Bidding context in GameStatusBar vs. separate component**: This is a planning decision. The requirement is that the information is visible, not where it lives.

## Dependencies / Assumptions

- The API game state already includes: current bid value, current bidder ID, trump suit, and the full `tricks[]` array including completed tricks. These were verified in the codebase — `trick-area.tsx` already receives `tricks[]` and reads the last element.
- Trump suit field name in the game state type needs to be confirmed during planning (unverified: may be `trumpSuit`, `trump`, or similar in `lib/api/types.ts`).

## Outstanding Questions

### Deferred to Planning

- [Affects R4–R5][Technical] Confirm the field names for current bid value and current bidder in the `StartedGame` type (`lib/api/types.ts`).
- [Affects R6][Technical] Confirm the trump suit field name and its type/enum values in `lib/api/types.ts`.
- [Affects R10][Technical] Determine the optimal two-column breakpoint and which elements belong in each column, based on the actual component sizes.

## Next Steps

-> `/ce:plan` for structured implementation planning
