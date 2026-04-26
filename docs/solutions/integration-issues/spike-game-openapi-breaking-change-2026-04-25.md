---
title: SpikeGame OpenAPI Breaking Change — Active/Completed Split and SpikeDiscard
date: 2026-04-25
category: integration-issues
module: game-api-types
problem_type: integration_issue
component: frontend_stimulus
symptoms:
  - TypeScript compiler errors on game.rounds, game.winner, game.status — properties no longer exist on SpikeGame
  - activeRound always null because the rounds array no longer exists to search
  - Game never shown as completed — isCompleted was false because game.winner was undefined
  - Discard area rendered nothing for the current player — Array.isArray type guard never matched the new SpikeDiscard object
  - Completed round view crashed or rendered blank — hands, bidder_player_id, and bid_amount no longer present
  - RoundHeader received two separate props (bidderPlayerId, bidAmount) that no longer existed as discrete fields
root_cause: wrong_api
resolution_type: code_fix
severity: critical
related_components:
  - testing_framework
  - documentation
tags:
  - openapi
  - breaking-change
  - typescript
  - api-types
  - discriminated-union
  - type-guard
  - spike-endpoint
---

# SpikeGame OpenAPI Breaking Change — Active/Completed Split and SpikeDiscard

## Problem

The backend OpenAPI spec underwent a breaking structural change to the `SpikeGame` response shape: the flat `rounds` array and top-level `winner`/`status` fields were replaced with a discriminated-union `active` field and a separate `completed_rounds` array. Additionally, discards changed from bare `Card[]` to a `SpikeDiscard` object exposing both the discarded cards and the replacement cards dealt to the player. All frontend types, derived state hooks, and UI components referenced the old shape and required a coordinated top-down update.

## Symptoms

- TypeScript compiler errors on `game.rounds`, `game.winner`, `game.status` — properties no longer exist on `SpikeGame`
- `activeRound` always `null` — the hook searched `game.rounds` for an in-progress round, but the array was gone
- Game never shown as completed — `isCompleted` was `false` because `game.winner` was `undefined`
- Discard area rendered nothing for the current player — `Array.isArray(value)` type guard never matched because own discards were now a `SpikeDiscard` object, not a raw `Card[]`
- Completed round view crashed or rendered blank — `hands`, `bidder_player_id`, and `bid_amount` no longer present on `SpikeCompletedWithBidderRound`
- `RoundHeader` received two props (`bidderPlayerId`, `bidAmount`) that no longer existed as discrete fields

## What Didn't Work

There were no failed investigation approaches — the spec was the authoritative source of truth. The correct strategy was to read the OpenAPI JSON directly, map every changed field name and type, then propagate changes strictly top-down: types → hook → component props → render logic → test fixtures. No guessing or incremental patching was needed; TypeScript's compiler surfaced every downstream call site as an error once the types were updated first.

## Solution

### 1. Update `lib/api/types.ts` — restructure `SpikeGame` and round types

**Before:**
```ts
interface SpikeGame {
  id: string;
  name: string;
  status: string;
  winner: PlayerInGame | null;
  players: PlayerInGame[];
  scores: Record<string, number>;
  rounds: SpikeRound[];
}

type SpikeRound = SpikeCompletedRound | SpikeCompletedNoBiddersRound | SpikeActiveRound;

interface SpikeCompletedRound {
  status: "COMPLETED";
  dealer_player_id: string;
  bidder_player_id: string;
  bid_amount: number;
  trump: SelectableSuit;
  bidHistory: SpikeBid[];
  hands: Record<string, Card[]>;
  discards: Record<string, Card[]>;
  tricks: Trick[];
  scores: Record<string, number>;
}

interface SpikeActiveRound {
  status: "BIDDING" | "TRUMP_SELECTION" | "DISCARD" | "TRICKS";
  dealer_player_id: string;
  bidHistory: SpikeBid[];
  hands: Record<string, Card[] | number>;
  discards: Record<string, Card[] | number>;
  bidder_player_id: string | null;
  bid_amount: number | null;
  trump: SelectableSuit | null;
  tricks: Trick[];
  active_player_id: string;
  queued_actions: unknown[];
}
```

