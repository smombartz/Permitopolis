/**
 * Transitions the applicant actor raises. `pay` lives in ./payment because the Clerk raises
 * it too, for an in-person payment.
 */
import { addDaysISO, daysBetween } from "@/lib/dates";
import { fmtMoney } from "@/lib/format";
import { classify, dueDate, estimateFees, requirements } from "@/lib/rules";
import { round2 } from "@/lib/rules/shared";
import { CARD_BY_ID, CITY_TASKS, type CardSpec } from "@/lib/rules/catalog";
import type { FeeEstimate, RulesCtx } from "@/lib/rules/types";
import type { Actor, EventAnswers, EventCase, Task } from "@/lib/types";
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
  releaseHold,
  resumeTasksAwaitingAnswer,
  signoffsLeft,
  taskId,
  totalPaid,
} from "../core";
import { caseTotals, eventDate, nextCaseId, refundIfCancelled } from "../selectors";
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
    // What the applicant put on the card stays (its files, its form, the sign-offs so far).
    // Whose permit a per-vendor card is follows the answers as they are now, like its title.
    const payload = fresh.payload.vendorName === undefined ? existing.payload : { ...existing.payload, vendorName: fresh.payload.vendorName };
    return { ...fresh, status: existing.status, payload, history: existing.history, request: existing.request };
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
  // "Submit amendment": the same card and action, reused outside Draft. The amendment stays
  // pending (flags.amendmentPending) until the City Clerk decides it (see amend(), below).
  if (c.flags.amendmentPending) {
    const next = moveTask(c, taskId(c.id, "submit_application"), "done", ctx, actor);
    return { ok: true, case: appendActivity(next, actor, "Submitted the amendment.", ctx) };
  }
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
      title: CITY_TASKS.intake_check.title,
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
    // The days it waited on the applicant are given back to the department: the due date moves
    // with the clock, on the review and on its task, so "Day 11 of 14" is never also "Due today".
    const pushed = (date: string | null) => (date && pausedDays > 0 ? addDaysISO(date, pausedDays) : date);
    next = {
      ...next,
      reviews: next.reviews.map((r) =>
        r.dept === dept
          ? { ...r, status: "pending", dueDate: pushed(r.dueDate), clock: { ...r.clock, pausedSince: null, pausedDays: r.clock.pausedDays + pausedDays } }
          : r,
      ),
      tasks: next.tasks.map((t) => (t.id === taskId(next.id, `review:${dept}`) && t.status !== "done" ? { ...t, dueDate: pushed(t.dueDate) } : t)),
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
  let next: EventCase = { ...c, ending: "withdrawn", endingReason: "Withdrawn by the applicant.", dateHold: releaseHold(c.dateHold) };
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
  // The same figure the permit page and the Cancel dialog showed before the button was pressed.
  const result = refundIfCancelled(c, ctx.today, ctx.cfg);
  const refund = result.refund;
  // The banner on the case reads this: who ended it and what went back, with the band that set it.
  const endingReason = `Cancelled by the applicant. ${refund > 0 ? `Refunded ${fmtMoney(refund)}` : "Nothing refunded"} (${result.rule}).`;
  let next: EventCase = { ...c, ending: "cancelled", endingReason, dateHold: releaseHold(c.dateHold) };
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
 * are not touched, so a permit stays valid for the original plan while a *material* amendment
 * is pending (`flags.amendmentPending`): one that lowers the tier or changes nothing a reviewer
 * would need to see again (no new card) applies at once instead (see `material`, below).
 *
 * The City Clerk's decision on a pending amendment is this same action (`decideAmendment()`):
 * there is no city-only action type or panel for it in this workstream's files (see the
 * engineRequests for a dedicated one), so the Clerk's dispatch is told apart by its `answers`:
 * the ones already on the record (approve, keep what is here) or the ones stashed on the
 * amendment's own "Submit application" card before it was proposed (decline, put it back).
 */
export function amend(c: EventCase, action: Extract_<"amend">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const ed = eventDate(c, ctx.today);
  const check = checkAmend(c, ctx.today, ed, actor);
  if (!check.ok) return check;

  if (actor === "clerk") return decideAmendment(c, action, actor, ctx);

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
  // A new card is dated from the amendment: it has been the applicant's since now, not since the
  // original application went in.
  const newCards = freshTasks
    .filter((t) => !c.tasks.some((existing) => existing.id === t.id))
    .map((t) => ({ ...t, tags: ["amendment" as const], history: [{ at: nowOf(ctx), actor, status: t.status }] }));

  // Nothing new is required of anybody (a later time the same day, a smaller crowd), or the
  // change actually lowers the tier: either way there is nothing to send the City Clerk, so it
  // takes effect immediately.
  const material = newCards.length > 0;

  let next: EventCase = {
    ...amended,
    tasks: [...c.tasks, ...newCards],
    feeLines: amendedFeeLines(c, estimate, ctx),
    flags: { ...amended.flags, amendmentPending: material },
  };

  if (material) {
    // The amendment's own "Submit application" card, new or (on a case amended more than once)
    // already spent: reopened and tagged, with what the record looked like before this
    // amendment so the City Clerk's decline can put it back exactly.
    const resubmitId = taskId(next.id, "submit_application");
    const resubmitTask = findTask(next, resubmitId);
    if (resubmitTask) {
      const ready = preSubmitCardsIn(next);
      const status: "todo" | "locked" = ready ? "todo" : "locked";
      const payload = { ...resubmitTask.payload, priorAnswers: answersOf(c), priorFlags: { lateFee: c.flags.lateFee } };
      next =
        resubmitTask.status === status
          ? patchTask(next, resubmitId, { tags: ["amendment"], payload })
          : moveTask(next, resubmitId, status, ctx, "system", { tags: ["amendment"], unlocksOn: ready ? null : "presubmit_done", payload });
    }
  }

  const lateFeeLine = estimate.lines.find((line) => line.kind === "late_fee");
  next = appendActivity(next, actor, `Amended the plan: ${cls.summary}.${lateFeeLine ? ` Late fee: ${fmtMoney(lateFeeLine.estimate)}.` : ""}`, ctx);
  return { ok: true, case: next };
}

