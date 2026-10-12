import type { Tier } from "@/lib/types";

/** Tier color is always paired with the spelled-out tier name; these are the dot/chip classes. */
export const TIER_DOT_CLASS: Record<Tier, string> = {
  instant: "bg-tier-instant",
  reviewed: "bg-tier-reviewed",
  special: "bg-tier-special",
};

export const TIER_CHIP_CLASS: Record<Tier, string> = {
  instant: "bg-tier-instant-surface text-tier-instant-fg",
  reviewed: "bg-tier-reviewed-surface text-tier-reviewed-fg",
  special: "bg-tier-special-surface text-tier-special-fg",
};