**After:**
```ts
interface SpikeBid {
  player_id: string;
  amount: number;
}

interface SpikeDiscard {
  discarded: Card[];
  received: Card[];   // cards dealt to the player to replace their discards
}

interface SpikeGame {
  id: string;
  name: string;
  players: PlayerInGame[];
  scores: Record<string, number>;
  active: SpikeActive;              // replaces status + winner + rounds searching
  completed_rounds: SpikeCompletedRound[];
}

type SpikeActive = SpikeActiveRound | SpikeWonInformation;

interface SpikeWonInformation {
  status: "WON";
  winner_player_id: string;
}

type SpikeCompletedRound = SpikeCompletedWithBidderRound | SpikeCompletedNoBiddersRound;

interface SpikeCompletedWithBidderRound {
  status: "COMPLETED";
  dealer_player_id: string;
  trump: SelectableSuit;
  bidHistory: SpikeBid[];
  bid: SpikeBid | null;                         // replaces bidder_player_id + bid_amount
  initial_hands: Record<string, Card[]>;        // replaces hands
  discards: Record<string, SpikeDiscard>;       // replaces Record<string, Card[]>
  tricks: Trick[];
  scores: Record<string, number>;
}

interface SpikeActiveRound {
  status: "BIDDING" | "TRUMP_SELECTION" | "DISCARD" | "TRICKS";
  dealer_player_id: string;
  bidHistory: SpikeBid[];
  bid: SpikeBid | null;                         // replaces bidder_player_id + bid_amount
  hands: Record<string, Card[] | number>;
  trump: SelectableSuit | null;
  discards: Record<string, SpikeDiscard | number>; // object replaces bare Card[]
  tricks: Trick[];
  active_player_id: string;
  queued_actions: unknown[];
}
```

### 2. Update `lib/hooks/use-game-state.ts` — derived state from new shape

**Before:**
```ts
const ACTIVE_STATUSES = new Set(["BIDDING", "TRUMP_SELECTION", "DISCARD", "TRICKS"]);

const activeRound = game?.rounds.find(r => ACTIVE_STATUSES.has(r.status)) ?? null;
const completedRounds = game?.rounds.filter(r => COMPLETED_STATUSES.has(r.status)) ?? [];
const isCompleted = !!game?.winner || (game?.rounds.length > 0 && activeRound === null);
const winner = game?.winner ?? null;
```

**After:**
```ts
function isActiveRound(active: SpikeActive): active is SpikeActiveRound {
  return active.status !== "WON";
}

const activeRound: SpikeActiveRound | null =
  game && isActiveRound(game.active) ? game.active : null;

const completedRounds: SpikeCompletedRound[] = game?.completed_rounds ?? [];

const isCompleted = !!game && game.active.status === "WON";

// winner is synthesized — backend no longer returns a full PlayerInGame
const winner: PlayerInGame | null =
  game && !isActiveRound(game.active)
    ? { id: game.active.winner_player_id, type: "human" }
    : null;
```

The old code had a defensive fallback: `isCompleted` was true if `winner` was non-null OR if rounds existed but none were active (guarding against `winner: null` in WON status). The new code trusts `active.status === "WON"` as the single source of truth and reconstructs `PlayerInGame` from `winner_player_id`. (session history)

### 3. Consolidate bid props in `round-header.tsx`

**Before:**
```tsx
interface RoundHeaderProps {
  bidderPlayerId: string | null;
  bidAmount: number | null;
  // ...
}
```

**After:**
```tsx
interface RoundHeaderProps {
  bid: SpikeBid | null;
  // ...
}

// Caller (game-board.tsx) before:
<RoundHeader bidderPlayerId={activeRound.bidder_player_id} bidAmount={activeRound.bid_amount} />

// After:
<RoundHeader bid={activeRound.bid} />

// BidControls — accessing the amount:
currentBid={activeRound.bid?.amount ?? null}
```

### 4. Update `discard-area.tsx` — handle `SpikeDiscard` object and show received cards

The type guard changed because the API moved from a bare `Card[]` to a structured `SpikeDiscard` object for own discards. `Array.isArray` no longer matches. The replacement uses `typeof value === "object" && value !== null` — the null check matters because `typeof null === "object"` in JavaScript, and a missing player entry in the map would otherwise cause `value.discarded` to throw at runtime. A named predicate (`isSpikeDiscard`) keeps the guard explicit, null-safe, and reusable.

**Before:**
```tsx
if (pid === playerId && Array.isArray(value)) {
  return (
    <div>{value.map((card, i) => <Card key={i} card={card} disabled />)}</div>
  );
}
const count = Array.isArray(value) ? value.length : value;
```

**After:**
```tsx
// Named predicate — null check is required: typeof null === "object" in JS
function isSpikeDiscard(v: SpikeDiscard | number): v is SpikeDiscard {
  return typeof v === "object" && v !== null;
}

if (pid === playerId && isSpikeDiscard(value)) {
  return (
    <div>
      {value.discarded.map((card, i) => <Card key={i} card={card} disabled />)}
      {value.received.length > 0 && (
        <div>
          {value.received.map((card, i) => <Card key={i} card={card} disabled />)}
        </div>
      )}
    </div>
  );
}
// value is now narrowed to number
const count = isSpikeDiscard(value) ? value.discarded.length : value;
```

### 5. Update `completed-round-view.tsx`

Three field renames in the completed round view:

| Before | After |
|---|---|
| `round.hands` | `round.initial_hands` |
| `round.bidder_player_id` | `round.bid?.player_id` |
| `round.bid_amount` | `round.bid?.amount` |

Discard iteration:
```tsx
// Before — value was Card[]
{Object.entries(round.discards).map(([pid, cards]) => (
  <CardList cards={cards} />
))}

// After — value is SpikeDiscard; show both discarded and replacement cards
{Object.entries(round.discards).map(([pid, discard]) => (
  <div key={pid}>
    <CardList cards={discard.discarded} />
    {discard.received.length > 0 && (
      <>
        <span>Received</span>
        <CardList cards={discard.received} />
      </>
    )}
  </div>
))}
```

