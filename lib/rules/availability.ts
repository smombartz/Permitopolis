/**
 * availability() and occurrences(). Precedence: blackout, then booked, then
 * impacted, then open. Blackout and impacted dates are reference data
 * (lib/data/calendar.ts); booked comes from the other cases on ctx.
 */
import { BLACKOUTS, IMPACTED } from "@/lib/data/calendar";
import { addDaysISO, daysBetween, datesEvery, minutesOf, timesOverlap, weekdayOf } from "@/lib/dates";
import type { Availability, EventCase, HHmm, ISODate, Location, Occurrence, Schedule } from "@/lib/types";
import { isParkLocation, locationsOverlap, occupiedWindow, spaceIdsOf, streetsOf, zonesOf } from "./shared";
import type { RulesCtx } from "./types";

type Window = { date: ISODate; start: HHmm; end: HHmm };

function blackoutFor(location: Location, window: Window): Availability | null {
  for (const b of BLACKOUTS) {
    if (b.date !== window.date) continue;
    const coversAllParks = b.allParks && isParkLocation(location);
    const coversBySpace = b.spaceIds?.some((id) => spaceIdsOf(location).includes(id)) ?? false;
    if (!coversAllParks && !coversBySpace) continue;
    if (b.from && minutesOf(window.end) <= minutesOf(b.from)) continue;
    return { status: "blackout", reason: b.label };
  }
  return null;
}

function scheduleHasDate(schedule: Schedule, date: ISODate): boolean {
  // A session the series skips (a blackout date) does not take the slot.
  if (schedule.occurrences.some((o) => o.date === date && o.billing === "skipped")) return false;
  if (!schedule.recurrence) return schedule.date === date;
  if (date < schedule.date || date > schedule.recurrence.until) return false;
  if (weekdayOf(date) !== schedule.recurrence.weekday) return false;
  const step = schedule.recurrence.frequency === "weekly" ? 7 : 14;
  return daysBetween(schedule.date, date) % step === 0;
}

function bookedFor(location: Location, window: Window, ctx: RulesCtx, ignoreCaseId?: string): Availability | null {
  for (const other of ctx.cases) {
    if (other.id === ignoreCaseId) continue;
    if (!isBooked(other)) continue;
    if (!other.location || !other.schedule) continue;
    if (!locationsOverlap(location, other.location)) continue;
    if (!scheduleHasDate(other.schedule, window.date)) continue;
    const occ = occupiedWindow(other.schedule);
    if (!timesOverlap(window.start, window.end, occ.start, occ.end)) continue;
    return { status: "booked", reason: `${other.name} has this date held` };
  }
  return null;
}

function impactedFor(location: Location, window: Window, ignoreCaseId?: string): Availability | null {
  for (const imp of IMPACTED) {
    if (imp.date !== window.date) continue;
    if (imp.caseId === ignoreCaseId) continue;
    const touchesStreet = streetsOf(location).some((name) => imp.streets.includes(name));
    const touchesSpace = spaceIdsOf(location).some((id) => imp.spaceIds.includes(id));
    const touchesZone = zonesOf(location).some((z) => imp.zones.includes(z));
    if (touchesStreet || touchesSpace || touchesZone) return { status: "impacted", reason: imp.reason };
  }
  return null;
}

/** The status only, with no nextOpen lookup — used internally to avoid recursion. */
function statusOnly(location: Location, window: Window, ctx: RulesCtx, ignoreCaseId?: string): Availability["status"] {
  return (
    blackoutFor(location, window)?.status ??
    bookedFor(location, window, ctx, ignoreCaseId)?.status ??
    impactedFor(location, window, ignoreCaseId)?.status ??
    "open"
  );
}

function nextOpenDates(location: Location, window: Window, ctx: RulesCtx, ignoreCaseId?: string): ISODate[] {
  const found: ISODate[] = [];
  let date = window.date;
  for (let i = 0; i < 52 * 2 && found.length < 3; i++) {
    date = addDaysISO(date, 7);
    const status = statusOnly(location, { ...window, date }, ctx, ignoreCaseId);
    if (status === "open" || status === "impacted") found.push(date);
  }
  return found;
}

export const availability = (location: Location, window: Window, ctx: RulesCtx, ignoreCaseId?: string): Availability => {
  const blackout = blackoutFor(location, window);
  if (blackout) return { ...blackout, nextOpen: nextOpenDates(location, window, ctx, ignoreCaseId) };

  const booked = bookedFor(location, window, ctx, ignoreCaseId);
  if (booked) return { ...booked, nextOpen: nextOpenDates(location, window, ctx, ignoreCaseId) };

  const impacted = impactedFor(location, window, ignoreCaseId);
  if (impacted) return impacted;

  return { status: "open" };
};

export const occurrences = (schedule: Schedule, location: Location, ctx: RulesCtx, ignoreCaseId?: string): Occurrence[] => {
  const occ = occupiedWindow(schedule);
  const dates = schedule.recurrence ? datesEvery(schedule.date, schedule.recurrence.until, schedule.recurrence.frequency === "weekly" ? 7 : 14) : [schedule.date];
  return dates.map((date) => {
    const result = availability(location, { date, start: occ.start, end: occ.end }, ctx, ignoreCaseId);
    const billing: Occurrence["billing"] = result.status === "blackout" ? "skipped" : "upcoming";
    return { date, availability: result, billing };
  });
};

/**
 * Does this case take its slot? A date hold, or a permit that is still live. A case with an
 * ending (cancelled, denied, withdrawn, hold expired) keeps the state it ended in, so the
 * ending is checked first: a cancelled permit frees its date. Not part of RulesApi.
 */
export function isBooked(c: EventCase): boolean {
  if (c.ending) return false;
  return c.dateHold.status === "held" || c.state === "permitted" || c.state === "event_day" || c.state === "closeout";
}
