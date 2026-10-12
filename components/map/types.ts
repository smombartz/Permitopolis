import type { Location, Tier } from "@/lib/types";

/** One colored, labeled thing to draw on `PermitopolisMap` or `MapThumbnail`. */
export interface MapHighlight {
  id: string;
  location: Location;
  status: "held" | "permitted" | "pending";
  tier: Tier;
  label: string;
}
