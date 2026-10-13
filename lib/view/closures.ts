/**
 * Pure view-model for Closures and routes (workstream 5C): what the Permitopolis map and its
 * side list show for a chosen date range, overlaps between closures, and the calendar strip's
 * per-day counts and blackout/impacted marks. No React, no store: `ClosuresMapScreen` reads
 * `cases` and `demoToday` off the store and passes them in. Tested against the real seed in
 * `lib/view/closures.test.ts`.
 *
 * Status is broader than the selectors in `lib/state`: "held" is any open case whose date is
 * held (accepted, in review, or a quote sent), not only `holdsDateAtQuote()`'s quote-sent case,
 * because the map has to show a date the Clerk accepted before routing finished too.
 */
import { citywideBlackoutOn } from "@/lib/rules";
import { fmtTime, fmtTimeRange, plural } from "@/lib/format";
import { addDaysISO, datesEvery } from "@/lib/dates";
import { impactedOn } from "@/components/calendar/utils";
import { occupiedIds } from "@/components/map/geometry";
import type { MapHighlight } from "@/components/map/types";
import { getSegment } from "@/lib/data/streets";
import { getSpace } from "@/lib/data/inventory";
import { hasActivePermit, sessionDates } from "@/lib/state";
import type { EventCase, ISODate, Location } from "@/lib/types";

export type ClosureStatus = "permitted" | "held" | "pending";

export const CLOSURE_STATUS_LABEL: Record<ClosureStatus, string> = {
  permitted: "Permitted",
  held: "Date held",
  pending: "Pending review",
};

/**
 * A case's status for the closures map: Permitted (a live permit); a date hold (accepted at
 * intake, under review, or a quote sent, any of which hold the date); or pending, submitted or
 * in review but not yet holding the date (an application still competing for it). Null for a
 * case that never shows on this map: ended, a Draft, or nothing booked.
 */
export function closureStatus(c: EventCase): ClosureStatus | null {
  if (c.ending !== null || !c.location) return null;
  if (hasActivePermit(c)) return "permitted";
  if (c.dateHold.status === "held") return "held";
  if (c.state === "submitted" || c.state === "in_review" || c.state === "needs_info") return "pending";
  return null;
}

/** A street or route closure, as opposed to an occupied plaza, open area or bookable space. */
export function occupiesStreet(location: Location): boolean {
  return location.mode === "streets" || location.mode === "route";
}

export interface ClosureRange {
  from: ISODate;
  to: ISODate;
}

export interface ClosureItem {
  case: EventCase;
  status: ClosureStatus;
  /** This case's session dates that fall inside the range, in order. */
  dates: ISODate[];
}

export interface ClosureFilters {
  status?: ClosureStatus;
  streetsOnly?: boolean;
}

/** Every closure, route and occupied space on the map for a date range, one entry per case. */
export function closuresInRange(cases: EventCase[], range: ClosureRange, filters: ClosureFilters = {}): ClosureItem[] {
  const items: ClosureItem[] = [];
  for (const c of cases) {
    const status = closureStatus(c);
    if (!status || !c.location) continue;
    if (filters.status && status !== filters.status) continue;
    if (filters.streetsOnly && !occupiesStreet(c.location)) continue;
    const dates = sessionDates(c).filter((d) => d >= range.from && d <= range.to);
    if (dates.length === 0) continue;
    items.push({ case: c, status, dates });
  }
  return items.sort((a, b) => a.dates[0].localeCompare(b.dates[0]) || a.case.id.localeCompare(b.case.id));
}

/** What `PermitopolisMap` draws: one highlight per case, its own location, tier and status. */
export function closureHighlights(items: ClosureItem[]): MapHighlight[] {
  return items.map((item) => ({
    id: item.case.id,
    location: item.case.location as Location,
    status: item.status,
    tier: item.case.tier,
    label: item.case.name,
  }));
}

/** "7 to 11 am", the event's own hours, no setup or teardown: what the overlap line names. */
export function closureEventHours(c: EventCase): string {
  if (!c.schedule) return "";
  return fmtTimeRange(c.schedule.start, c.schedule.end);
}

/** "7 to 11 am (setup 6 am, teardown 11:30 am)": the side list's own hours, setup through teardown. */
export function closureHoursLabel(c: EventCase): string {
  if (!c.schedule) return "";
  const { start, end, setupStart, teardownEnd } = c.schedule;
  const main = fmtTimeRange(start, end);
  if (!setupStart && !teardownEnd) return main;
  const bits: string[] = [];
  if (setupStart) bits.push(`setup ${fmtTime(setupStart)}`);
  if (teardownEnd) bits.push(`teardown ${fmtTime(teardownEnd)}`);
  return `${main} (${bits.join(", ")})`;
}

/** A segment or space id's plain-language name, for the overlap line. */
function labelForOccupiedId(id: string): string {
  return getSegment(id)?.label ?? getSpace(id)?.label ?? id;
}

