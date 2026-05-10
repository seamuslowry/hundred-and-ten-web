import type { SelectableSuit } from "@/lib/api/types";

interface TrumpSelectorProps {
  disabled?: boolean;
  onSelect: (suit: SelectableSuit) => void;
}

const SUITS: { suit: SelectableSuit; symbol: string; color: string }[] = [
  { suit: "HEARTS", symbol: "\u2665", color: "text-red-600 dark:text-red-400" },
  {
    suit: "DIAMONDS",
    symbol: "\u2666",
    color: "text-red-600 dark:text-red-400",
  },
  {
    suit: "CLUBS",
    symbol: "\u2663",
    color: "text-gray-900 dark:text-gray-100",
  },
  {
    suit: "SPADES",
    symbol: "\u2660",
    color: "text-gray-900 dark:text-gray-100",
  },
];

export function TrumpSelector({ disabled, onSelect }: TrumpSelectorProps) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <h3 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
        Select Trump
      </h3>
      <div className="flex gap-3">
        {SUITS.map(({ suit, symbol, color }) => (
          <button
            key={suit}
            type="button"
            onClick={() => onSelect(suit)}
            disabled={disabled}
            className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border-2 border-gray-200 bg-white px-4 py-2 text-2xl hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-blue-500 dark:hover:bg-blue-900 ${color}`}
            aria-label={suit.toLowerCase()}
          >
            {symbol}
          </button>
        ))}
      </div>
    </div>
  );
}
