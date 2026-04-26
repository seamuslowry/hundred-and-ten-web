import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "@/store";
import type { ActiveRound, Card, CompletedRound } from "@/lib/api/types";
import { isActiveRound } from "./slice";

// ─── Base selector ──────────────────────────────────────────────────────────

export function selectGameById(state: RootState, gameId: string) {
  return state.games.byId[gameId];
}

// ─── Active round ───────────────────────────────────────────────────────────

/**
 * Returns the active round when the game is in-progress, or null when the
 * game is WON or the game is not yet loaded.
 */
export function selectActiveRound(
  state: RootState,
  gameId: string,
): ActiveRound | null {
  const game = state.games.byId[gameId];
  if (!game) return null;
  return isActiveRound(game.active) ? game.active : null;
}

// ─── Completed rounds (memoized) ────────────────────────────────────────────

/**
 * Returns the array of completed rounds. Memoized so referential equality is
 * stable across no-op state updates (prevents unnecessary re-renders).
 */
export const selectCompletedRounds = createSelector(
  [selectGameById],
  (game): CompletedRound[] => game?.completedRounds ?? [],
);

// ─── My turn ────────────────────────────────────────────────────────────────

/**
 * Returns true when it is the given player's turn in the active round.
 */
export function selectMyTurn(
  state: RootState,
  gameId: string,
  playerId: string,
): boolean {
  const game = state.games.byId[gameId];
  if (!game) return false;
  if (!isActiveRound(game.active)) return false;
  return game.active.activePlayerId === playerId;
}

// ─── My hand (memoized) ─────────────────────────────────────────────────────

/**
 * Returns the player's hand as Card[].
 * Falls back to [] when:
 *   - the game is not loaded
 *   - there is no active round (game is WON)
 *   - the hand value is a number (opponent hand size sentinel)
 *   - the hand entry is missing
 *
 * Preserves the Array.isArray check from lib/hooks/use-game-state.ts:60-61.
 */
export const selectMyHand = createSelector(
  [
    selectGameById,
    (_state: RootState, _gameId: string, playerId: string) => playerId,
  ],
  (game, playerId): Card[] => {
    if (!game) return [];
    if (!isActiveRound(game.active)) return [];
    const rawHand = game.active.hands[playerId];
    return Array.isArray(rawHand) ? rawHand : [];
  },
);
