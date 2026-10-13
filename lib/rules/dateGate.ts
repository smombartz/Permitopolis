/**
 * dateGate(): the lead-time and availability gate, with the fixes to offer
 * when it fails. A gate that passes offers none. A date that is too close offers
 * a new date, dropping an add-on (when one lowers the tier far enough) and the
 * late fee; a date that is booked or blacked out offers only a new date.
 */
import { addDaysISO, daysBetween } from "@/lib/dates";
import type { Availability, EventAnswers, ISODate } from "@/lib/types";
import { availability, occurrences } from "./availability";
import { estimateFees } from "./fees";
import { whatIf } from "./classify";
import { occupiedWindow, round2 } from "./shared";
import type { Classification, DateFix, DateGate, RulesCtx } from "./types";

const SEVERITY: Record<Availability["status"], number> = { open: 0, impacted: 1, booked: 2, blackout: 3 };

function worstAvailability(occs: { date: ISODate; availability: Availability }[]): Availability {
  if (occs.length === 0) return { status: "open" };
  const relevant = [occs[0], ...occs.slice(1).filter((o) => o.availability.status !== "blackout")];
  let worst = relevant[0].availability;
  for (const o of relevant) {
    if (SEVERITY[o.availability.status] > SEVERITY[worst.status]) worst = o.availability;
  }
  return worst;
}

function earliestOpenDate(a: EventAnswers, cls: Classification, ctx: RulesCtx, ignoreCaseId?: string): ISODate {
  const start = addDaysISO(ctx.today, cls.leadTimeDays);
  if (!a.location || !a.schedule) return start;
  const occ = occupiedWindow(a.schedule);
  let date = start;
  for (let i = 0; i < 365 * 2; i++) {
    const status = availability(a.location, { date, start: occ.start, end: occ.end }, ctx, ignoreCaseId).status;
    if (status === "open" || status === "impacted") return date;
    date = addDaysISO(date, 1);
  }
  return start;
}

export const dateGate = (a: EventAnswers, cls: Classification, ctx: RulesCtx, ignoreCaseId?: string): DateGate => {
  // With no date chosen yet there is nothing to measure: the gate neither passes a date nor
  // fails one, and offers no fix. `daysUntil` is 0 then and means nothing.
  const hasDate = !!a.schedule;
  const daysUntil = a.schedule ? daysBetween(ctx.today, a.schedule.date) : 0;
  const leadTimeOk = !hasDate || daysUntil >= cls.leadTimeDays;

  const occs = a.location && a.schedule ? occurrences(a.schedule, a.location, ctx, ignoreCaseId) : [];
  const availabilityResult = worstAvailability(occs);
  const availabilityOk = availabilityResult.status === "open" || availabilityResult.status === "impacted";
  const ok = leadTimeOk && availabilityOk;

  // Dropping an add-on and paying a late fee both answer a date that is too close. Neither
  // frees a date that is booked or blacked out, so then only a new date is offered.
  const tooCloseOnly = !leadTimeOk && availabilityOk;
  const droppable = tooCloseOnly
    ? whatIf(a, ctx.cfg)
        .filter((w) => daysUntil >= ctx.cfg.leadTimeDays[w.tier])
        .map((w) => w.triggerId)
    : [];

  const fixes: DateFix[] = [];
  if (!ok) fixes.push("new_date");
  if (droppable.length > 0) fixes.push("drop_addon");
  if (tooCloseOnly && daysUntil >= ctx.cfg.lateFee.minDaysBeforeEvent) fixes.push("late_fee");

  const feeLines = estimateFees(a, cls, ctx.cfg).lines.filter((l) => l.kind === "fee");
  const lateFeeAmount = round2(feeLines.reduce((sum, l) => sum + l.estimate, 0) * ctx.cfg.lateFee.rate);

  return {
    availability: availabilityResult,
    daysUntil,
    leadTimeOk,
    ok,
    earliestDate: earliestOpenDate(a, cls, ctx, ignoreCaseId),
    fixes,
    droppable,
    lateFeeAmount,
  };
};
