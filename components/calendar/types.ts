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
}
