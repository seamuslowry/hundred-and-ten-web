"use client";

import { useState } from "react";
import type {
  StartedGame,
  CompletedGame,
  Card as CardType,
  GameAction,
  BidValue,
  SelectableSuit,
  Suggestion,
} from "@/lib/api/types";
import { performAction } from "@/lib/api/games";
import { GameStatusBar } from "./game-status-bar";
import { ScoreBoard } from "./score-board";
import { Hand, cardEquals } from "./hand";
import { BidControls } from "./bid-controls";
import { TrumpSelector } from "./trump-selector";
import { DiscardControls } from "./discard-controls";
import { TrickArea } from "./trick-area";
import { SuggestionToggle } from "./suggestion-toggle";

interface GameBoardProps {
  started: StartedGame | null;
  completed: CompletedGame | null;
  hand: CardType[];
  myTurn: boolean;
  isStale: boolean;
  playerId: string;
  onActionComplete: () => Promise<void>;
  suggestions: Suggestion[];
  showHints: boolean;
  hasSuggestions: boolean;
  onToggleHints: () => void;
}

export function GameBoard({
  started,
  completed,
  hand,
  myTurn,
  isStale,
  playerId,
  onActionComplete,
  suggestions,
  showHints,
  hasSuggestions,
  onToggleHints,
}: GameBoardProps) {
  const [actionInFlight, setActionInFlight] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function doAction(action: GameAction) {
    if (!started || actionInFlight) return;
    setActionInFlight(true);
    setActionError(null);
    try {
      await performAction(playerId, started.id, action);
      await onActionComplete();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionInFlight(false);
    }
  }

  // Extract suggestion data for current phase
  const suggestedBids = suggestions
    .filter((s): s is Suggestion & { type: "BID" } => s.type === "BID")
    .map((s) => s.amount);

  const suggestedSuit = suggestions.find(
    (s): s is Suggestion & { type: "SELECT_TRUMP" } =>
      s.type === "SELECT_TRUMP",
  )?.suit;

  const suggestedPlayCards = suggestions
    .filter((s): s is Suggestion & { type: "PLAY" } => s.type === "PLAY")
    .map((s) => s.card);

  const suggestedDiscardCards = suggestions
    .filter((s): s is Suggestion & { type: "DISCARD" } => s.type === "DISCARD")
    .flatMap((s) => s.cards);

  if (completed) {
    return (
      <div className="flex flex-col gap-4">
        <GameStatusBar phase="WON" myTurn={false} isStale={isStale} />
        <div className="rounded-lg bg-green-50 p-6 text-center">
          <h2 className="text-xl font-bold">Game Over</h2>
          <p className="mt-2 text-lg">
            Winner: <span className="font-semibold">{completed.winner.id}</span>
          </p>
        </div>
        <ScoreBoard scores={completed.scores} currentPlayerId={playerId} />
      </div>
    );
  }

  if (!started) return null;

  const phase = started.status;

  return (
    <div className="flex flex-col gap-4">
      <GameStatusBar
        phase={phase}
        myTurn={myTurn}
        isStale={isStale}
        activePlayerId={started.active_player_id}
      />

      <ScoreBoard scores={started.scores} currentPlayerId={playerId} />

      {phase === "TRICKS" && <TrickArea tricks={started.tricks} />}

      {actionError && (
        <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
          {actionError}
        </div>
      )}

      {/* Suggestion toggle */}
      {myTurn && (
        <SuggestionToggle
          showHints={showHints}
          hasSuggestions={hasSuggestions}
          onToggle={onToggleHints}
        />
      )}

      {phase === "BIDDING" && myTurn && (
        <BidControls
          currentBid={started.bid_amount}
          disabled={actionInFlight}
          onBid={(amount: BidValue) => doAction({ type: "BID", amount })}
          suggestedBids={suggestedBids}
        />
      )}

      {phase === "TRUMP_SELECTION" && myTurn && (
        <TrumpSelector
          disabled={actionInFlight}
          onSelect={(suit: SelectableSuit) =>
            doAction({ type: "SELECT_TRUMP", suit })
          }
          suggestedSuit={suggestedSuit}
        />
      )}

      {phase === "DISCARD" && myTurn && (
        <DiscardControls
          cards={hand}
          disabled={actionInFlight}
          onDiscard={(cards: CardType[]) =>
            doAction({ type: "DISCARD", cards })
          }
          suggestedCards={suggestedDiscardCards}
        />
      )}

      {phase === "TRICKS" && myTurn && (
        <Hand
          cards={hand}
          selectable
          disabled={actionInFlight}
          onSelect={(card: CardType) => doAction({ type: "PLAY", card })}
          suggestedCards={suggestedPlayCards}
        />
      )}

      {hand.length > 0 &&
        !(phase === "DISCARD" && myTurn) &&
        !(phase === "TRICKS" && myTurn) && <Hand cards={hand} />}
    </div>
  );
}

export { cardEquals };
