import type { HHmm, ISODate, Tier } from "@/lib/types";

/**
 * Shared shape every calendar view renders. Owned by workstream 2C
 * (`components/calendar`); surfaces build these from `EventCase`s or seed fixtures.
 */
export interface CalendarItem {
  id: string;
  date: ISODate;
  start?: HHmm;
  end?: HHmm;
  label: string;
  tier: Tier;
  status?: string;
  /**
   * What the item is. An event (the default) is drawn with its tier's dot and icon. A meeting
   * (a pre-application meeting, a coordination meeting, a site walkthrough) is drawn as an
   * outlined item with a meeting icon and "Meeting:" before its name: never color alone.
   */
  kind?: "event" | "meeting";
  /** The whole of it for a tooltip, when the cell has no room: who attends a meeting, which event it is for. */
  detail?: string;
}
