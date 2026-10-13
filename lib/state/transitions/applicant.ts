/**
 * Transitions the applicant actor raises. `pay` lives in ./payment because the Clerk raises
 * it too, for an in-person payment.
 */
import { addDaysISO, daysBetween } from "@/lib/dates";
import { fmtMoney } from "@/lib/format";
import { cancellationRefund, classify, dueDate, estimateFees, requirements } from "@/lib/rules";
import { CARD_BY_ID, type CardSpec } from "@/lib/rules/catalog";
import type { FeeEstimate, RulesCtx } from "@/lib/rules/types";
import type { Actor, DateHold, EventAnswers, EventCase, Task } from "@/lib/types";
import type { Action } from "../actions";
import {
  amendmentNeedsNotice,
  checkAcceptAndSign,
  checkAmend,
  checkAmendedDate,
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
  lateFeeApplies,
} from "../checks";
import { lastSessionDate } from "../clock";
import { syncDraft, withSessions } from "../newCase";
import {
  addTasks,
  appendActivity,
  applyUnlockEvent,
  findTask,
  idSuffix,
  isCatalogId,
  moveTask,
  newTask,
  nowOf,
  parkTasksAwaitingAnswer,
  patchTask,
  preSubmitCardsIn,
  resumeTasksAwaitingAnswer,
  signoffsLeft,
  taskId,
  totalPaid,
} from "../core";
import { eventDate, nextCaseId } from "../selectors";
import type { TransitionResult } from "../types";
import { maybeUnlockIssuePermit } from "./shared";

type Extract_<T extends Action["type"]> = Extract<Action, { type: T }>;

/**
 * The board the answers call for now, and the fee estimate it was priced from. Always worked
 * out afresh, so an edit made after an earlier board cannot leave another tier's cards or fees
 * behind. A card the applicant has already worked on keeps its progress.
 */
function planBoard(draft: EventCase, ctx: RulesCtx): { board: EventCase; estimate: FeeEstimate } {
  // Sessions first: fees count the sessions that are held, and the first payment is for one of them.
  const c = withSessions(draft, ctx);
  const cls = classify(c, ctx.cfg);
  const freshTasks = requirements(c, cls, { caseId: c.id, today: ctx.today, cfg: ctx.cfg });
  const mergedTasks = freshTasks.map((fresh) => {
    const existing = c.tasks.find((t) => t.id === fresh.id);
    // The payment card is the plan's own: its amount, and whether it waits for a quote.
    if (!existing || fresh.catalogId === "pay_fees") return fresh;
    return { ...fresh, status: existing.status, payload: existing.payload, history: existing.history, request: existing.request };
  });
  // Submit application is open exactly when every card before it is in, whatever it was before.
  const ready = preSubmitCardsIn({ ...c, tasks: mergedTasks });
  const tasks = mergedTasks.map((t) =>
    t.catalogId === "submit_application" ? { ...t, status: ready ? ("todo" as const) : ("locked" as const), unlocksOn: ready ? null : ("presubmit_done" as const) } : t,
  );
  const estimate = estimateFees(c, cls, ctx.cfg, { caseId: c.id, lateFee: lateFeeApplies(c, ctx) });
  return { board: { ...c, tier: cls.tier, triggers: cls.triggers, tasks, feeLines: estimate.lines }, estimate };
}

