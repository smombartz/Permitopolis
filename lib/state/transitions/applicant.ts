/**
 * Transitions the applicant actor raises. `pay` lives in ./payment because the Clerk raises
 * it too, for an in-person payment.
 */
import { addDaysISO, daysBetween } from "@/lib/dates";
import { cancellationRefund, classify, dueDate, estimateFees, requirements } from "@/lib/rules";
import { CARD_BY_ID, type CardSpec } from "@/lib/rules/catalog";
import type { RulesCtx } from "@/lib/rules/types";
import type { Actor, DateHold, EventCase, Task } from "@/lib/types";
import type { Action } from "../actions";
import {
  checkAcceptAndSign,
  checkAmend,
  checkBookAndPay,
  checkBookAgain,
  checkCancel,
  checkCompleteTask,
  checkCreateBoard,
  checkRespondToRequest,
  checkSimulateSignoff,
  checkSubmit,
  checkSubmitFeedback,
  checkWithdraw,
} from "../checks";
import { lastSessionDate } from "../clock";
import { addTasks, appendActivity, applyUnlockEvent, findTask, isCatalogId, moveTask, newTask, nowOf, patchTask, taskId } from "../core";
import { eventDate, nextCaseId } from "../selectors";
import type { TransitionResult } from "../types";
import { maybeUnlockIssuePermit } from "./shared";

type Extract_<T extends Action["type"]> = Extract<Action, { type: T }>;

/** Shared by create_board and the create_board-if-empty step inside book_and_pay. */
export function buildBoard(c: EventCase, ctx: RulesCtx): EventCase {
  const cls = classify(c, ctx.cfg);
  const freshTasks = requirements(c, cls, { caseId: c.id, today: ctx.today, cfg: ctx.cfg });
  const mergedTasks = freshTasks.map((fresh) => {
    const existing = c.tasks.find((t) => t.id === fresh.id);
    if (!existing) return fresh;
    return { ...fresh, status: existing.status, payload: existing.payload, history: existing.history, request: existing.request };
  });
  const estimate = estimateFees(c, cls, ctx.cfg, { caseId: c.id });
  return { ...c, tier: cls.tier, triggers: cls.triggers, tasks: mergedTasks, feeLines: estimate.lines };
}

export function createBoard(c: EventCase, _action: Extract_<"create_board">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkCreateBoard(c);
  if (!check.ok) return check;
  const cls = classify(c, ctx.cfg);
  const next = appendActivity(buildBoard(c, ctx), actor, `Confirmed the plan: ${cls.summary}`, ctx);
  return { ok: true, case: next };
}

export function bookAndPay(c: EventCase, action: Extract_<"book_and_pay">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkBookAndPay(c, ctx);
  if (!check.ok) return check;
  let next = c.tasks.length === 0 ? buildBoard(c, ctx) : c;
  const cls = classify(next, ctx.cfg);
  const estimate = estimateFees(next, cls, ctx.cfg, { caseId: next.id });
  const amount = estimate.dueNow ?? estimate.total;

  next = {
    ...next,
    feeLines: next.feeLines.length > 0 ? next.feeLines : estimate.lines,
    dateHold: { status: "held", placedOn: ctx.today, expiresOn: null },
    permit: { issuedOn: ctx.today, signature: null },
    state: "permitted",
    payments: [...next.payments, { id: taskId(next.id, "pay", next.payments.length + 1), at: nowOf(ctx), amount, method: action.method, kind: "booking" }],
  };
  const payFeesId = taskId(next.id, "pay_fees");
  const payFeesTask = findTask(next, payFeesId);
  if (payFeesTask) {
    next = moveTask(next, payFeesId, "done", ctx, actor, { payload: { ...payFeesTask.payload, amount } });
  }
  if (next.schedule && next.schedule.occurrences.length > 0) {
    next = {
      ...next,
      schedule: {
        ...next.schedule,
        occurrences: next.schedule.occurrences.map((o, i) => ({ ...o, billing: i === 0 ? ("paid" as const) : ("upcoming" as const) })),
      },
    };
  }
  next = appendActivity(next, actor, `Paid ${amount} and booked the date. The permit is issued.`, ctx);
  return { ok: true, case: next };
}

