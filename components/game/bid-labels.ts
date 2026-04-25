import type { BidValue } from "@/lib/api/types";

/** Display labels for bid amounts, matching the mockup's word-based style. */
export const BID_LABEL: Record<BidValue, string> = {
  0: "Pass",
  15: "Fifteen",
  20: "Twenty",
  25: "Twenty Five",
  30: "Thirty",
  60: "Shoot the Moon",
};
