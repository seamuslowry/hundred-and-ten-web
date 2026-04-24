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
  picture_url: string | null;
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
  plays: PlayCard[];
  winning_play: PlayCard | null;
}

export interface PlayCard {
  type: "PLAY";
  player_id: string;
  card: Card;
}

export type GameAction =
  | { type: "BID"; amount: BidValue }
  | { type: "SELECT_TRUMP"; suit: SelectableSuit }
  | { type: "DISCARD"; cards: Card[] }
  | { type: "PLAY"; card: Card };

export type Suggestion =
  | { type: "BID"; player_id: string; amount: BidValue }
  | { type: "SELECT_TRUMP"; player_id: string; suit: SelectableSuit }
  | { type: "DISCARD"; player_id: string; cards: Card[] }
  | { type: "PLAY"; player_id: string; card: Card };

export interface SearchRequest {
  searchText: string;
  offset: number;
  limit: number;
}

export interface ApiEvent {
  [key: string]: unknown;
}

// Spike endpoint types — round-based game response

export interface SpikeBid {
  player_id: string;
  amount: number;
}

export interface SpikeGame {
  id: string;
  name: string;
  status: string;
  winner: PlayerInGame | null;
  players: PlayerInGame[];
  scores: Record<string, number>;
  rounds: SpikeRound[];
}

export type SpikeRound =
  | SpikeCompletedRound
  | SpikeCompletedNoBiddersRound
  | SpikeActiveRound;

export interface SpikeCompletedRound {
  status: "COMPLETED";
  dealer_player_id: string;
  bidder_player_id: string;
  bid_amount: number;
  trump: SelectableSuit;
  bid_history: SpikeBid[];
  hands: Record<string, Card[]>;
  discards: Record<string, Card[]>;
  tricks: Trick[];
  scores: Record<string, number>;
}

export interface SpikeCompletedNoBiddersRound {
  status: "COMPLETED_NO_BIDDERS";
  dealer_player_id: string;
  initial_hands: Record<string, Card[]>;
}

export interface SpikeActiveRound {
  status: "BIDDING" | "TRUMP_SELECTION" | "DISCARD" | "TRICKS";
  dealer_player_id: string;
  bid_history: SpikeBid[];
  hands: Record<string, Card[] | number>;
  discards: Record<string, Card[] | number>;
  bidder_player_id: string | null;
  bid_amount: number | null;
  trump: SelectableSuit | null;
  tricks: Trick[];
  active_player_id: string;
  queued_actions: unknown[];
}
