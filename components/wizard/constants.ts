/**
 * Presentational-only constants for the wizard's own markup: icons and one-line blurbs for
 * the event type cards. Nothing here is a rule; the defaults a type pre-fills live in
 * lib/view/wizard.ts and in LocationPicker's own STARTING_MODE.
 */
import { CircleEllipsisIcon, HomeIcon, MedalIcon, MicIcon, PartyPopperIcon, StoreIcon, UsersIcon, type LucideIcon } from "lucide-react";
import type { EventType } from "@/lib/types";

export const EVENT_TYPE_ICON: Record<EventType, LucideIcon> = {
  picnic_party: PartyPopperIcon,
  performance_rally: MicIcon,
  market_festival: StoreIcon,
  race_parade: MedalIcon,
  block_party: HomeIcon,
  class_meetup: UsersIcon,
  other: CircleEllipsisIcon,
};

export const EVENT_TYPE_BLURB: Record<EventType, string> = {
  picnic_party: "A picnic, reunion or private party at a bookable space.",
  performance_rally: "A concert, show or rally in a plaza or open area.",
  market_festival: "A market or festival in a plaza, a park or on a street.",
  race_parade: "A race or parade along a street route.",
  block_party: "A neighborhood block party on a residential street.",
  class_meetup: "A recurring class or club meetup, usually weekly.",
  other: "Something else. Say what it is in the description.",
};
