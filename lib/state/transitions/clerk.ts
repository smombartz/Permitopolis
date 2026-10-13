/** Transitions only the City Clerk raises. */
import { addDaysISO, daysBetween } from "@/lib/dates";
import { fmtMoney } from "@/lib/format";
import { dueDate } from "@/lib/rules";
import { CARD_BY_ID, CITY_TASKS } from "@/lib/rules/catalog";
import type { RulesCtx } from "@/lib/rules/types";
import type { Actor, Condition, EventCase, FeeLine, Review } from "@/lib/types";
import type { Action } from "../actions";
import { checkAcceptComplete, checkConfirmRouting, checkDeny, checkIssuePermit, checkReconcileClose, checkSendQuote } from "../checks";
import { lastSessionDate } from "../clock";
import { closeoutSettlement } from "../selectors";
import { addTask, addTasks, appendActivity, applyUnlockEvent, dueAtQuote, findTask, lineAmount, moveTask, newTask, nowOf, patchTask, releaseHold, taskId } from "../core";
import type { TransitionResult } from "../types";

type Extract_<T extends Action["type"]> = Extract<Action, { type: T }>;

export function acceptComplete(c: EventCase, _action: Extract_<"accept_complete">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkAcceptComplete(c, ctx);
  if (!check.ok) return check;
  let next: EventCase = {
    ...c,
    flags: { ...c.flags, acceptedComplete: true },
    dateHold: { status: "held", placedOn: ctx.today, expiresOn: null },
  };
  const intakeId = taskId(next.id, "intake_check");
  if (findTask(next, intakeId)) next = moveTask(next, intakeId, "done", ctx, actor);
  // Accepting the application accepts the answers to the Clerk's own intake requests with it;
  // nobody else is tasked with them, so they would sit "With the city" for good.
  for (const t of next.tasks) {
    const answeredForClerk = t.owner === "applicant" && t.status === "submitted" && t.reviewer === "clerk" && t.request?.from === "clerk" && t.request.resolved;
    if (answeredForClerk) next = moveTask(next, t.id, "done", ctx, actor);
  }

  const confirmRoutingTask = newTask(
    { id: taskId(next.id, "confirm_routing"), catalogId: "confirm_routing", owner: "clerk", kind: "action", title: CITY_TASKS.confirm_routing.title, phase: "review" },
    ctx,
    "system",
  );
  const newTasks = [confirmRoutingTask];
  if (next.tier === "special") {
    newTasks.push(
      newTask(
        { id: taskId(next.id, "schedule_pre_application_meeting"), catalogId: "schedule_pre_application_meeting", owner: "clerk", kind: "meeting", title: "Schedule the pre-application meeting", phase: "review" },
        ctx,
        "system",
      ),
    );
  }
  next = addTasks(next, newTasks);
  next = applyUnlockEvent(next, "accepted", ctx);
  next = appendActivity(next, actor, "Accepted the application as complete; the date is held.", ctx);
  return { ok: true, case: next };
}

export function confirmRouting(c: EventCase, action: Extract_<"confirm_routing">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkConfirmRouting(c, action.reviewers, ctx.today);
  if (!check.ok) return check;
  const reviews: Review[] = action.reviewers.map((r) => ({
    dept: r.dept,
    sections: r.sections,
    status: "pending",
    dueDate: r.dueDate,
    decidedOn: null,
    // The allowance is what the Clerk gave this department: the days from routing to its due
    // date. The config's review days only prefill that date in the routing panel.
    clock: { startedOn: ctx.today, pausedSince: null, pausedDays: 0, allowedDays: Math.max(0, daysBetween(ctx.today, r.dueDate)) },
    internalNote: "",
    messageToApplicant: "",
  }));
  const reviewTasks = action.reviewers.map((r) =>
    newTask(
      { id: taskId(c.id, `review:${r.dept}`), catalogId: `review:${r.dept}`, owner: r.dept, kind: "review", title: "Review your sections", dueDate: r.dueDate, phase: "review" },
      ctx,
      "system",
    ),
  );
  // The Clerk's next step exists from the start, locked: while the reviews are out the Clerk
  // reads "Waiting", with what it waits for, not "Done for now". The last approval opens it.
  const consolidate = newTask(
    { id: taskId(c.id, "consolidate"), catalogId: "consolidate", owner: "clerk", kind: "action", title: CITY_TASKS.consolidate.title, status: "locked", phase: "permit" },
    ctx,
    "system",
  );
  let next: EventCase = { ...c, reviews: [...c.reviews, ...reviews], state: "in_review" };
  next = addTasks(next, findTask(c, consolidate.id) ? reviewTasks : [...reviewTasks, consolidate]);
  next = moveTask(next, taskId(next.id, "confirm_routing"), "done", ctx, actor);
  next = applyUnlockEvent(next, "routed", ctx);
  next = appendActivity(next, actor, "Confirmed routing; the case moved to In review.", ctx);
  return { ok: true, case: next };
}

