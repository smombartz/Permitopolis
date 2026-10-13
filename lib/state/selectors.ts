/**
 * Every StateApi selector except waitingOn() and nextMove(), which live in ./waitingOn because
 * they share one computation. Nothing here mutates a case or calls transition().
 */
import { daysBetween } from "@/lib/dates";
import { plural } from "@/lib/format";
import { cancellationRefund } from "@/lib/rules";
import { round2 } from "@/lib/rules/shared";
import type { Dept, EventCase, ISODate, Party, Task } from "@/lib/types";
import type { RulesConfig } from "@/lib/rules/types";
import { paidTowardPendingAmendment, permittedPlan } from "./amendment";
import { checkCancel } from "./checks";
import { lastSessionDate, sessionDates } from "./clock";
import { byDueDate, sumFeeLines, totalPaid } from "./core";
import type { BoardColumn, CaseTotals, PermitSession, QueueGroup, QueueItem, ReviewClockView, StateApi, WaitingOnOthersItem } from "./types";
import { involvement, isStalled, waitingOn } from "./waitingOn";

export const boardColumn: StateApi["boardColumn"] = (task: Task): BoardColumn => {
  if (task.status === "done") return "done";
  if (task.status === "locked") return "coming_up";
  if (task.status === "submitted") return "with_city";
  return "do_now";
};

/**
 * The applicant's board: their cards by column. Do now is in the order the PRD gives it: a
 * city request pinned on top, then Submit application once it has unlocked, then by due date.
 * The other columns keep the order of the plan.
 *
 * A case that ended (withdrawn, denied, cancelled, hold expired) has nothing left to do, nothing
 * with the city and nothing coming up: only what was done stays on its board. The cards it left
 * open are still on the case.
 */
export const boardColumns: StateApi["boardColumns"] = (c: EventCase): Record<BoardColumn, Task[]> => {
  const columns: Record<BoardColumn, Task[]> = { do_now: [], with_city: [], coming_up: [], done: [] };
  for (const task of c.tasks) {
    if (task.owner !== "applicant") continue;
    const column = boardColumn(task);
    if (c.ending === null || column === "done") columns[column].push(task);
  }
  const pin = (task: Task) => (task.request && !task.request.resolved ? 0 : task.catalogId === "submit_application" ? 1 : 2);
  columns.do_now.sort((a, b) => pin(a) - pin(b) || byDueDate(a, b));
  return columns;
};

/** The parties that are up now, in the order applicant, clerk, pws, hl. Empty when nobody is. */
export const whoIsUp: StateApi["whoIsUp"] = (c: EventCase, today: ISODate): Party[] => {
  return waitingOn(c, today)
    .filter((p) => p.status === "up_now")
    .map((p) => p.party);
};

export const isOpen: StateApi["isOpen"] = (c: EventCase) => c.ending === null && c.state !== "closed";

/** A permit that is live: Permitted, on Event day or in Closeout, and not cancelled. */
export const hasActivePermit: StateApi["hasActivePermit"] = (c: EventCase): boolean => {
  return c.ending === null && (c.state === "permitted" || c.state === "event_day" || c.state === "closeout");
};

/** Quote sent and holding its date: what the "holds" toggle on Active permits adds. */
export const holdsDateAtQuote: StateApi["holdsDateAtQuote"] = (c: EventCase): boolean => {
  return c.ending === null && c.state === "quote_sent" && c.dateHold.status === "held";
};

/**
 * The Active permits list: every live permit, by event date (the next session, or the last one
 * once all have passed), soonest first. `includeHolds` adds the Quote sent cases holding a date.
 */
export const activePermits: StateApi["activePermits"] = (cases: EventCase[], today: ISODate, options: { includeHolds?: boolean } = {}): EventCase[] => {
  const listed = cases.filter((c) => hasActivePermit(c) || (options.includeHolds === true && holdsDateAtQuote(c)));
  const dateOf = (c: EventCase) => eventDate(c, today) ?? "";
  return listed.sort((a, b) => dateOf(a).localeCompare(dateOf(b)) || a.id.localeCompare(b.id));
};

/**
 * The Active permits calendar and map: one entry for each date an active permit is held, so a
 * series shows every session (a session skipped for a blackout is not one). In date order.
 * `from` and `to` are inclusive.
 */
export const permitSessions: StateApi["permitSessions"] = (
  cases: EventCase[],
  options: { from?: ISODate; to?: ISODate; includeHolds?: boolean } = {},
): PermitSession[] => {
  const sessions: PermitSession[] = [];
  for (const c of cases) {
    if (!hasActivePermit(c) && !(options.includeHolds === true && holdsDateAtQuote(c))) continue;
    for (const date of sessionDates(c)) {
      if (options.from !== undefined && date < options.from) continue;
      if (options.to !== undefined && date > options.to) continue;
      sessions.push({ case: c, date });
    }
  }
  return sessions.sort((a, b) => a.date.localeCompare(b.date) || a.case.id.localeCompare(b.case.id));
};

