import { useState } from "react";
import type {
  SpikeActiveRound,
  PlayerInGame,
  Card as CardType,
  GameAction,
  BidValue,
  SelectableSuit,
} from "@/lib/api/types";
import { performAction } from "@/lib/api/games";
import { RoundHeader } from "./round-header";
import { BidHistoryPanel } from "./bid-history-panel";
import { DiscardArea } from "./discard-area";
import { ScoreBoard } from "./score-board";
import { Hand } from "./hand";
import { BidControls } from "./bid-controls";
import { TrumpSelector } from "./trump-selector";
import { DiscardControls } from "./discard-controls";
import { TrickArea } from "./trick-area";
import { TrickHistory } from "./trick-history";

interface GameBoardProps {
  gameId: string;
  activeRound: SpikeActiveRound | null;
  isCompleted: boolean;
  winner: PlayerInGame | null;
  hand: CardType[];
  scores: Record<string, number>;
  playerNames: Map<string, string>;
  myTurn: boolean;
  isStale: boolean;
  playerId: string;
  onActionComplete: () => Promise<void>;
  onRefresh?: () => Promise<void>;
  isRefreshing?: boolean;
}

export function GameBoard({
  gameId,
  activeRound,
  isCompleted,
  winner,
  hand,
  scores,
  playerNames,
  myTurn,
  isStale,
  playerId,
  onActionComplete,
  onRefresh,
  isRefreshing,
}: GameBoardProps) {
  const [actionInFlight, setActionInFlight] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function doAction(action: GameAction) {
    if (!activeRound || actionInFlight) return;
    setActionInFlight(true);
    setActionError(null);
    try {
      await performAction(playerId, gameId, action);
      await onActionComplete();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionInFlight(false);
    }
  }

  if (isCompleted && winner) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg bg-green-50 p-6 text-center dark:bg-green-900">
          <h2 className="text-xl font-bold dark:text-gray-100">Game Over</h2>
          <p className="mt-2 text-lg dark:text-gray-200">
            Winner:{" "}
            <span className="font-semibold">
              {playerNames.get(winner.id) ?? winner.id.slice(0, 8)}
            </span>
          </p>
        </div>
        <ScoreBoard
          scores={scores}
          currentPlayerId={playerId}
          playerNames={playerNames}
        />
      </div>
    );
  }

  if (!activeRound) return null;

  const phase = activeRound.status;

  return (
    <div className="flex flex-col gap-4">
      <RoundHeader
        phase={phase}
        dealerPlayerId={activeRound.dealer_player_id}
        bidderPlayerId={activeRound.bidder_player_id}
        bidAmount={activeRound.bid_amount}
        trump={activeRound.trump}
        activePlayerId={activeRound.active_player_id}
        playerId={playerId}
        playerNames={playerNames}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        isStale={isStale}
      />

      {activeRound.bid_history.length > 0 && (
        <BidHistoryPanel
          bidHistory={activeRound.bid_history}
          playerNames={playerNames}
        />
      )}

      {actionError && (
        <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900 dark:text-red-300">
          {actionError}
        </div>
      )}

      {phase === "BIDDING" && myTurn && (
        <BidControls
          currentBid={activeRound.bid_amount}
          canMatchCurrentBid={activeRound.dealer_player_id === playerId}
          disabled={actionInFlight}
          onBid={(amount: BidValue) => doAction({ type: "BID", amount })}
        />
      )}

      {phase === "TRUMP_SELECTION" && myTurn && (
        <TrumpSelector
          disabled={actionInFlight}
          onSelect={(suit: SelectableSuit) =>
            doAction({ type: "SELECT_TRUMP", suit })
          }
        />
      )}

      {phase === "DISCARD" && myTurn && (
        <DiscardControls
          cards={hand}
          trump={activeRound.trump}
          disabled={actionInFlight}
          onDiscard={(cards: CardType[]) =>
            doAction({ type: "DISCARD", cards })
          }
        />
      )}

      {Object.keys(activeRound.discards).length > 0 && (
        <DiscardArea
          discards={activeRound.discards}
          playerId={playerId}
          playerNames={playerNames}
        />
      )}

      {phase === "TRICKS" && (
        <TrickArea tricks={activeRound.tricks} playerNames={playerNames} />
      )}

      {phase === "TRICKS" && (
        <TrickHistory tricks={activeRound.tricks} playerNames={playerNames} />
      )}

      {phase === "TRICKS" && myTurn && (
        <Hand
          cards={hand}
          selectable
          disabled={actionInFlight}
          onSelect={(card: CardType) => doAction({ type: "PLAY", card })}
        />
      )}

      {hand.length > 0 &&
        !(phase === "DISCARD" && myTurn) &&
        !(phase === "TRICKS" && myTurn) && <Hand cards={hand} />}
    </div>
  );
}