export function deny(c: EventCase, action: Extract_<"deny">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkDeny(c);
  if (!check.ok) return check;
  const next = appendActivity(
    { ...c, ending: "denied", endingReason: action.reason, dateHold: releaseHold(c.dateHold) },
    actor,
    `Denied: ${action.reason}`,
    ctx,
  );
  return { ok: true, case: next };
}

export function sendQuote(c: EventCase, action: Extract_<"send_quote">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkSendQuote(c);
  if (!check.ok) return check;

  // `merged` is the quote builder: its lists are final, an empty one included. Without it an
  // empty list stands for the case's own.
  let conditions: Condition[];
  if (action.merged || action.conditions.length > 0) {
    conditions = action.conditions.map((cd, i) => ({ id: taskId(c.id, "cond", i + 1), dept: cd.dept, text: cd.text, mergedByClerk: true, acceptedByApplicant: false }));
  } else {
    conditions = c.conditions.map((cond) => ({ ...cond, mergedByClerk: true }));
  }

  let feeLines: FeeLine[];
  if (action.merged || action.feeLines.length > 0) {
    feeLines = action.feeLines.map((fl, i) => ({
      id: taskId(c.id, "fee", i + 1),
      dept: fl.dept,
      label: fl.label,
      qty: fl.qty,
      unit: fl.unit,
      unitPrice: fl.unitPrice,
      estimate: lineAmount(fl.qty, fl.unitPrice),
      actual: null,
      kind: fl.kind ?? "fee",
    }));
  } else {
    feeLines = c.feeLines;
  }

  let next: EventCase = {
    ...c,
    conditions,
    feeLines,
    state: "quote_sent",
    dateHold: { ...c.dateHold, expiresOn: addDaysISO(ctx.today, ctx.cfg.hold.daysAfterQuote) },
  };
  const consolidateId = taskId(next.id, "consolidate");
  if (findTask(next, consolidateId)) next = moveTask(next, consolidateId, "done", ctx, actor);
  next = addTask(
    next,
    newTask({ id: taskId(next.id, "issue_permit"), catalogId: "issue_permit", owner: "clerk", kind: "action", title: "Issue permit", status: "locked", phase: "permit" }, ctx, "system"),
  );
  next = applyUnlockEvent(next, "quote_sent", ctx);
  const payFees = findTask(next, taskId(next.id, "pay_fees"));
  if (payFees) {
    // Everything for a single event; for a series, the one-off lines and the first session.
    next = patchTask(next, payFees.id, { payload: { ...payFees.payload, amount: dueAtQuote(next, ctx.cfg) } });
  }
  next = appendActivity(next, actor, "Sent the quote.", ctx);
  return { ok: true, case: next };
}

export function issuePermit(c: EventCase, _action: Extract_<"issue_permit">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkIssuePermit(c, ctx);
  if (!check.ok) return check;
  let next: EventCase = {
    ...c,
    state: "permitted",
    permit: { issuedOn: ctx.today, signature: (findTask(c, taskId(c.id, "accept_and_sign"))?.payload.signature as string | undefined) ?? null },
    // The hold's expiry was the deadline for paying the quote. With the permit issued the date
    // is simply held, so nothing downstream reads "held until" a date that no longer applies.
    dateHold: { ...c.dateHold, expiresOn: null },
  };
  // The Clerk's own "Issue permit" task is done by issuing it; it must not stay in the queue.
  const issueTaskId = taskId(next.id, "issue_permit");
  if (findTask(next, issueTaskId)) next = moveTask(next, issueTaskId, "done", ctx, actor, { unlocksOn: null });
  next = applyUnlockEvent(next, "permitted", ctx);
  next = addTasks(next, workOrdersFor(next, ctx));
  next = appendActivity(next, actor, "Issued the permit.", ctx);
  return { ok: true, case: next };
}