export const isVisibleToCity: StateApi["isVisibleToCity"] = (c: EventCase) => c.state !== "draft";

/**
 * Never a Draft for a city role. A department is involved once it is routed or holds a task,
 * and before routing when a card names it as reviewer (it reads "Waiting" in Who's up then).
 */
export const involves: StateApi["involves"] = (c: EventCase, role: Party) => involvement(c, role) !== "none";

export const applicantCases: StateApi["applicantCases"] = (cases: EventCase[], applicantId: string) =>
  cases.filter((c) => c.applicantId === applicantId);

/**
 * A task with no due date is "Later" only while it is fresh. The Clerk's own steps (confirm the
 * reviewers, send the quote, issue the permit, reconcile) are created without one, and they are
 * the most actionable work the Clerk has: one that has waited more than a week is this week's.
 */
function dueGroup(dueDate: ISODate | null, today: ISODate, daysWaiting: number): QueueGroup {
  if (!dueDate) return daysWaiting > 7 ? "this_week" : "later";
  if (dueDate < today) return "overdue";
  const withinWeek = daysBetween(today, dueDate) <= 7;
  return withinWeek ? "this_week" : "later";
}

/**
 * Days since the task last became this party's to act on: the start of the stretch it has been
 * open for now. It may have been locked before, parked on a request to the applicant (those
 * days are the applicant's, not the reviewer's), or done and opened again by a second upload.
 */
function daysActionable(task: Task, today: ISODate): number {
  let since: string | null = null;
  for (let i = task.history.length - 1; i >= 0; i--) {
    const status = task.history[i].status;
    if (status !== "todo" && status !== "changes_requested") break;
    since = task.history[i].at;
  }
  if (!since) return 0;
  return Math.max(0, daysBetween(since.slice(0, 10), today));
}

/** Days since the task was last opened to its owner: what an undated task's group goes by. */
function daysOpen(task: Task, today: ISODate): number {
  const opened = [...task.history].reverse().find((h) => h.status === "todo" || h.status === "changes_requested");
  if (!opened) return 0;
  return Math.max(0, daysBetween(opened.at.slice(0, 10), today));
}

export const queueFor: StateApi["queueFor"] = (cases: EventCase[], role: Dept, today: ISODate): QueueItem[] => {
  const items: QueueItem[] = [];
  for (const c of cases) {
    if (!isOpen(c)) continue;
    for (const task of c.tasks) {
      if (task.owner !== role) continue;
      if (task.status !== "todo" && task.status !== "changes_requested") continue;
      items.push({ case: c, task, group: dueGroup(task.dueDate, today, daysOpen(task, today)), daysWaiting: daysActionable(task, today) });
    }
  }
  // My queue reads oldest due first, within each group and across them.
  return items.sort((a, b) => byDueDate(a.task, b.task));
};

/**
 * The cases where the move is someone else's, with who (PRD, My queue). A case nobody is up on
 * (a permit three weeks from its day) is not waiting on anyone, so it is left out. The one
 * exception is a case that is stalled: before its permit with nobody up is a bug, and the row
 * is where the dev-only Stalled chip shows it.
 */
export const waitingOnOthers: StateApi["waitingOnOthers"] = (cases: EventCase[], role: Dept, today: ISODate): WaitingOnOthersItem[] => {
  const items: WaitingOnOthersItem[] = [];
  for (const c of cases) {
    if (!isOpen(c) || !involves(c, role)) continue;
    const parties = waitingOn(c, today);
    const mine = parties.find((p) => p.party === role);
    if (!mine || mine.status === "up_now") continue;
    const up = parties.filter((p) => p.status === "up_now");
    if (up.length > 0 || isStalled(c, today)) items.push({ case: c, parties: up });
  }
  return items;
};

export const reviewClock: StateApi["reviewClock"] = (c: EventCase, dept: Dept, today: ISODate): ReviewClockView | null => {
  const review = c.reviews.find((r) => r.dept === dept);
  if (!review || !review.clock.startedOn) return null;
  // The clock counts days elapsed since routing, so the due date (routing plus the allowance)
  // reads "Day 14 of 14". It stops for good on the day the department decides.
  const end = review.decidedOn ?? today;
  const currentPause = review.clock.pausedSince ? Math.max(0, daysBetween(review.clock.pausedSince, end)) : 0;
  const pausedDays = review.clock.pausedDays + currentPause;
  const elapsed = Math.max(0, daysBetween(review.clock.startedOn, end) - pausedDays);
  const paused = review.clock.pausedSince !== null;
  const label = `Day ${elapsed} of ${review.clock.allowedDays}${pausedDays > 0 ? ` · paused ${plural(pausedDays, "day")}` : ""}`;
  return { day: elapsed, of: review.clock.allowedDays, pausedDays, paused, label };
};

