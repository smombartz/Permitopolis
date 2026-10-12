/**
 * Everything driven by the demo clock: due dates that depend on session dates, the system
 * "tick" transition (hold expiry, event day, Closeout, an Instant event closing itself), and
 * advanceClock(), which replays tick over every day the demo date moves forward.
 */
import { addDaysISO, dateOf, isAfter, isBefore } from "@/lib/dates";
import { closeoutCards, dueDate as dueDateRule } from "@/lib/rules";
import { CITY_TASKS } from "@/lib/rules/catalog";
import type { RulesConfig, RulesCtx } from "@/lib/rules/types";
import type { EventCase, ISODate, ISODateTime } from "@/lib/types";
import { appendActivity, applyUnlockEvent, newTask, paidInFull, taskId } from "./core";
import type { TransitionResult } from "./types";

export function sessionDates(c: EventCase): ISODate[] {
  const occurrences = c.schedule?.occurrences ?? [];
  if (occurrences.length > 0) return occurrences.map((o) => o.date);
  return c.schedule ? [c.schedule.date] : [];
}

export function lastSessionDate(c: EventCase): ISODate | null {
  const dates = sessionDates(c);
  if (dates.length === 0) return null;
  return dates.reduce((a, b) => (a > b ? a : b));
}

export function isSessionDate(c: EventCase, date: ISODate): boolean {
  return sessionDates(c).includes(date);
}

/** A deterministic "now" for one case: 9am plus one minute per activity already logged today. */
export function computeNow(c: EventCase, today: ISODate): ISODateTime {
  const loggedToday = c.activity.filter((a) => dateOf(a.at) === today).length;
  const minutes = 9 * 60 + loggedToday;
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${today}T${hh}:${mm}`;
}

/** The system transition raised once per day by advanceClock(). */
export function applyTick(c: EventCase, ctx: RulesCtx): TransitionResult {
  if (c.ending) return { ok: false, reason: "This case has an ending; nothing to tick." };
  const today = ctx.today;

  if (c.state === "quote_sent" && c.dateHold.expiresOn && isBefore(c.dateHold.expiresOn, today) && !paidInFull(c)) {
    let next: EventCase = {
      ...c,
      ending: "hold_expired",
      endingReason: "The date hold expired before the quote was paid in full.",
      dateHold: { ...c.dateHold, status: "expired" },
    };
    next = appendActivity(next, "system", "The date hold expired. The space and date were released.", ctx);
    return { ok: true, case: next };
  }

  if (c.state === "permitted" && isSessionDate(c, today)) {
    let next: EventCase = { ...c, state: "event_day" };
    next = applyUnlockEvent(next, "event_day", ctx);
    next = appendActivity(next, "system", "Today is event day.", ctx);
    return { ok: true, case: next };
  }

  if (c.state === "event_day" && !isSessionDate(c, today)) {
    const laterSessionRemains = sessionDates(c).some((d) => isAfter(d, today));
    if (laterSessionRemains) {
      const next = appendActivity({ ...c, state: "permitted" }, "system", "The session ended; the series returns to Permitted until its next date.", ctx);
      return { ok: true, case: next };
    }

    const last = lastSessionDate(c) ?? today;

    if (c.tier === "instant" && c.closeout.cleanup !== "issues") {
      let next: EventCase = { ...c, tasks: [...c.tasks, ...closeoutCards(c, ctx.cfg)], state: "closed" };
      next = applyUnlockEvent(next, "closed", ctx);
      next = appendActivity(next, "system", "The event closed out with no issues.", ctx);
      return { ok: true, case: next };
    }

    if (c.tier === "instant") {
      const exceptionTask = newTask(
        { id: taskId(c.id, "instant_exception"), catalogId: "instant_exception", owner: "clerk", kind: "review", title: CITY_TASKS.instant_exception.title, phase: "after" },
        ctx,
        "system",
      );
      let next: EventCase = { ...c, tasks: [...c.tasks, exceptionTask, ...closeoutCards(c, ctx.cfg)], state: "closeout" };
      next = applyUnlockEvent(next, "closeout", ctx);
      next = appendActivity(next, "system", "The event closed out with a cleanup issue to resolve.", ctx);
      return { ok: true, case: next };
    }

    const closeoutDue = dueDateRule(last, ctx.cfg.sla.closeoutDaysAfterEvent, ctx.cfg);
    const cleanupInspection = newTask(
      { id: taskId(c.id, "cleanup_inspection"), catalogId: "cleanup_inspection", owner: "pws", kind: "inspection", title: CITY_TASKS.cleanup_inspection.title, dueDate: closeoutDue, phase: "after" },
      ctx,
      "system",
    );
    const logHours = newTask(
      { id: taskId(c.id, "log_actual_hours"), catalogId: "log_actual_hours", owner: "pws", kind: "action", title: CITY_TASKS.log_actual_hours.title, dueDate: closeoutDue, phase: "after" },
      ctx,
      "system",
    );
    const reconcile = newTask(
      { id: taskId(c.id, "reconcile"), catalogId: "reconcile", owner: "clerk", kind: "action", title: CITY_TASKS.reconcile.title, status: "locked", phase: "after" },
      ctx,
      "system",
    );
    let next: EventCase = {
      ...c,
      tasks: [...c.tasks, ...closeoutCards(c, ctx.cfg), cleanupInspection, logHours, reconcile],
      state: "closeout",
    };
    next = appendActivity(next, "system", "The event moved to Closeout.", ctx);
    return { ok: true, case: next };
  }

  return { ok: false, reason: "Nothing changes for this case today." };
}

/** Applies the system transitions for every day from `from` (exclusive) to `to` (inclusive). */
export function advanceClock(cases: EventCase[], from: ISODate, to: ISODate, cfg: RulesConfig): EventCase[] {
  if (to <= from) return cases;
  let current = cases;
  for (let d = addDaysISO(from, 1); d <= to; d = addDaysISO(d, 1)) {
    current = current.map((c) => {
      const ctx: RulesCtx = { today: d, cases: current, cfg };
      const result = applyTick(c, ctx);
      return result.ok ? result.case : c;
    });
  }
  return current;
}