function workOrdersFor(c: EventCase, ctx: RulesCtx) {
  const last = lastSessionDate(c);
  const due = last ? addDaysISO(last, -2) : ctx.today;
  const services = c.addOns.cityServices;
  const usesStreet = c.location?.mode === "streets" || c.location?.mode === "route";
  const orders: { key: string; title: string }[] = [];
  if (usesStreet || (services?.barricades ?? 0) > 0) orders.push({ key: "barricades", title: "Deliver barricades" });
  if ((services?.policeOfficers ?? 0) > 0 || c.addOns.alcohol) orders.push({ key: "police", title: "Staff police officers" });
  if (usesStreet) orders.push({ key: "closure", title: "Close the street" });
  if (services?.trash) orders.push({ key: "trash", title: "Arrange trash service" });
  if (services?.power) orders.push({ key: "power", title: "Arrange power" });
  return orders.map((o) =>
    newTask({ id: taskId(c.id, `work_order:${o.key}`), catalogId: `work_order:${o.key}`, owner: "pws", kind: "action", title: o.title, dueDate: due, phase: "before_event" }, ctx, "system"),
  );
}

export function reconcileClose(c: EventCase, _action: Extract_<"reconcile_close">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkReconcileClose(c);
  if (!check.ok) return check;
  // The figures the Clerk saw on the Conditions and fees tab and in this action's panel.
  const { over: balance, refund, bill: owed } = closeoutSettlement(c);

  let next: EventCase = { ...c, closeout: { ...c.closeout, balance, refund } };
  const billId = taskId(next.id, "final_bill_or_refund");
  const billTask = findTask(next, billId);
  if (billTask) {
    if (refund !== null) {
      next = moveTask(next, billId, "done", ctx, actor, { payload: { ...billTask.payload, amount: -refund }, unlocksOn: null });
      next = { ...next, payments: [...next.payments, { id: taskId(next.id, "pay", next.payments.length + 1), at: nowOf(ctx), amount: -refund, method: "in_person", kind: "refund" }] };
    } else {
      next = patchTask(next, billId, { payload: { ...billTask.payload, amount: owed ?? undefined } });
    }
  } else if (owed !== null && owed > 0) {
    // An Instant event has no deposit to reconcile and so no final-bill card. A charge from its
    // closeout exception (a broken table) still has to reach the applicant, so it gets one now.
    const spec = CARD_BY_ID.final_bill_or_refund;
    next = addTask(
      next,
      newTask(
        {
          id: billId,
          catalogId: spec.id,
          owner: "applicant",
          kind: spec.kind,
          title: spec.title,
          why: spec.why,
          reviewer: spec.reviewer,
          dueDate: dueDate(ctx.today, ctx.cfg.sla.finalBillDaysAfterInvoice, ctx.cfg),
          phase: spec.phase,
          payload: { amount: owed },
        },
        ctx,
        "system",
      ),
    );
  }
  const exceptionId = taskId(next.id, "instant_exception");
  if (findTask(next, exceptionId)) next = moveTask(next, exceptionId, "done", ctx, actor);
  const reconcileId = taskId(next.id, "reconcile");
  if (findTask(next, reconcileId)) next = moveTask(next, reconcileId, "done", ctx, actor, { unlocksOn: null });

  // The event is over and settled: the date is no longer held for it.
  next = { ...next, state: "closed", dateHold: releaseHold(next.dateHold) };
  next = applyUnlockEvent(next, "invoice_issued", ctx);
  next = applyUnlockEvent(next, "closed", ctx);
  next = appendActivity(next, actor, refund !== null ? `Closed. Refunded ${fmtMoney(refund)} from the deposit.` : `Closed. Final bill: ${fmtMoney(owed ?? 0)}.`, ctx);
  return { ok: true, case: next };
}

