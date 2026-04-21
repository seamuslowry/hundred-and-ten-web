---
title: Dealer Cannot Bid at Current Bid Value
date: 2026-04-21
category: ui-bugs
module: bidding
problem_type: ui_bug
component: frontend_stimulus
severity: medium
symptoms:
  - Dealer's bid button is disabled at the current standing bid amount
  - Dealer cannot take the bid at face value; must overbid or pass
root_cause: logic_error
resolution_type: code_fix
tags:
  - bidding
  - dealer
  - bid-controls
  - disabled-state
  - game-rules
---

# Dealer Cannot Bid at Current Bid Value

## Problem

In `components/game/bid-controls.tsx`, the bid button disabled condition used `value <= currentBid` for all players. The card game 110 allows the dealer to "take the bid" at the current standing value — matching, not exceeding, the current bid. Because the frontend applied the same strict inequality to everyone, the dealer's bid button was incorrectly disabled at the current bid value.

## Symptoms

- Dealer's bid button is disabled at the current standing bid amount
- Dealer cannot exercise the take-the-bid privilege; forced to overbid or pass
- Non-dealer players are unaffected

## What Didn't Work

No dead ends. The fix was straightforward once the game rule was identified.

## Solution

**Add `isDealer` prop to `BidControlsProps` and update the component signature:**

```tsx
// Before
interface BidControlsProps {
  currentBid: number | null;
  disabled?: boolean;
  onBid: (amount: BidValue) => void;
}
export function BidControls({ currentBid, disabled, onBid }: BidControlsProps)

// After
interface BidControlsProps {
  currentBid: number | null;
  isDealer?: boolean;
  disabled?: boolean;
  onBid: (amount: BidValue) => void;
}
export function BidControls({ currentBid, isDealer, disabled, onBid }: BidControlsProps)
```

**Update the disabled condition in `bid-controls.tsx`:**

```tsx
// Before
disabled={disabled || (currentBid !== null && value <= currentBid)}

// After
disabled={disabled || (currentBid !== null && (isDealer ? value < currentBid : value <= currentBid))}
```

**Pass dealer identity from `game-board.tsx`:**

```tsx
<BidControls
  currentBid={started.bid_amount}
  isDealer={started.dealer_player_id === playerId}
  disabled={actionInFlight}
  onBid={(amount: BidValue) => doAction({ type: "BID", amount })}
/>
```

## Why This Works

The dealer-takes-bid rule requires a different threshold than the strict "must overbid" rule for other players. Threading `isDealer` down to the button-level disabled logic lets the comparison switch: dealers use `value < currentBid` (can match current), others use `value <= currentBid` (must exceed). The backend already enforces real authorization — this fix removes a UI-only block on a valid dealer action.

## Prevention

- When implementing bid or action controls, cross-reference game rules for role-specific exceptions (dealer privileges, trump caller rights, etc.) before coding disabled conditions
- Encode player role as an explicit prop rather than deriving it inline in JSX; compute `const isDealer = started.dealer_player_id != null && started.dealer_player_id === playerId` before the return to make null-safety intent visible
- Consider naming props for the _rule_ rather than the _role_ (e.g., `canMatchCurrentBid`) to make the intent of disabled logic self-documenting at the call site
- Extract bid-floor logic into a named helper (`isBidValueDisabled(value, currentBid, canMatchCurrentBid)`) to make the three concerns (flight guard, null check, bid-floor) separately testable
- Add a test for the dealer-at-current-bid case; the conditional `isDealer ? value < currentBid : value <= currentBid` is easy to accidentally flatten in a refactor

## Related Issues

- Related ui-bug: `docs/solutions/ui-bugs/game-ui-rendering-and-style-fixes-2026-04-19.md` — sibling issue involving incorrect disabled state on the Pass bid button
