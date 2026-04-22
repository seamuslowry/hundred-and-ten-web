
import { useState, useEffect } from "react";
import type { Suggestion } from "@/lib/api/types";
import { getSuggestions } from "@/lib/api/games";

interface UseSuggestionsOptions {
  playerId: string;
  gameId: string;
  myTurn: boolean;
}

export function useSuggestions({
  playerId,
  gameId,
  myTurn,
}: UseSuggestionsOptions) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showHints, setShowHints] = useState(false);

  useEffect(() => {
    if (!myTurn || !playerId || !gameId) {
      const t = setTimeout(() => setSuggestions([]), 0);
      return () => clearTimeout(t);
    }
    let cancelled = false;
    async function load() {
      try {
        const result = await getSuggestions(playerId, gameId);
        if (!cancelled) setSuggestions(result);
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [playerId, gameId, myTurn]);

  function toggleHints() {
    setShowHints((prev) => !prev);
  }

  return {
    suggestions: showHints ? suggestions : [],
    allSuggestions: suggestions,
    showHints,
    toggleHints,
    hasSuggestions: suggestions.length > 0,
  };
}