### 6. Update test fixtures

Fixtures typed against the interface surface field renames as compiler errors. Key updates:

```ts
// Before
const mockGame: SpikeGame = {
  status: "ACTIVE",
  winner: null,
  rounds: [mockActiveRound, mockCompletedRound],
  // ...
};

const mockCompletedRound = {
  hands: { player1: [aceOfSpades] },
  bidder_player_id: "player1",
  bid_amount: 20,
  discards: { player1: [twoOfClubs] },
};

// After
const mockGame: SpikeGame = {
  active: mockActiveRound,         // { status: "WON", winner_player_id: "p1" } when complete
  completed_rounds: [mockCompletedRound],
  // no status, no winner, no rounds
};

const mockCompletedRound: SpikeCompletedWithBidderRound = {
  initial_hands: { player1: [aceOfSpades] },
  bid: { player_id: "player1", amount: 20 },
  discards: { player1: { discarded: [twoOfClubs], received: [threeOfHearts] } },
};

// round-header tests
// Before: render(<RoundHeader bidderPlayerId="p1" bidAmount={20} />)
// After:  render(<RoundHeader bid={{ player_id: "p1", amount: 20 }} />)
```

## Why This Works

The backend moved from a single polymorphic `rounds` array (where active vs. completed was inferred by scanning statuses) to an explicit separation: `active` is a discriminated union holding exactly the current state, and `completed_rounds` is a plain list of finished rounds. Consumers no longer need to search and filter — the server does that work.

The `SpikeWonInformation` terminal state in the `active` discriminated union is the key structural change: game completion is now signalled by the `active` field itself rather than by a separate `winner` field on the game root. A single type guard (`isActiveRound`) is sufficient to branch all downstream logic correctly. Note that `isActiveRound` uses a negative check (`active.status !== "WON"`) — this is correct while `SpikeActive` has exactly two members, but if a second terminal state is added (e.g., `"ABANDONED"`), the guard would silently misclassify it as `SpikeActiveRound`. If the union grows, update the guard to a positive check against the active status literals.

The `SpikeDiscard` object replaced a bare `Card[]` to expose the replacement cards alongside the discarded ones. The old `Array.isArray` guard was structurally wrong for the new shape and silently rendered nothing — switching to a named predicate (`isSpikeDiscard`) restores correct behavior and enables showing both card arrays.

## Prevention

**1. Read the spec before writing any code.**
When the backend signals a breaking change, fetch the OpenAPI JSON and diff it against `lib/api/types.ts` before touching any other file. Every field rename, structural change, and new discriminator must be accounted for in types first. TypeScript will then surface every downstream call site as a compiler error. Use `npx tsc --noEmit` as a checklist generator.

**2. Flow changes top-down: types → hooks → props → render → tests.**
The dependency graph is strict. Making changes in this order means the compiler flags the next layer automatically. Jumping ahead (e.g., updating render logic before updating the type) produces misleading errors.

**3. Treat discriminated union status values as the single source of truth for branching.**
When an API uses a `status` discriminator, write one named type guard per branch and use it everywhere. Avoid ad-hoc inline checks (`=== "WON"` scattered across components) — they're hard to find during a migration.

**4. Audit type guards when the underlying collection type changes.**
`Array.isArray` and `typeof x === "number"` are structural assumptions about the wire format. When the API changes a field from `Card[]` to `SpikeDiscard`, guards that worked before silently fail — the branch is never entered. When reviewing a spec diff, explicitly find every type guard touching changed fields.

**5. Type test fixtures against the interface, not `any`.**
If fixtures are typed (`const mock: SpikeGame = ...`), a field rename immediately produces a fixture compile error. Untyped or `as any` fixtures pass the compiler and hide regressions until runtime.

**6. Migration checklist for future spec changes:**
- [ ] Diff the OpenAPI spec (fetch `/openapi.json` and compare to current types)
- [ ] Update `lib/api/types.ts` fully before touching anything else
- [ ] Run `npx tsc --noEmit` — every error is a migration task
- [ ] Update hooks / derived state
- [ ] Update component prop interfaces
- [ ] Update render logic and type guards
- [ ] Update test fixtures (typed, not `any`)
- [ ] Run `npm run build` to confirm zero errors end-to-end

## Related Issues

- [`docs/solutions/ui-bugs/game-ui-rendering-and-style-fixes-2026-04-19.md`](../ui-bugs/game-ui-rendering-and-style-fixes-2026-04-19.md) — prevention rule: use API field existence/nullability as the display condition rather than phase name (complements this doc's discriminant-first guidance)
- [`docs/solutions/best-practices/discard-stage-ux-improvements-2026-04-22.md`](../best-practices/discard-stage-ux-improvements-2026-04-22.md) — documents the prior discard controls prop interface; `DiscardControls` props were not changed in this migration