/** Shared by create_board and book_and_pay. */
export function buildBoard(draft: EventCase, ctx: RulesCtx): EventCase {
  return planBoard(draft, ctx).board;
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
  // Never the board as it stands: the Draft may have been edited since it was built.
  const { board, estimate } = planBoard(c, ctx);
  const amount = estimate.dueNow ?? estimate.total;

  let next: EventCase = {
    ...board,
    dateHold: { status: "held", placedOn: ctx.today, expiresOn: null },
    permit: { issuedOn: ctx.today, signature: null },
    state: "permitted",
    payments: [...board.payments, { id: taskId(board.id, "pay", board.payments.length + 1), at: nowOf(ctx), amount, method: action.method, kind: "booking" }],
  };
  const payFeesId = taskId(next.id, "pay_fees");
  const payFeesTask = findTask(next, payFeesId);
  if (payFeesTask) {
    next = moveTask(next, payFeesId, "done", ctx, actor, { payload: { ...payFeesTask.payload, amount } });
  }
  if (next.schedule && next.schedule.occurrences.length > 0) {
    // The booking pays the first session that is held; a skipped (blackout) session stays skipped.
    let firstPaid = false;
    next = {
      ...next,
      schedule: {
        ...next.schedule,
        occurrences: next.schedule.occurrences.map((o) => {
          if (o.billing === "skipped") return o;
          if (firstPaid) return { ...o, billing: "upcoming" as const };
          firstPaid = true;
          return { ...o, billing: "paid" as const };
        }),
      },
    };
  }
  next = appendActivity(next, actor, `Paid ${fmtMoney(amount)} and booked the date. The permit is issued.`, ctx);
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

  // A fresh certificate has to be checked again before the permit can issue, so an unlocked
  // Issue permit goes back to waiting. Verifying the certificate reopens it.
  if (task.catalogId === "insurance_certificate" && newStatus !== "done") {
    const issuePermit = findTask(next, taskId(next.id, "issue_permit"));
    if (issuePermit?.status === "todo") next = moveTask(next, issuePermit.id, "locked", ctx, "system", {}, "Waiting on the insurance check");
  }

  const hasPreSubmitCards = next.tasks.some((t) => isCatalogId(t.catalogId) && (CARD_BY_ID as Record<string, CardSpec>)[t.catalogId]?.preSubmit);
  if (hasPreSubmitCards && preSubmitCardsIn(next)) next = applyUnlockEvent(next, "presubmit_done", ctx);

  next = appendActivity(next, actor, `Completed "${task.title}".`, ctx);
  return { ok: true, case: next };
}

/**
 * Gives the card's reviewer a task to check it, so a card "With the city" always has someone
 * tasked. Shared with respond_to_request. Nothing is added while the department's own review is
 * open (deciding the review accepts every card sent to it), or before the case is routed.
 */
