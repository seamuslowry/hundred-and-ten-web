import type {
  CompletedWithBidderRound,
  CompletedNoBiddersRound,
  Card as CardType,
} from "@/lib/api/types";
import { SUIT_SYMBOL, NUMBER_LABEL } from "./card-labels";
import { BidHistoryPanel } from "./bid-history-panel";

interface CompletedRoundViewProps {
  round: CompletedWithBidderRound | CompletedNoBiddersRound;
  roundIndex: number;
  expanded: boolean;
  onToggle: () => void;
  playerNames: Map<string, string>;
}

function displayName(id: string, playerNames: Map<string, string>): string {
  return playerNames.get(id) ?? id.slice(0, 8);
}

function cardLabel(card: CardType): string {
  if (card.suit === "JOKER") return "Joker";
  return `${NUMBER_LABEL[card.number]}${SUIT_SYMBOL[card.suit]}`;
}

function cardTextColor(card: CardType): string {
  if (card.suit === "JOKER") return "text-purple-600 dark:text-purple-400";
  if (card.suit === "HEARTS" || card.suit === "DIAMONDS")
    return "text-red-600 dark:text-red-400";
  return "text-gray-900 dark:text-gray-100";
}

function CardList({ cards }: { cards: CardType[] }) {
  if (cards.length === 0)
    return <span className="text-xs text-gray-400 dark:text-gray-500">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {cards.map((card, i) => (
        <span
          key={`${card.number}-${card.suit}-${i}`}
          className={`rounded border border-gray-200 px-1.5 py-0.5 text-xs font-medium dark:border-gray-600 ${cardTextColor(card)}`}
        >
          {cardLabel(card)}
        </span>
      ))}
    </div>
  );
}

export function CompletedRoundView({
  round,
  roundIndex,
  expanded,
  onToggle,
  playerNames,
}: CompletedRoundViewProps) {
  const isCompleted = round.status === "COMPLETED";
  const completedRound = isCompleted
    ? (round as CompletedWithBidderRound)
    : null;

  return (
    <div className="border-t border-gray-200 dark:border-gray-700">
      {/* Compact header row */}
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
        aria-expanded={expanded}
      >
        <span className="text-xs">{expanded ? "▲" : "▼"}</span>
        <span className="font-medium text-gray-700 dark:text-gray-200">
          Round {roundIndex + 1}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Dealer: {displayName(round.dealerPlayerId, playerNames)}
        </span>
        {isCompleted && completedRound ? (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Bidder:{" "}
            {completedRound.bid
              ? `${displayName(completedRound.bid.playerId, playerNames)} @ ${completedRound.bid.amount}`
              : "(none)"}
          </span>
        ) : (
          <span className="text-sm text-gray-400 dark:text-gray-500">
            No bids
          </span>
        )}
        {isCompleted && completedRound && (
          <div className="ml-auto flex gap-3">
            {Object.entries(completedRound.scores).map(([playerId, score]) => (
              <span
                key={playerId}
                className="text-xs text-gray-500 dark:text-gray-400"
              >
                {displayName(playerId, playerNames)}:{" "}
                {score > 0 ? `+${score}` : score}
              </span>
            ))}
          </div>
        )}
      </button>

      {/* Expanded view */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 dark:border-gray-700/50">
          {isCompleted && completedRound ? (
            <div className="flex flex-col gap-4">
              {/* Trump */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  Trump:
                </span>
                <span className="text-lg font-bold">
                  {SUIT_SYMBOL[completedRound.trump]}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {completedRound.trump}
                </span>
              </div>

              {/* Bid history */}
              <BidHistoryPanel
                bidHistory={completedRound.bidHistory}
                playerNames={playerNames}
              />

              {/* Initial Hands */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Initial Hands
                </p>
                <div className="flex flex-col gap-2">
                  {Object.entries(completedRound.initialHands).map(
                    ([playerId, cards]) => (
                      <div key={playerId} className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                          {displayName(playerId, playerNames)}
                        </span>
                        <CardList cards={cards} />
                      </div>
                    ),
                  )}
                </div>
              </div>

              {/* Discards */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Discards
                </p>
                <div className="flex flex-col gap-2">
                  {Object.entries(completedRound.discards).map(
                    ([playerId, discard]) => (
                      <div key={playerId} className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                          {displayName(playerId, playerNames)}
                        </span>
                        <CardList cards={discard.discarded} />
                        {discard.received.length > 0 && (
                          <>
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              Received
                            </span>
                            <CardList cards={discard.received} />
                          </>
                        )}
                      </div>
                    ),
                  )}
                </div>
              </div>

              {/* Tricks */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Tricks
                </p>
                <div className="flex flex-col gap-2">
                  {completedRound.tricks.map((trick, i) => (
                    <div
                      key={i}
                      className="rounded border border-gray-100 p-2 dark:border-gray-700"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Trick {i + 1}
                        </span>
                        {trick.winningPlay && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            Won by{" "}
                            {displayName(
                              trick.winningPlay.playerId,
                              playerNames,
                            )}
                          </span>
                        )}
                        {trick.bleeding && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600 dark:bg-red-900 dark:text-red-300">
                            Bleeding
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {trick.plays.map((play) => {
                          const isWinning =
                            trick.winningPlay?.playerId === play.playerId;
                          return (
                            <div
                              key={`${play.playerId}-${play.card.number}-${play.card.suit}`}
                              className={`flex min-w-[50px] flex-col items-center rounded-lg border-2 p-1.5 ${
                                isWinning
                                  ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-900"
                                  : "border-gray-200 dark:border-gray-600"
                              }`}
                            >
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {displayName(play.playerId, playerNames)}
                              </span>
                              <span
                                className={`text-base font-bold ${cardTextColor(play.card)}`}
                              >
                                {cardLabel(play.card)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scores */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Round Scores
                </p>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(completedRound.scores).map(
                    ([playerId, score]) => (
                      <div
                        key={playerId}
                        className="flex flex-col items-center rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-600"
                      >
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {displayName(playerId, playerNames)}
                        </span>
                        <span className="text-lg font-bold text-gray-800 dark:text-gray-100">
                          {score > 0 ? `+${score}` : score}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No bids — round was skipped
              </p>
              {/* Initial hands for no-bidder rounds */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Initial Hands
                </p>
                <div className="flex flex-col gap-2">
                  {Object.entries(
                    (round as CompletedNoBiddersRound).initialHands,
                  ).map(([playerId, cards]) => (
                    <div key={playerId} className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        {displayName(playerId, playerNames)}
                      </span>
                      <CardList cards={cards} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
