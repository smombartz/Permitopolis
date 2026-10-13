/** Transitions any city role (Clerk, Public Works & Safety, Health & Legal) can raise. */
import { fmtDate } from "@/lib/format";
import { dueDate } from "@/lib/rules";
import { CITY_TASKS } from "@/lib/rules/catalog";
import type { RulesCtx } from "@/lib/rules/types";
import { PARTY_LABEL, type Actor, type Condition, type Dept, type EventCase, type FeeLine, type Task } from "@/lib/types";
import type { Action } from "../actions";
import {
  cardUnderVerification,
  checkCompleteCityTask,
  checkLogCloseout,
  checkRequestInfo,
  checkReviewDecide,
  checkScheduleMeeting,
  checkSendToCommission,
  checkVerifyOrReject,
  meetingCardFor,
} from "../checks";
import { addTask, appendActivity, applyUnlockEvent, findTask, lineAmount, moveTask, newTask, parkTasksAwaitingAnswer, patchTask, taskId } from "../core";
import type { TransitionResult } from "../types";
import { maybeUnlockIssuePermit } from "./shared";

type Extract_<T extends Action["type"]> = Extract<Action, { type: T }>;

export function requestInfo(c: EventCase, action: Extract_<"request_info">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkRequestInfo(c, actor, action.taskId);
  if (!check.ok) return check;
  const askerDept = actor as Dept;
  const due = action.dueDate ?? dueDate(ctx.today, ctx.cfg.sla.requestResponseDays, ctx.cfg);
  let next = c;

  if (action.taskId) {
    const task = findTask(next, action.taskId) as Task;
    const reopenStatus = task.status === "submitted" || task.status === "done" ? "todo" : task.status;
    next = moveTask(next, task.id, reopenStatus, ctx, actor, { request: { from: askerDept, message: action.message, at: ctx.now ?? `${ctx.today}T09:00`, dueDate: due, resolved: false } });
  } else {
    const n = next.tasks.filter((t) => t.catalogId.startsWith("respond_to_request")).length + 1;
    const requestCard = newTask(
      {
        id: taskId(next.id, "respond_to_request", n),
        catalogId: "respond_to_request",
        owner: "applicant",
        kind: "action",
        title: action.item ?? "Respond to a request",
        reviewer: askerDept,
        dueDate: due,
        phase: "review",
      },
      ctx,
      "system",
    );
    next = addTask(next, { ...requestCard, request: { from: askerDept, message: action.message, at: ctx.now ?? `${ctx.today}T09:00`, dueDate: due, resolved: false } });
  }

  const review = next.reviews.find((r) => r.dept === askerDept);
  if (review) {
    // A second request while the clock is already paused keeps the day the pause began.
    next = { ...next, reviews: next.reviews.map((r) => (r.dept === askerDept ? { ...r, status: "needs_info", clock: { ...r.clock, pausedSince: r.clock.pausedSince ?? ctx.today } } : r)) };
  }
  next = parkTasksAwaitingAnswer(next, askerDept, ctx);
  next = { ...next, state: "needs_info" };
  next = appendActivity(next, actor, `Requested information: ${action.message}`, ctx);
  return { ok: true, case: next };
}

export function verifyDocument(c: EventCase, action: Extract_<"verify_document">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkVerifyOrReject(c, action.taskId, actor);
  if (!check.ok) return check;
  const card = findTask(c, action.taskId) as Task;
  return { ok: true, case: appendActivity(acceptCard(c, card, ctx, actor), actor, `Verified "${card.title}".`, ctx) };
}

/** Accepts a submitted card and closes the check that was open on it. */
function acceptCard(c: EventCase, card: Task, ctx: RulesCtx, actor: Actor): EventCase {
  let next = moveTask(c, card.id, "done", ctx, actor);
  next = finishVerifyTaskFor(next, card, ctx, actor);
  // Verifying the insurance can be the last of the three things Issue permit waits for.
  return maybeUnlockIssuePermit(next, ctx);
}

export function rejectDocument(c: EventCase, action: Extract_<"reject_document">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkVerifyOrReject(c, action.taskId, actor);
  if (!check.ok) return check;
  const card = findTask(c, action.taskId) as Task;
  let next = moveTask(c, card.id, "changes_requested", ctx, actor, { payload: { ...card.payload, rejectedReason: action.reason } });
  next = finishVerifyTaskFor(next, card, ctx, actor);
  next = appendActivity(next, actor, `Sent "${card.title}" back: ${action.reason}`, ctx);
  return { ok: true, case: next };
}

