"use client";

import type { BidValue } from "@/lib/api/types";

interface BidControlsProps {
  currentBid: number | null;
  canMatchCurrentBid?: boolean;
  disabled?: boolean;
  onBid: (amount: BidValue) => void;
}

const BID_VALUES: BidValue[] = [15, 20, 25, 30, 60];

function isBidValueDisabled(
  value: BidValue,
  currentBid: number | null,
  canMatchCurrentBid: boolean,
): boolean {
  if (currentBid === null) return false;
  return canMatchCurrentBid ? value < currentBid : value <= currentBid;
}

export function BidControls({
  currentBid,
  canMatchCurrentBid = false,
  disabled,
  onBid,
}: BidControlsProps) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <h3 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
        Place Your Bid
      </h3>
      <div className="flex flex-wrap gap-2">
        {BID_VALUES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onBid(value)}
            disabled={disabled || isBidValueDisabled(value, currentBid, canMatchCurrentBid)}
            className="min-h-[44px] min-w-[44px] rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
          >
            {value}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onBid(0)}
          disabled={disabled}
          className="min-h-[44px] rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
        >
          Pass
        </button>
      </div>
    </div>
  );
}
