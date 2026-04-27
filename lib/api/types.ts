// API response types matching the backend schemas

export type Suit = "HEARTS" | "DIAMONDS" | "CLUBS" | "SPADES" | "JOKER";
export type SelectableSuit = "HEARTS" | "DIAMONDS" | "CLUBS" | "SPADES";
export type CardNumber =
  | "TWO"
  | "THREE"
  | "FOUR"
  | "FIVE"
  | "SIX"
  | "SEVEN"
  | "EIGHT"
  | "NINE"
  | "TEN"
  | "JACK"
  | "QUEEN"
  | "KING"
  | "ACE"
  | "JOKER";
export type BidValue = 0 | 15 | 20 | 25 | 30 | 60;

export interface Card {
  number: CardNumber;
  suit: Suit;
}

export interface Player {
  id: string;
  name: string;
  pictureUrl: string | null;
}

export interface PlayerInGame {
  id: string;
  type: "human" | "cpu-easy";
}

export interface Lobby {
  id: string;
  name: string;
  accessibility: "PUBLIC" | "PRIVATE";
  organizer: PlayerInGame;
  players: PlayerInGame[];
  invitees: PlayerInGame[];
}

export interface Trick {
  bleeding: boolean;
  plays: EnactedPlay[];
  winningPlay: EnactedPlay | null;
}

export interface EnactedBid {
  type: "BID";
  playerId: string;
  amount: number;
}

export interface EnactedDiscard {
  type: "DISCARD";
  playerId: string;
  cards: Card[];
}

export interface EnactedSelectTrump {
  type: "SELECT_TRUMP";
  playerId: string;
  suit: SelectableSuit;
}

export interface EnactedPlay {
  type: "PLAY";
  playerId: string;
  card: Card;
}

export type GameAction =
  | { type: "BID"; amount: BidValue }
  | { type: "SELECT_TRUMP"; suit: SelectableSuit }
  | { type: "DISCARD"; cards: Card[] }
  | { type: "PLAY"; card: Card };

export interface SearchRequest {
  searchText: string;
  offset: number;
  limit: number;
}

export interface ApiEvent {
  sequence: number;
  content:
    | EnactedBid
    | EnactedDiscard
    | EnactedPlay
    | EnactedSelectTrump
    | unknown;
}

export interface DiscardRecord {
  discarded: Card[];
  received: Card[];
}

export interface Game {
  id: string;
  name: string;
  players: PlayerInGame[];
  scores: Record<string, number>;
  active: ActiveGameState;
  completedRounds: CompletedRound[];
}

export type ActiveGameState = ActiveRound | WonInformation;

export interface WonInformation {
  status: "WON";
  winnerPlayerId: string;
}

// ─── Type guards ─────────────────────────────────────────────────────────────

/** Returns true when the active game state is an in-progress round (not WON). */
export function isActiveRound(active: ActiveGameState): active is ActiveRound {
  return active.status !== "WON";
}

/** Returns true when the active game state represents a won game. */
export function isWonGame(active: ActiveGameState): active is WonInformation {
  return active.status === "WON";
}

export type CompletedRound = CompletedWithBidderRound | CompletedNoBiddersRound;

export interface CompletedWithBidderRound {
  status: "COMPLETED";
  dealerPlayerId: string;
  trump: SelectableSuit;
  bidHistory: EnactedBid[];
  bid: EnactedBid | null;
  initialHands: Record<string, Card[]>;
  discards: Record<string, DiscardRecord>;
  tricks: Trick[];
  scores: Record<string, number>;
}

export interface CompletedNoBiddersRound {
  status: "COMPLETED_NO_BIDDERS";
  dealerPlayerId: string;
  initialHands: Record<string, Card[]>;
}

export interface ActiveRound {
  status: "BIDDING" | "TRUMP_SELECTION" | "DISCARD" | "TRICKS";
  dealerPlayerId: string;
  bidHistory: EnactedBid[];
  bid: EnactedBid | null;
  hands: Record<string, Card[] | number>;
  trump: SelectableSuit | null;
  discards: Record<string, DiscardRecord | number>;
  tricks: Trick[];
  activePlayerId: string;
  queuedActions: unknown[];
}
