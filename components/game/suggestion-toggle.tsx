"use client";

interface SuggestionToggleProps {
  showHints: boolean;
  hasSuggestions: boolean;
  onToggle: () => void;
}

export function SuggestionToggle({
  showHints,
  hasSuggestions,
  onToggle,
}: SuggestionToggleProps) {
  if (!hasSuggestions) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        showHints
          ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {showHints ? "Hide hints" : "Show hints"}
    </button>
  );
}