/** Marks the city verify task for this applicant card done, if one is open. */
function finishVerifyTaskFor(next: EventCase, card: Task, ctx: RulesCtx, actor: Actor): EventCase {
  const suffix = card.id.slice(next.id.length + 1);
  const verifyId = taskId(next.id, `verify:${suffix}`);
  const verifyTask = findTask(next, verifyId);
  if (!verifyTask || verifyTask.status === "done") return next;
  return moveTask(next, verifyId, "done", ctx, actor);
}

export function reviewDecide(c: EventCase, action: Extract_<"review_decide">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const dept = actor as Dept;
  const check = checkReviewDecide(c, dept);
  if (!check.ok) return check;

  let next = c;
  if (action.decision === "deny") {
    next = {
      ...next,
      reviews: next.reviews.map((r) =>
        r.dept === dept ? { ...r, status: "denied", decidedOn: ctx.today, internalNote: action.internalNote ?? r.internalNote, messageToApplicant: action.message ?? r.messageToApplicant } : r,
      ),
    };
    // The department has decided, so its review task is done. Denying the application is now
    // the Clerk's only move (a denial is final), and the Clerk gets a task that says so.
    const deniedReviewId = taskId(next.id, `review:${dept}`);
    if (findTask(next, deniedReviewId)) next = moveTask(next, deniedReviewId, "done", ctx, actor);
    next = openConsolidate(next, ctx, { title: "Decide: a reviewer denied", payload: { denied: true } });
    next = appendActivity(next, actor, "Denied its section.", ctx);
    return { ok: true, case: next };
  }

  const status: "approved" | "approved_with_conditions" = action.decision === "approve" ? "approved" : "approved_with_conditions";
  const conditions: Condition[] = action.conditions.map((text, i) => ({
    id: taskId(next.id, "cond", next.conditions.length + i + 1),
    dept,
    text,
    mergedByClerk: false,
    acceptedByApplicant: false,
  }));
  const feeLines: FeeLine[] = action.feeLines.map((fl, i) => ({
    id: taskId(next.id, "fee", next.feeLines.length + i + 1),
    dept: fl.dept,
    label: fl.label,
    qty: fl.qty,
    unit: fl.unit,
    unitPrice: fl.unitPrice,
    estimate: lineAmount(fl.qty, fl.unitPrice),
    actual: null,
    kind: fl.kind ?? "fee",
  }));

  next = {
    ...next,
    conditions: [...next.conditions, ...conditions],
    feeLines: [...next.feeLines, ...feeLines],
    reviews: next.reviews.map((r) =>
      r.dept === dept
        ? { ...r, status, decidedOn: ctx.today, internalNote: action.internalNote ?? r.internalNote, messageToApplicant: action.message ?? r.messageToApplicant }
        : r,
    ),
  };

  const reviewTaskId = taskId(next.id, `review:${dept}`);
  if (findTask(next, reviewTaskId)) next = moveTask(next, reviewTaskId, "done", ctx, actor);

  const now = ctx.now ?? `${ctx.today}T09:00`;
  next = {
    ...next,
    tasks: next.tasks.map((t) => {
      if (t.owner === "applicant" && t.reviewer === dept && t.status === "submitted") {
        return { ...t, status: "done", history: [...t.history, { at: now, actor, status: "done" }] };
      }
      if (t.owner === dept && t.kind === "review" && t.catalogId.startsWith("verify:") && (t.status === "todo" || t.status === "changes_requested")) {
        return { ...t, status: "done", history: [...t.history, { at: now, actor, status: "done" }] };
      }
      return t;
    }),
  };

  const allRouted = next.reviews.every((r) => r.status === "approved" || r.status === "approved_with_conditions");
  if (allRouted && next.reviews.length > 0) next = openConsolidate(next, ctx);

  next = appendActivity(next, actor, `Decided: ${status === "approved" ? "approved" : "approved with conditions"}.`, ctx);
  return { ok: true, case: next };
}

/**
 * Hands the case back to the Clerk once the reviews are in: its "Consolidate" task, created
 * locked by confirm_routing, opens. A denial opens it too, retitled, since denying the
 * application is then the Clerk's only move. A case routed before the task existed gets one now.
 */
function openConsolidate(c: EventCase, ctx: RulesCtx, as: { title: string; payload: Task["payload"] } = { title: CITY_TASKS.consolidate.title, payload: {} }): EventCase {
  const id = taskId(c.id, "consolidate");
  const existing = findTask(c, id);
  if (!existing) {
    return addTask(c, newTask({ id, catalogId: "consolidate", owner: "clerk", kind: "action", title: as.title, phase: "permit", payload: as.payload }, ctx, "system"));
  }
  if (existing.status !== "locked") return c;
  return moveTask(c, id, "todo", ctx, "system", { title: as.title, payload: { ...existing.payload, ...as.payload } });
}

