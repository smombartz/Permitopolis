/**
 * City calendar: blackout dates and impacted dates. Existing bookings are not listed
 * here; they come from the cases in the store.
 * Reference data, FROZEN after Phase 0.
 */
import type { HHmm, ISODate } from "@/lib/types";

export interface Blackout {
  date: ISODate;
  label: string;
  /** Applies from this time on. Absent: all day. */
  from?: HHmm;
  /** Every space with isPark. */
  allParks?: boolean;
  spaceIds?: string[];
}

export interface ImpactedDate {
  date: ISODate;
  from: HHmm;
  to: HHmm;
  /** Street names closed that day. */
  streets: string[];
  spaceIds: string[];
  /** Zones reached through the closed streets. */
  zones: string[];
  /** Shown to the applicant as the warning. */
  reason: string;
  /** The case that causes it; that case is never impacted by itself. */
  caseId: string;
}

export const BLACKOUTS: Blackout[] = [
  { date: "2027-05-31", label: "Memorial Day: all parks are closed to bookings", allParks: true },
  {
    date: "2027-07-04",
    label: "City fireworks: City Hall Plaza and the Great Lawn close at 4 pm",
    from: "16:00",
    spaceIds: ["city-hall-plaza", "great-lawn"],
  },
  {
    date: "2027-07-05",
    label: "Fireworks cleanup: City Hall Plaza and the Great Lawn are closed",
    spaceIds: ["city-hall-plaza", "great-lawn"],
  },
];

/**
 * An impacted date is a warning, never a block. It applies on that date to the listed
 * streets and spaces and to every space in the listed zones, at any time of day.
 */
export const IMPACTED: ImpactedDate[] = [
  {
    date: "2027-07-11",
    from: "06:00",
    to: "11:30",
    streets: ["Main Street", "River Road"],
    spaceIds: ["city-hall-plaza"],
    zones: ["riverside-park"],
    reason: "Riverfront Summer 5K closes Main Street 6 to 11:30 am that day",
    caseId: "PMT-27-0097",
  },
];