export const eventDate: StateApi["eventDate"] = (c: EventCase, today: ISODate): ISODate | null => {
  const dates = sessionDates(c);
  if (dates.length === 0) return null;
  const upcoming = dates.filter((d) => d >= today).sort();
  if (upcoming.length > 0) return upcoming[0];
  return dates.reduce((a, b) => (a > b ? a : b));
};

export const daysUntilEvent: StateApi["daysUntilEvent"] = (c: EventCase, today: ISODate): number => {
  const d = eventDate(c, today);
  if (!d) return 0;
  return daysBetween(today, d);
};

export const caseTotals: StateApi["caseTotals"] = (c: EventCase): CaseTotals => {
  // Every figure is to the cent (see lineAmount() in ./core).
  const fees = sumFeeLines(c, ["fee", "late_fee"]);
  // Reconciling settles the deposit: it has covered any overage and the rest has gone back, so
  // it is no longer part of what the event costs or of what is owed.
  const settled = c.closeout.balance !== null;
  const deposit = settled ? 0 : sumFeeLines(c, ["deposit"]);
  const total = round2(fees + deposit);
  const paid = totalPaid(c);
  // A case that ended early owes nothing more; its refund, if any, is already among the payments.
  const due = c.ending ? 0 : Math.max(0, round2(total - paid));
  return { fees, deposit, total, paid, due };
};

/** How a closeout settles once the actual costs are in: what `reconcile_close` then does. */
export interface CloseoutSettlement {
  /** Actual minus estimate across the fee lines, deposit excluded. Negative when the event came in under. */
  over: number;
  /** The deposit the city holds. */
  deposit: number;
  /** The part of the overage the deposit covers. */
  fromDeposit: number;
  /** What goes back to the applicant; null when the overage is more than the deposit. */
  refund: number | null;
  /** What is still owed after the deposit; null when the deposit covers the overage. */
  bill: number | null;
}

/**
 * In Closeout nothing is "due" in the quote's sense: an overage comes out of the deposit first,
 * the rest of the deposit goes back, and only what the deposit cannot cover is billed.
 * caseTotals() cannot say that before the Clerk reconciles (it reads $750 due with $1,000 held).
 */
export function closeoutSettlement(c: EventCase): CloseoutSettlement {
  const over = round2(c.feeLines.filter((f) => f.kind !== "deposit").reduce((s, f) => s + ((f.actual ?? f.estimate) - f.estimate), 0));
  const deposit = round2(c.feeLines.filter((f) => f.kind === "deposit").reduce((s, f) => s + f.estimate, 0));
  const refund = over <= deposit ? round2(deposit - over) : null;
  const bill = refund === null ? round2(over - deposit) : null;
  return { over, deposit, fromDeposit: Math.max(0, Math.min(over, deposit)), refund, bill };
}

/** What cancelling a permit today would pay back: the figure every screen shows, and the one `cancel` refunds. */
export interface CancelRefund {
  /** The whole refund: the schedule's share of the fees plus the deposit, never more than was paid. */
  refund: number;
  /** The deposit on the case, which is returned in full. 0 when there is none. */
  deposit: number;
  /** The band of the cancellation schedule that applies today, in plain language. */
  rule: string;
  /** False once `cancel` would be refused: no permit, the case ended, or the event is over. */
  canCancel: boolean;
}

/**
 * The cancellation schedule works from the fees (for a series, the ones paid so far) and leaves
 * the deposit out. This is the amount that actually goes back: the schedule's share plus the
 * deposit.
 *
 * It is the permit that is cancelled, so the fees are the ones of the plan the permit covers:
 * while an amendment is pending, the amended plan's lines (a deposit and a late fee nobody has
 * paid) are left out, and anything already paid toward the amendment goes back whole.
 */
export function refundIfCancelled(c: EventCase, today: ISODate, cfg: RulesConfig): CancelRefund {
  const plan = permittedPlan(c);
  const result = cancellationRefund(plan, today, cfg);
  const deposit = round2(plan.feeLines.filter((f) => f.kind === "deposit").reduce((s, f) => s + f.estimate, 0));
  // A refund never exceeds what the applicant has paid. To the cent, like every amount.
  const refund = Math.min(round2(result.refund + deposit + paidTowardPendingAmendment(c, cfg)), Math.max(0, totalPaid(c)));
  return { refund, deposit, rule: result.rule, canCancel: checkCancel(c, today, lastSessionDate(c)).ok };
}

export const leadTimeRisk: StateApi["leadTimeRisk"] = (c: EventCase, today: ISODate, cfg: RulesConfig): "ok" | "at_risk" => {
  const needed = cfg.risk.daysNeeded[c.state];
  if (needed === undefined) return "ok";
  return daysUntilEvent(c, today) < needed ? "at_risk" : "ok";
};

export const nextCaseId: StateApi["nextCaseId"] = (cases: EventCase[]): string => {
  let max = 0;
  for (const c of cases) {
    const match = /^PMT-27-(\d+)$/.exec(c.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `PMT-27-${String(max + 1).padStart(4, "0")}`;
};
