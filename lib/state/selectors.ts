/**
 * Every StateApi selector except waitingOn() and nextMove(), which live in ./waitingOn because
 * they share one computation. Nothing here mutates a case or calls transition().
 */
import { daysBetween } from "@/lib/dates";
import { plural } from "@/lib/format";
import type { Dept, EventCase, ISODate, Party, Task } from "@/lib/types";
import type { RulesConfig } from "@/lib/rules/types";
import { sessionDates } from "./clock";
import type { BoardColumn, CaseTotals, QueueGroup, QueueItem, ReviewClockView, StateApi, WaitingOnOthersItem } from "./types";
import { waitingOn } from "./waitingOn";

export const boardColumn: StateApi["boardColumn"] = (task: Task): BoardColumn => {
  if (task.status === "done") return "done";
  if (task.status === "locked") return "coming_up";
  if (task.status === "submitted") return "with_city";
  return "do_now";
};

export const isOpen: StateApi["isOpen"] = (c: EventCase) => c.ending === null && c.state !== "closed";

export const isVisibleToCity: StateApi["isVisibleToCity"] = (c: EventCase) => c.state !== "draft";

export const involves: StateApi["involves"] = (c: EventCase, role: Party) => {
  if (role === "applicant") return true;
  if (role === "clerk") return isVisibleToCity(c);
  return c.reviews.some((r) => r.dept === role) || c.tasks.some((t) => t.owner === role || t.reviewer === role);
};

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
  return items;
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
  const fees = c.feeLines.filter((f) => f.kind === "fee" || f.kind === "late_fee").reduce((s, f) => s + (f.actual ?? f.estimate), 0);
  // Reconciling settles the deposit: it has covered any overage and the rest has gone back, so
  // it is no longer part of what the event costs or of what is owed.
  const settled = c.closeout.balance !== null;
  const deposit = settled ? 0 : c.feeLines.filter((f) => f.kind === "deposit").reduce((s, f) => s + (f.actual ?? f.estimate), 0);
  const total = fees + deposit;
  const paid = c.payments.reduce((s, p) => s + p.amount, 0);
  // A case that ended early owes nothing more; its refund, if any, is already among the payments.
  const due = c.ending ? 0 : Math.max(0, total - paid);
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
