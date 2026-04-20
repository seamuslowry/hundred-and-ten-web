"use client";

import type { BidValue } from "@/lib/api/types";

interface BidControlsProps {
  currentBid: number | null;
  disabled?: boolean;
  onBid: (amount: BidValue) => void;
  suggestedBids?: BidValue[];
}

const BID_VALUES: BidValue[] = [15, 20, 25, 30, 60];

export function BidControls({
  currentBid,
  disabled,
  onBid,
  suggestedBids = [],
}: BidControlsProps) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <h3 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">Place Your Bid</h3>
      <div className="flex flex-wrap gap-2">
        {BID_VALUES.map((value) => {
          const isSuggested = suggestedBids.includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => onBid(value)}
              disabled={
                disabled || (currentBid !== null && value <= currentBid)
              }
              className={`min-h-[44px] min-w-[44px] rounded-lg px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400 ${
                isSuggested
                  ? "bg-amber-500 ring-2 ring-amber-300 hover:bg-amber-600 dark:ring-amber-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {value}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onBid(0)}
          disabled={disabled}
          className="min-h-[44px] rounded-lg bg-gray-200 px-4 py-2 font-medium text-gray-700 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          Pass
        </button>
      </div>
    </div>
  );
}
