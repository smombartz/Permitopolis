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
import { permittedPlan } from "./amendment";
import { appendActivity, applyUnlockEvent, findTask, heldSessionDates, moveTask, newTask, quotePaid, releaseHold, taskId } from "./core";
import { lapseAmendment } from "./transitions/amendment";
import type { TransitionResult } from "./types";

/** Every date the event takes place on. A session skipped for a blackout is not one of them. */
export function sessionDates(c: EventCase): ISODate[] {
  return heldSessionDates(c);
}

/** "Carry your permit" is for the day itself; once the last session has passed it is done. */
function finishEventDayCards(c: EventCase, ctx: RulesCtx): EventCase {
  const carry = findTask(c, taskId(c.id, "carry_permit"));
  if (!carry || carry.status === "done") return c;
  return moveTask(c, carry.id, "done", ctx, "system", { unlocksOn: null });
}

/**
 * A series carries its permit to every session. When one ends with more to come, the card goes
 * back to Coming up, dated for the next session; that day's tick opens it again.
 */
function relockEventDayCards(c: EventCase, nextSession: ISODate, ctx: RulesCtx): EventCase {
  const carry = findTask(c, taskId(c.id, "carry_permit"));
  if (!carry || carry.status !== "todo") return c;
  return moveTask(c, carry.id, "locked", ctx, "system", { unlocksOn: "event_day", dueDate: nextSession });
}

/** A series is billed session by session: on its day, a session not yet paid for is due. */
function markSessionDue(c: EventCase, date: ISODate): EventCase {
  if (!c.schedule?.recurrence) return c;
  return { ...c, schedule: { ...c.schedule, occurrences: c.schedule.occurrences.map((o) => (o.date === date && o.billing === "upcoming" ? { ...o, billing: "due" as const } : o)) } };
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

/**
 * A pending amendment the event has caught up with. The permit covers the plan from before it,
 * so the day that counts is that plan's last session. An amendment that asked for an earlier
 * date is caught up with on that date instead: it came without the amendment in effect.
 */
function amendmentOvertaken(c: EventCase, today: ISODate): boolean {
  if (!c.flags.amendmentPending || !c.permit || (c.state !== "permitted" && c.state !== "event_day")) return false;
  return [lastSessionDate(c), lastSessionDate(permittedPlan(c))].some((last) => last !== null && last <= today);
}

/** The system transition raised once per day by advanceClock(). */
export function applyTick(record: EventCase, ctx: RulesCtx): TransitionResult {
  if (record.ending) return { ok: false, reason: "This case has an ending; nothing to tick." };
  const today = ctx.today;
  // An amendment still pending when the event arrives never took effect. It lapses first, so
  // everything below (Event day, and the tier that decides between Closed and Closeout) reads
  // the plan the permit covers, not one nobody approved.
  const lapsed = amendmentOvertaken(record, today);
  let c = lapsed ? lapseAmendment(record, ctx) : record;

  if (c.state === "quote_sent" && c.dateHold.expiresOn && isBefore(c.dateHold.expiresOn, today) && !quotePaid(c, ctx.cfg)) {
    let next: EventCase = {
      ...c,
      ending: "hold_expired",
      endingReason: "The date hold expired before the quote was paid.",
      dateHold: { ...c.dateHold, status: "expired" },
    };
    next = appendActivity(next, "system", "The date hold expired. The space and date were released.", ctx);
    return { ok: true, case: next };
  }

  if (c.state === "permitted" && isSessionDate(c, today)) {
    let next: EventCase = markSessionDue({ ...c, state: "event_day" }, today);
    next = applyUnlockEvent(next, "event_day", ctx);
    next = appendActivity(next, "system", "Today is event day.", ctx);
    return { ok: true, case: next };
  }

  if (c.state === "event_day" && !isSessionDate(c, today)) {
    const nextSession = sessionDates(c)
      .filter((d) => isAfter(d, today))
      .sort()[0];
    if (nextSession) {
      let next = relockEventDayCards({ ...c, state: "permitted" }, nextSession, ctx);
      next = appendActivity(next, "system", "The session ended; the series returns to Permitted until its next date.", ctx);
      return { ok: true, case: next };
    }

    const last = lastSessionDate(c) ?? today;
    c = finishEventDayCards(c, ctx);

    if (c.tier === "instant" && c.closeout.cleanup !== "issues") {
      // Closed with nothing to settle: the date is no longer held for it.
      let next: EventCase = { ...c, tasks: [...c.tasks, ...closeoutCards(c, ctx.cfg)], state: "closed", dateHold: releaseHold(c.dateHold) };
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
      { id: taskId(c.id, "reconcile"), catalogId: "reconcile", owner: "clerk", kind: "action", title: CITY_TASKS.reconcile.title, status: "locked", unlocksOn: "hours_logged", phase: "after" },
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

  return lapsed ? { ok: true, case: c } : { ok: false, reason: "Nothing changes for this case today." };
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