export interface ClosureOverlap {
  date: ISODate;
  /** The shared segments or space, joined, e.g. "Main Street, 2nd to 3rd Avenue". */
  sharedLabel: string;
  a: { case: EventCase; hours: string };
  b: { case: EventCase; hours: string };
}

/** "Main Street, 2nd to 3rd Avenue: Art Walk 5 to 10 pm and Summer Market 9 am to 6 pm." */
export function formatOverlap(overlap: ClosureOverlap): string {
  return `${overlap.sharedLabel}: ${overlap.a.case.name} ${overlap.a.hours} and ${overlap.b.case.name} ${overlap.b.hours}.`;
}

/**
 * Two bookings that share a street segment or a space on the same date: named with both
 * events, what is shared, and each one's own hours. One entry per overlapping pair per shared
 * date; a route that laps its own segments never overlaps itself (`occupiedIds` is a set).
 */
export function closureOverlaps(items: ClosureItem[]): ClosureOverlap[] {
  const overlaps: ClosureOverlap[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      const idsA = new Set(occupiedIds(a.case.location as Location));
      const sharedIds = [...new Set(occupiedIds(b.case.location as Location))].filter((id) => idsA.has(id));
      if (sharedIds.length === 0) continue;
      const sharedLabel = sharedIds.map(labelForOccupiedId).join(", ");
      const sharedDates = a.dates.filter((d) => b.dates.includes(d));
      for (const date of sharedDates) {
        overlaps.push({
          date,
          sharedLabel,
          a: { case: a.case, hours: closureEventHours(a.case) },
          b: { case: b.case, hours: closureEventHours(b.case) },
        });
      }
    }
  }
  return overlaps.sort((x, y) => x.date.localeCompare(y.date) || x.sharedLabel.localeCompare(y.sharedLabel));
}

/* ---------- the calendar strip ---------- */

export interface ClosureDay {
  date: ISODate;
  /** Everything on the map that day: `closures` and `bookings` together, the figure the side list counts. */
  count: number;
  /** Streets and routes closed. */
  closures: number;
  /** Plazas, open areas and bookable spaces occupied: on the map, but no street is closed for them. */
  bookings: number;
  blackoutLabel: string | null;
  impactedReason: string | null;
}

/** Every day in the range, for the calendar strip: what is on the map, closures and bookings apart, and the blackout and impacted marks. */
export function closureCalendarDays(range: ClosureRange, items: ClosureItem[]): ClosureDay[] {
  return datesEvery(range.from, range.to, 1).map((date) => {
    const onTheDay = items.filter((item) => item.dates.includes(date));
    const closures = onTheDay.filter((item) => item.case.location && occupiesStreet(item.case.location)).length;
    return { date, count: onTheDay.length, closures, bookings: onTheDay.length - closures, blackoutLabel: citywideBlackoutOn(date), impactedReason: impactedOn(date)[0]?.reason ?? null };
  });
}

/** A day of the strip in words: "1 closure, 2 bookings". A tai chi class on a field is a booking, never a closure. */
export function closureDayLabel(day: ClosureDay): string {
  const parts = [day.closures > 0 ? plural(day.closures, "closure") : null, day.bookings > 0 ? plural(day.bookings, "booking") : null].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(", ") : "No closures or bookings";
}

/* ---------- the URL ---------- */

export type ClosuresRangeMode = "day" | "week" | "range";

export interface ClosuresMapFilters {
  mode: ClosuresRangeMode;
  from: ISODate;
  to: ISODate;
  status?: ClosureStatus;
  streetsOnly: boolean;
}

function isoDateParam(value: string | null): ISODate | undefined {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : undefined;
}

/** Parses `/city/map`'s own query string, defaulting to today, a single day. */
export function parseClosuresFilters(search: URLSearchParams, today: ISODate): ClosuresMapFilters {
  const modeParam = search.get("mode");
  const mode: ClosuresRangeMode = modeParam === "week" || modeParam === "range" ? modeParam : "day";
  const from = isoDateParam(search.get("from")) ?? today;
  let to = mode === "range" ? (isoDateParam(search.get("to")) ?? from) : mode === "week" ? addDaysISO(from, 6) : from;
  if (to < from) to = from;
  const statusParam = search.get("status");
  const status = statusParam === "permitted" || statusParam === "held" || statusParam === "pending" ? statusParam : undefined;
  return { mode, from, to, status, streetsOnly: search.get("streets") === "1" };
}

/** Serializes `ClosuresMapFilters` back to a query string, `/city/map`'s own. */
export function closuresQueryString(filters: ClosuresMapFilters): string {
  const params = new URLSearchParams();
  if (filters.mode !== "day") params.set("mode", filters.mode);
  params.set("from", filters.from);
  if (filters.mode === "range") params.set("to", filters.to);
  if (filters.status) params.set("status", filters.status);
  if (filters.streetsOnly) params.set("streets", "1");
  return params.toString();
}