export function maybeCreateVerifyTask(c: EventCase, card: Task, ctx: RulesCtx): EventCase {
  const dept = card.reviewer;
  if (!dept) return c;
  // From routing to the event: these cards keep arriving after the permit (a vendor's health
  // permit is due 14 days before the day), when the review that covered them is long decided.
  const routed = c.state === "in_review" || c.state === "needs_info" || c.state === "quote_sent" || c.state === "permitted" || c.state === "event_day";
  if (!routed) return c;
  const isOpen = (t: Task | undefined) => t?.status === "todo" || t?.status === "changes_requested";
  if (isOpen(findTask(c, taskId(c.id, `review:${dept}`)))) return c;

  const suffix = idSuffix(c, card.id);
  const verifyId = taskId(c.id, `verify:${suffix}`);
  const due = dueDate(ctx.today, ctx.cfg.sla.verificationDays, ctx.cfg);
  // One verify task per card. A second upload reopens it, so ids stay unique.
  const existing = findTask(c, verifyId);
  if (existing) return isOpen(existing) ? c : moveTask(c, verifyId, "todo", ctx, "system", { dueDate: due });
  const verifyTask = newTask(
    {
      id: verifyId,
      catalogId: `verify:${suffix}`,
      owner: dept,
      kind: "review",
      title: `Verify ${card.title}`,
      reviewer: null,
      dueDate: due,
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
    next = releaseIntakeCheck(next, ctx);
  }
  next = appendActivity(next, actor, `A neighbor signed off (${done} of ${progress.total}).`, ctx);
  return { ok: true, case: next };
}

/**
 * The last sign-off is what lets the Clerk act on a block party, so that is when its intake
 * check opens and its three days start. If the Clerk is meanwhile waiting on an answer of its
 * own, the check stays parked for that instead.
 */
function releaseIntakeCheck(c: EventCase, ctx: RulesCtx): EventCase {
  const intake = findTask(c, taskId(c.id, "intake_check"));
  if (!intake || intake.status !== "locked" || intake.payload.awaitingSignoffs !== true) return c;
  const next = moveTask(c, intake.id, "todo", ctx, "system", {
    dueDate: dueDate(ctx.today, ctx.cfg.sla.intakeDays, ctx.cfg),
    payload: { ...intake.payload, awaitingSignoffs: false },
  });
  const clerkIsAsking = next.tasks.some((t) => t.request && !t.request.resolved && t.request.from === "clerk");
  return clerkIsAsking ? parkTasksAwaitingAnswer(next, "clerk", ctx) : next;
}

export function submit(c: EventCase, _action: Extract_<"submit">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkSubmit(c, ctx);
  if (!check.ok) return check;
  // The fee lines the Clerk quotes from are priced as the application goes in: this is the
  // moment the lead time is measured, so it is also when a late fee joins them.
  const estimate = estimateFees(c, classify(c, ctx.cfg), ctx.cfg, { caseId: c.id, lateFee: lateFeeApplies(c, ctx) });
  let next: EventCase = { ...c, feeLines: estimate.lines, state: "submitted", submittedAt: nowOf(ctx) };
  next = moveTask(next, taskId(next.id, "submit_application"), "done", ctx, actor);
  // A block party still collecting sign-offs is the neighbors' move, not the Clerk's: the intake
  // check waits, locked, until the last one is in (see releaseIntakeCheck).
  const awaitingSignoffs = signoffsLeft(next) > 0;
  const intakeTask = newTask(
    {
      id: taskId(next.id, "intake_check"),
      catalogId: "intake_check",
      owner: "clerk",
      kind: "review",
      title: "Check the application is complete",
      dueDate: awaitingSignoffs ? null : dueDate(ctx.today, ctx.cfg.sla.intakeDays, ctx.cfg),
      status: awaitingSignoffs ? "locked" : "todo",
      payload: awaitingSignoffs ? { awaitingSignoffs: true } : {},
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
  const deptStillWaiting = next.tasks.some((t) => t.request && !t.request.resolved && t.request.from === dept);
  if (review && !deptStillWaiting) {
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
  // The asker gets its parked review (or intake check) back; failing that, a task to check the answer.
  next = resumeTasksAwaitingAnswer(next, dept, ctx);
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
  // Withdrawing leaves no fees owed, so anything paid toward the quote goes back.
  const paid = totalPaid(c);
  let next: EventCase = { ...c, ending: "withdrawn", endingReason: "Withdrawn by the applicant.", dateHold: releaseHold(c) };
  if (paid > 0) {
    next = {
      ...next,
      payments: [...c.payments, { id: taskId(c.id, "pay", c.payments.length + 1), at: nowOf(ctx), amount: -paid, method: "card", kind: "refund" }],
    };
  }
  next = appendActivity(next, actor, paid > 0 ? `Withdrew the application. Refunded ${fmtMoney(paid)}.` : "Withdrew the application.", ctx);
  return { ok: true, case: next };
}

export function cancel(c: EventCase, _action: Extract_<"cancel">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const last = lastSessionDate(c);
  const check = checkCancel(c, ctx.today, last);
  if (!check.ok) return check;
  const result = cancellationRefund(c, ctx.today, ctx.cfg);
  const depositPaid = c.feeLines.filter((f) => f.kind === "deposit").reduce((s, f) => s + f.estimate, 0);
  // The schedule works from the fee lines, which for a series cover sessions not yet paid for.
  // A refund never exceeds what the applicant has paid.
  const refund = Math.min(result.refund + depositPaid, Math.max(0, totalPaid(c)));
  let next: EventCase = { ...c, ending: "cancelled", endingReason: result.rule, dateHold: releaseHold(c) };
  if (refund > 0) {
    next = {
      ...next,
      payments: [...c.payments, { id: taskId(c.id, "pay", c.payments.length + 1), at: nowOf(ctx), amount: -refund, method: "card", kind: "refund" }],
    };
  }
  next = appendActivity(next, actor, `Cancelled. ${result.rule}. ${refund > 0 ? `Refunded ${fmtMoney(refund)}.` : "Nothing to refund."}`, ctx);
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
  // The new Draft is prepared like any Draft the store creates: next year's sessions listed
  // against next year's calendar, and the tier of the plan it copies.
  return { ok: true, case: next, spawned: [syncDraft(spawned, ctx)] };
}

/** Only what the wizard collects. An amendment changes the answers, never the record's history. */
function answersOf(a: EventAnswers): EventAnswers {
  return { eventType: a.eventType, name: a.name, description: a.description, location: a.location, schedule: a.schedule, attendance: a.attendance, addOns: a.addOns };
}

/**
 * The fee lines of an amended plan: the new plan's own lines, plus every line somebody added
 * to the old one (a reviewer's fire watch, a late fee already charged). The old plan's own
 * lines are the ones its answers price, and those are replaced.
 */
function amendedFeeLines(before: EventCase, fresh: FeeEstimate, ctx: RulesCtx): EventCase["feeLines"] {
  const priced = new Set(estimateFees(before, classify(before, ctx.cfg), ctx.cfg).lines.map((line) => line.label));
  const chargesLateFee = fresh.lines.some((line) => line.kind === "late_fee");
  const added = before.feeLines.filter((line) => (line.kind === "late_fee" ? !chargesLateFee : !priced.has(line.label)));
  return [...fresh.lines, ...added].map((line, i) => ({ ...line, id: taskId(before.id, "fee", i + 1) }));
}

/**
 * P1. The same record takes new answers: it is classified again, the date gate runs again, and
 * the cards the new plan adds join the board tagged 'amendment'. State, permit and date hold
 * are not touched, so a permit stays valid for the original plan while the amendment is
 * pending (`flags.amendmentPending`). What happens to a pending amendment next (its review and
 * its quote) belongs to workstream 5A.
 */
export function amend(c: EventCase, action: Extract_<"amend">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const ed = eventDate(c, ctx.today);
  const check = checkAmend(c, ctx.today, ed);
  if (!check.ok) return check;

  // Sessions first, as for a Draft: the new schedule's sessions come from the rules engine.
  const withAnswers = withSessions({ ...c, ...answersOf(action.answers), flags: { ...c.flags, lateFee: !!action.lateFee } }, ctx);
  const cls = classify(withAnswers, ctx.cfg);
  const amended: EventCase = { ...withAnswers, tier: cls.tier, triggers: cls.triggers };

  const gate = checkAmendedDate(c, amended, ctx);
  if (!gate.ok) return gate;

  // The late fee is for notice the amendment needed and did not have, nothing else.
  const lateFee = amendmentNeedsNotice(c, amended) && lateFeeApplies(amended, ctx);
  const estimate = estimateFees(amended, cls, ctx.cfg, { caseId: c.id, lateFee });
  const freshTasks = requirements(amended, cls, { caseId: c.id, today: ctx.today, cfg: ctx.cfg });
  const newCards = freshTasks.filter((t) => !c.tasks.some((existing) => existing.id === t.id)).map((t) => ({ ...t, tags: ["amendment" as const] }));

  let next: EventCase = {
    ...amended,
    tasks: [...c.tasks, ...newCards],
    feeLines: amendedFeeLines(c, estimate, ctx),
    flags: { ...amended.flags, amendmentPending: true },
  };
  const lateFeeLine = estimate.lines.find((line) => line.kind === "late_fee");
  next = appendActivity(next, actor, `Amended the plan: ${cls.summary}.${lateFeeLine ? ` Late fee: ${fmtMoney(lateFeeLine.estimate)}.` : ""}`, ctx);
  return { ok: true, case: next };
}

function releaseHold(c: EventCase): DateHold {
  return c.dateHold.status === "held" ? { ...c.dateHold, status: "released" } : c.dateHold;
}