export function completeTask(c: EventCase, action: Extract_<"complete_task">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkCompleteTask(c, action.taskId);
  if (!check.ok) return check;
  const task = findTask(c, action.taskId) as Task;
  const spec = isCatalogId(task.catalogId) ? (CARD_BY_ID as Record<string, CardSpec>)[task.catalogId] : undefined;
  const needsCheck = spec?.needsCheck ?? false;
  const newStatus = needsCheck ? "submitted" : "done";
  let next = moveTask(c, task.id, newStatus, ctx, actor, {
    payload: { ...task.payload, files: action.files ?? task.payload.files, form: action.form ?? task.payload.form, note: action.note ?? task.payload.note },
  });

  if (newStatus === "submitted" && task.reviewer) {
    next = maybeCreateVerifyTask(next, task, ctx);
  }

  const preSubmitCards = next.tasks.filter((t) => isCatalogId(t.catalogId) && (CARD_BY_ID as Record<string, CardSpec>)[t.catalogId]?.preSubmit);
  const allPreSubmitDone = preSubmitCards.length > 0 && preSubmitCards.every((t) => t.status === "submitted" || t.status === "done");
  if (allPreSubmitDone) next = applyUnlockEvent(next, "presubmit_done", ctx);

  next = appendActivity(next, actor, `Completed "${task.title}".`, ctx);
  return { ok: true, case: next };
}

/** Shared with respond_to_request: creates a verify task only when the reviewer has none open. */
export function maybeCreateVerifyTask(c: EventCase, card: Task, ctx: RulesCtx): EventCase {
  const dept = card.reviewer;
  if (!dept) return c;
  const routed = c.state === "in_review" || c.state === "needs_info" || c.state === "quote_sent";
  const hasOpen = c.tasks.some((t) => t.owner === dept && t.kind === "review" && (t.status === "todo" || t.status === "changes_requested"));
  if (!routed || hasOpen) return c;
  const suffix = card.id.slice(c.id.length + 1);
  const verifyTask = newTask(
    {
      id: taskId(c.id, `verify:${suffix}`),
      catalogId: `verify:${suffix}`,
      owner: dept,
      kind: "review",
      title: `Verify ${card.title}`,
      reviewer: null,
      dueDate: dueDate(ctx.today, ctx.cfg.sla.verificationDays, ctx.cfg),
      phase: "review",
    },
    ctx,
    "system",
  );
  return addTasks(c, [verifyTask]);
}

export function simulateSignoff(c: EventCase, _action: Extract_<"simulate_signoff">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const id = taskId(c.id, "neighbor_signoff");
  const check = checkSimulateSignoff(c, id);
  if (!check.ok) return check;
  const task = findTask(c, id) as Task;
  const progress = (task.payload.progress as { done: number; total: number } | undefined) ?? { done: 0, total: 12 };
  const done = progress.done + 1;
  let next = patchTask(c, id, { payload: { ...task.payload, progress: { done, total: progress.total } } });
  if (done >= progress.total) {
    next = moveTask(next, id, "done", ctx, actor);
  }
  next = appendActivity(next, actor, `A neighbor signed off (${done} of ${progress.total}).`, ctx);
  return { ok: true, case: next };
}