function sameAnswers(a: EventAnswers, b: EventAnswers): boolean {
  return JSON.stringify(answersOf(a)) === JSON.stringify(answersOf(b));
}

/** The City Clerk's decision on a pending, submitted amendment (see the doc comment on amend()). */
function decideAmendment(c: EventCase, action: Extract_<"amend">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const submitTask = findTask(c, taskId(c.id, "submit_application"));
  const priorAnswers = submitTask?.payload.priorAnswers as EventAnswers | undefined;
  const priorFlags = submitTask?.payload.priorFlags as { lateFee: boolean } | undefined;
  if (priorAnswers && sameAnswers(action.answers, priorAnswers)) {
    return declineAmendment(c, priorAnswers, priorFlags?.lateFee ?? false, actor, ctx);
  }
  if (sameAnswers(action.answers, c)) {
    return approveAmendment(c, actor, ctx);
  }
  return { ok: false, reason: "Approve the amendment as it stands, or decline it back to the original plan." };
}

/**
 * Clears the pending flag; the record already carries the amended plan, so the permit now
 * covers it. The fee difference goes through the existing payment card ("Pay fees and
 * deposit"), the same one that took the original payment: approving settles it at once, a
 * simulated charge or refund like the rest of this demo's payments (the booking the Clerk could
 * instead leave the card open for the applicant to pay separately needs `pay`'s own check
 * (`checkPay`, outside this workstream's files) to accept a "quote" payment on a Permitted case,
 * which it does not today — see the engineRequests).
 */
function approveAmendment(c: EventCase, actor: Actor, ctx: RulesCtx): TransitionResult {
  const diff = round2(caseTotals(c).total - totalPaid(c));
  let next: EventCase = { ...c, flags: { ...c.flags, amendmentPending: false } };
  if (diff !== 0) {
    next = {
      ...next,
      payments: [...next.payments, { id: taskId(next.id, "pay", next.payments.length + 1), at: nowOf(ctx), amount: diff, method: "card", kind: diff > 0 ? "quote" : "refund" }],
    };
  }
  const payFees = findTask(next, taskId(next.id, "pay_fees"));
  if (payFees && payFees.status !== "done") {
    next = moveTask(next, payFees.id, "done", ctx, "system", { payload: { ...payFees.payload, amount: totalPaid(next) } });
  } else if (payFees) {
    next = patchTask(next, payFees.id, { payload: { ...payFees.payload, amount: totalPaid(next) } });
  }
  const message = diff > 0 ? `Approved the amendment. Charged ${fmtMoney(diff)}.` : diff < 0 ? `Approved the amendment. Refunded ${fmtMoney(-diff)}.` : "Approved the amendment.";
  return { ok: true, case: appendActivity(next, actor, message, ctx) };
}

/** Puts the record back exactly as it was before the amendment and drops its cards. */
function declineAmendment(c: EventCase, priorAnswers: EventAnswers, priorLateFee: boolean, actor: Actor, ctx: RulesCtx): TransitionResult {
  const reverted = withSessions({ ...c, ...answersOf(priorAnswers), flags: { ...c.flags, lateFee: priorLateFee, amendmentPending: false } }, ctx);
  const cls = classify(reverted, ctx.cfg);
  const estimate = estimateFees(reverted, cls, ctx.cfg, { caseId: c.id, lateFee: priorLateFee });
  // A verify task a reviewer got for one of the amendment's own cards goes with it.
  const removedSuffixes = new Set(c.tasks.filter((t) => t.tags.includes("amendment")).map((t) => idSuffix(c, t.id)));
  const tasks = c.tasks.filter((t) => !t.tags.includes("amendment") && !(t.catalogId.startsWith("verify:") && removedSuffixes.has(t.catalogId.slice("verify:".length))));
  const next: EventCase = { ...reverted, tier: cls.tier, triggers: cls.triggers, tasks, feeLines: estimate.lines };
  return { ok: true, case: appendActivity(next, actor, "Declined the amendment; the original plan stands.", ctx) };
}
