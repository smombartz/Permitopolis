/**
 * Every StateApi selector except waitingOn() and nextMove(), which live in ./waitingOn because
 * they share one computation. Nothing here mutates a case or calls transition().
 */
import { daysBetween } from "@/lib/dates";
import { plural } from "@/lib/format";
import { round2 } from "@/lib/rules/shared";
import type { Dept, EventCase, ISODate, Party, Task } from "@/lib/types";
import type { RulesConfig } from "@/lib/rules/types";
import { sessionDates } from "./clock";
import { byDueDate, sumFeeLines, totalPaid } from "./core";
import type { BoardColumn, CaseTotals, PermitSession, QueueGroup, QueueItem, ReviewClockView, StateApi, WaitingOnOthersItem } from "./types";
import { involvement, waitingOn } from "./waitingOn";

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
 */
export const boardColumns: StateApi["boardColumns"] = (c: EventCase): Record<BoardColumn, Task[]> => {
  const columns: Record<BoardColumn, Task[]> = { do_now: [], with_city: [], coming_up: [], done: [] };
  for (const task of c.tasks) {
    if (task.owner === "applicant") columns[boardColumn(task)].push(task);
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

function dueGroup(dueDate: ISODate | null, today: ISODate): QueueGroup {
  if (!dueDate) return "later";
  if (dueDate < today) return "overdue";
  const withinWeek = daysBetween(today, dueDate) <= 7;
  return withinWeek ? "this_week" : "later";
}

function daysActionable(task: Task, today: ISODate): number {
  const firstOpen = task.history.find((h) => h.status === "todo" || h.status === "changes_requested" || h.status === "submitted");
  if (!firstOpen) return 0;
  return Math.max(0, daysBetween(firstOpen.at.slice(0, 10), today));
}

export const queueFor: StateApi["queueFor"] = (cases: EventCase[], role: Dept, today: ISODate): QueueItem[] => {
  const items: QueueItem[] = [];
  for (const c of cases) {
    if (!isOpen(c)) continue;
    for (const task of c.tasks) {
      if (task.owner !== role) continue;
      if (task.status !== "todo" && task.status !== "changes_requested") continue;
      items.push({ case: c, task, group: dueGroup(task.dueDate, today), daysWaiting: daysActionable(task, today) });
    }
  }
  // My queue reads oldest due first, within each group and across them.
  return items.sort((a, b) => byDueDate(a.task, b.task));
};

export const waitingOnOthers: StateApi["waitingOnOthers"] = (cases: EventCase[], role: Dept, today: ISODate): WaitingOnOthersItem[] => {
  const items: WaitingOnOthersItem[] = [];
  for (const c of cases) {
    if (!isOpen(c) || !involves(c, role)) continue;
    const parties = waitingOn(c, today);
    const mine = parties.find((p) => p.party === role);
    if (mine && mine.status !== "up_now") items.push({ case: c, parties: parties.filter((p) => p.status === "up_now") });
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