export function submit(c: EventCase, _action: Extract_<"submit">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkSubmit(c);
  if (!check.ok) return check;
  let next: EventCase = { ...c, state: "submitted", submittedAt: nowOf(ctx) };
  next = moveTask(next, taskId(next.id, "submit_application"), "done", ctx, actor);
  const intakeTask = newTask(
    {
      id: taskId(next.id, "intake_check"),
      catalogId: "intake_check",
      owner: "clerk",
      kind: "review",
      title: "Check the application is complete",
      dueDate: dueDate(ctx.today, ctx.cfg.sla.intakeDays, ctx.cfg),
      phase: "review",
    },
    ctx,
    "system",
  );
  next = addTasks(next, [intakeTask]);
  next = applyUnlockEvent(next, "submitted", ctx);
  next = appendActivity(next, actor, "Submitted the application.", ctx);
  return { ok: true, case: next };
}

export function respondToRequest(c: EventCase, action: Extract_<"respond_to_request">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkRespondToRequest(c, action.taskId);
  if (!check.ok) return check;
  const task = findTask(c, action.taskId) as Task;
  const dept = task.request!.from;
  let next = moveTask(c, task.id, "submitted", ctx, actor, {
    request: { ...task.request!, resolved: true },
    payload: { ...task.payload, files: action.files ?? task.payload.files, message: action.message },
  });
  const review = next.reviews.find((r) => r.dept === dept);
  if (review) {
    const pausedDays = review.clock.pausedSince ? daysBetween(review.clock.pausedSince, ctx.today) : 0;
    next = {
      ...next,
      reviews: next.reviews.map((r) =>
        r.dept === dept
          ? { ...r, status: "pending", clock: { ...r.clock, pausedSince: null, pausedDays: r.clock.pausedDays + pausedDays } }
          : r,
      ),
    };
  }
  const anyOpenRequest = next.tasks.some((t) => t.request && !t.request.resolved);
  if (!anyOpenRequest) {
    next = { ...next, state: next.reviews.length > 0 ? "in_review" : "submitted" };
  }
  const hasOpenAskerTask = next.tasks.some((t) => t.owner === dept && t.kind === "review" && (t.status === "todo" || t.status === "changes_requested"));
  if (!hasOpenAskerTask) {
    next = maybeCreateVerifyTask(next, { ...task, reviewer: dept }, ctx);
  }
  next = appendActivity(next, actor, `Responded to the request on "${task.title}".`, ctx);
  return { ok: true, case: next };
}

export function acceptAndSign(c: EventCase, action: Extract_<"accept_and_sign">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkAcceptAndSign(c);
  if (!check.ok) return check;
  let next: EventCase = { ...c, conditions: c.conditions.map((cond) => ({ ...cond, acceptedByApplicant: true })), flags: { ...c.flags, signed: true } };
  next = moveTask(next, taskId(next.id, "accept_and_sign"), "done", ctx, actor, { payload: { signature: action.signature } });
  next = applyUnlockEvent(next, "signed", ctx);
  next = maybeUnlockIssuePermit(next, ctx);
  next = appendActivity(next, actor, "Accepted the conditions and signed.", ctx);
  return { ok: true, case: next };
}

export function withdraw(c: EventCase, _action: Extract_<"withdraw">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkWithdraw(c);
  if (!check.ok) return check;
  const next = appendActivity(
    { ...c, ending: "withdrawn", endingReason: "Withdrawn by the applicant.", dateHold: releaseHold(c) },
    actor,
    "Withdrew the application.",
    ctx,
  );
  return { ok: true, case: next };
}

export function cancel(c: EventCase, _action: Extract_<"cancel">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const last = lastSessionDate(c);
  const check = checkCancel(c, ctx.today, last);
  if (!check.ok) return check;
  const result = cancellationRefund(c, ctx.today, ctx.cfg);
  const depositPaid = c.feeLines.filter((f) => f.kind === "deposit").reduce((s, f) => s + f.estimate, 0);
  const amount = -(result.refund + depositPaid);
  let next: EventCase = {
    ...c,
    ending: "cancelled",
    endingReason: result.rule,
    dateHold: releaseHold(c),
    payments: [...c.payments, { id: taskId(c.id, "pay", c.payments.length + 1), at: nowOf(ctx), amount, method: "card", kind: "refund" }],
  };
  next = appendActivity(next, actor, `Cancelled. ${result.rule}`, ctx);
  return { ok: true, case: next };
}