export function sendToCommission(c: EventCase, _action: Extract_<"send_to_commission">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkSendToCommission(c);
  if (!check.ok) return check;
  const next = appendActivity({ ...c, flags: { ...c.flags, sentToCommission: true } }, actor, "Sent to commission.", ctx);
  return { ok: true, case: next };
}

export function scheduleMeeting(c: EventCase, action: Extract_<"schedule_meeting">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkScheduleMeeting(c, action.taskId, actor);
  if (!check.ok) return check;
  // Always the applicant's meeting card, also when the Clerk's scheduler task was named.
  const task = meetingCardFor(c, action.taskId) as Task;
  // The day it is set for is the day the card is due: a meeting on Jun 21 is not late on Jun 19
  // because the plan's default date for it (21 days before the event) has passed.
  let next = patchTask(c, task.id, { dueDate: action.date, payload: { ...task.payload, scheduledFor: action.date } });
  if (task.catalogId === "pre_application_meeting") next = finishScheduling(next, ctx, actor);
  next = appendActivity(next, actor, `Scheduled "${task.title}" for ${fmtDate(action.date)}.`, ctx);
  return { ok: true, case: next };
}

/**
 * Closes the Clerk's "Schedule the pre-application meeting" task. A meeting can be moved to
 * another day, so this is done only once, the first time it is scheduled (or held).
 */
function finishScheduling(c: EventCase, ctx: RulesCtx, actor: Actor): EventCase {
  const scheduler = findTask(c, taskId(c.id, "schedule_pre_application_meeting"));
  return scheduler && scheduler.status !== "done" ? moveTask(c, scheduler.id, "done", ctx, actor) : c;
}

export function completeCityTask(c: EventCase, action: Extract_<"complete_city_task">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkCompleteCityTask(c, action.taskId, actor);
  if (!check.ok) return check;
  const task = findTask(c, action.taskId) as Task;
  let next = moveTask(c, task.id, "done", ctx, actor, { payload: { ...task.payload, note: action.note } });
  // A re-review closed with no change accepts the card it was checking, so the card never
  // sits "With the city" with nobody tasked.
  const card = cardUnderVerification(next, task);
  if (card) next = acceptCard(next, card, ctx, actor);
  // A pre-application meeting that was held needs no date any more, scheduled or not.
  if (task.catalogId === "pre_application_meeting") next = finishScheduling(next, ctx, actor);
  next = appendActivity(next, actor, `Completed "${task.title}".`, ctx);
  return { ok: true, case: next };
}

export function logCloseout(c: EventCase, action: Extract_<"log_closeout">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkLogCloseout(c);
  if (!check.ok) return check;
  const actualsByLine = new Map(action.actuals.map((a) => [a.feeLineId, a.qty]));
  const feeLines = c.feeLines.map((line) => {
    const qty = actualsByLine.get(line.id);
    return qty !== undefined ? { ...line, actual: lineAmount(qty, line.unitPrice) } : { ...line, actual: line.estimate };
  });
  const extraLines: FeeLine[] = action.extraLines.map((fl, i) => ({
    id: taskId(c.id, "fee", feeLines.length + i + 1),
    dept: fl.dept,
    label: fl.label,
    qty: fl.qty,
    unit: fl.unit,
    unitPrice: fl.unitPrice,
    estimate: 0,
    actual: lineAmount(fl.qty, fl.unitPrice),
    kind: fl.kind ?? "fee",
  }));

  let next: EventCase = {
    ...c,
    feeLines: [...feeLines, ...extraLines],
    closeout: { ...c.closeout, cleanup: action.cleanup, notes: action.notes ?? c.closeout.notes, hoursLoggedOn: ctx.today },
  };
  const cleanupId = taskId(next.id, "cleanup_inspection");
  if (findTask(next, cleanupId)) next = moveTask(next, cleanupId, "done", ctx, actor);
  const hoursId = taskId(next.id, "log_actual_hours");
  if (findTask(next, hoursId)) next = moveTask(next, hoursId, "done", ctx, actor);
  next = applyUnlockEvent(next, "hours_logged", ctx);
  next = appendActivity(next, actor, "Logged closeout hours and costs.", ctx);
  return { ok: true, case: next };
}

export function addNote(c: EventCase, action: Extract_<"add_note">, actor: Actor, ctx: RulesCtx): TransitionResult {
  return { ok: true, case: appendActivity(c, actor, action.text, ctx) };
}

export function remind(c: EventCase, action: Extract_<"remind">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const next = appendActivity(c, actor, `Sent a reminder to ${PARTY_LABEL[action.party]}.`, ctx);
  return { ok: true, case: next };
}