export function submitFeedback(c: EventCase, action: Extract_<"submit_feedback">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkSubmitFeedback(c);
  if (!check.ok) return check;
  let next: EventCase = { ...c, closeout: { ...c.closeout, feedback: { rating: action.rating, comment: action.comment } } };
  next = moveTask(next, taskId(next.id, "feedback"), "done", ctx, actor, { payload: { rating: action.rating, comment: action.comment } });
  next = appendActivity(next, actor, "Sent feedback.", ctx);
  return { ok: true, case: next };
}

export function bookAgain(c: EventCase, _action: Extract_<"book_again">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkBookAgain(c);
  if (!check.ok) return check;
  const newId = nextCaseId(ctx.cases);
  const now = nowOf(ctx);
  const shiftedSchedule = c.schedule
    ? {
        ...c.schedule,
        date: addDaysISO(c.schedule.date, 364),
        occurrences: c.schedule.occurrences.map((o) => ({ ...o, date: addDaysISO(o.date, 364), availability: { status: "open" as const }, billing: "upcoming" as const })),
        recurrence: c.schedule.recurrence ? { ...c.schedule.recurrence, until: addDaysISO(c.schedule.recurrence.until, 364) } : undefined,
      }
    : null;
  const spawned: EventCase = {
    eventType: c.eventType,
    name: c.name,
    description: c.description,
    location: c.location,
    schedule: shiftedSchedule,
    attendance: c.attendance,
    addOns: c.addOns,
    id: newId,
    applicantId: c.applicantId,
    tier: "instant",
    triggers: [],
    state: "draft",
    ending: null,
    endingReason: null,
    dateHold: { status: "none", placedOn: null, expiresOn: null },
    reviews: [],
    tasks: [],
    conditions: [],
    feeLines: [],
    payments: [],
    activity: [{ at: now, actor: "applicant", text: "Drafted from last year's event." }],
    permit: null,
    flags: { sentToCommission: false, lateFee: false, signed: false, acceptedComplete: false, amendmentPending: false },
    closeout: { cleanup: null, notes: "", hoursLoggedOn: null, balance: null, refund: null, feedback: null },
    wizardStep: "plan",
    createdAt: now,
    submittedAt: null,
    clonedFrom: c.id,
  };
  let next = moveTask(c, taskId(c.id, "book_again"), "done", ctx, actor);
  next = appendActivity(next, actor, `Started next year's application (${newId}).`, ctx);
  return { ok: true, case: next, spawned: [spawned] };
}

export function amend(c: EventCase, action: Extract_<"amend">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const ed = eventDate(c, ctx.today);
  const check = checkAmend(c, ctx.today, ed);
  if (!check.ok) return check;
  const nextAnswers = action.answers;
  const withAnswers = { ...c, ...nextAnswers };
  const cls = classify(withAnswers, ctx.cfg);
  const freshTasks = requirements(withAnswers, cls, { caseId: c.id, today: ctx.today, cfg: ctx.cfg });
  const newCards = freshTasks.filter((t) => !c.tasks.some((existing) => existing.id === t.id)).map((t) => ({ ...t, tags: ["amendment" as const] }));
  let next: EventCase = {
    ...c,
    ...nextAnswers,
    tier: cls.tier,
    triggers: cls.triggers,
    tasks: [...c.tasks, ...newCards],
    flags: { ...c.flags, amendmentPending: true, lateFee: !!action.lateFee },
  };
  next = appendActivity(next, actor, "Amended the application.", ctx);
  return { ok: true, case: next };
}

function releaseHold(c: EventCase): DateHold {
  return c.dateHold.status === "held" ? { ...c.dateHold, status: "released" } : c.dateHold;
}
