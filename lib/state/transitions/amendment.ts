/**
 * P1: amendment (PRD, "Amend"). The same record takes new answers and nothing is lost.
 *
 * 1. The applicant proposes a change (`amend`). The record is classified again and the date gate
 *    runs again. A change that adds no card (a smaller crowd, an hour later) takes effect at
 *    once. One that adds a card is *pending*: the cards join the board tagged 'amendment', and
 *    the state, the permit, the date hold and the payments are left alone, so the permit stays
 *    valid for the original plan (`permittedPlan()` in ../amendment.ts).
 * 2. The applicant finishes the new cards and submits the amendment (`submit`, on the
 *    amendment's own "Submit application" card). The departments that check those cards get
 *    their verify tasks as for any card; the City Clerk gets "Decide amendment", which opens
 *    when the cards are checked.
 * 3. The Clerk approves or declines (`decide_amendment`). A decline puts the record back exactly
 *    as it was. An approval is the amendment's quote: on a permitted case the applicant accepts
 *    and signs if the plan now needs a signature it never had, and pays what the amended plan
 *    costs beyond what was paid (a difference in the applicant's favor is refunded on the spot).
 * 4. The amendment is in effect when nothing of that is left: `flags.amendmentPending` clears and
 *    the permit covers the amended plan.
 */
import { addDaysISO } from "@/lib/dates";
import { fmtMoney } from "@/lib/format";
import { classify, dueDate, estimateFees, requirements } from "@/lib/rules";
import { CARD_BY_ID, CITY_TASKS, type CardSpec } from "@/lib/rules/catalog";
import type { FeeEstimate, RulesCtx } from "@/lib/rules/types";
import type { Actor, EventAnswers, EventCase, ISODate, Task, UnlockEvent } from "@/lib/types";
import type { Action } from "../actions";
import { amendmentBalance, amendmentCardsInFlight, amendmentPayOpen, amendmentSignOpen, amendmentStage, pendingAmendment, type PendingAmendment } from "../amendment";
import { amendmentNeedsNotice, checkAmend, checkAmendedDate, checkDecideAmendment, lateFeeApplies } from "../checks";
import { withSessions } from "../newCase";
import { addTask, appendActivity, findTask, idSuffix, moveTask, newTask, nowOf, patchTask, preSubmitCardsIn, quoteBalance, taskId, totalPaid } from "../core";
import { eventDate } from "../selectors";
import type { TransitionResult } from "../types";
import { syncWorkOrders, withFoodPermitsTask } from "./shared";

type Extract_<T extends Action["type"]> = Extract<Action, { type: T }>;

const SUBMIT = "submit_application";
const DECIDE = "decide_amendment";

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

/* ---------- 1. the applicant proposes ---------- */

export function amend(c: EventCase, action: Extract_<"amend">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkAmend(c, ctx.today, eventDate(c, ctx.today));
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
  // A new card is dated from the amendment: it has been the applicant's since now, not since the
  // original application went in.
  const newCards = freshTasks
    .filter((t) => !c.tasks.some((existing) => existing.id === t.id))
    .map((t) => ({ ...t, tags: ["amendment" as const], history: [{ at: nowOf(ctx), actor, status: t.status }] }));

  // Nothing new is required of anybody (a later time the same day, a smaller crowd), or the
  // change lowers the tier: there is nothing to send the City Clerk, so it takes effect at once.
  const material = newCards.length > 0;

  let next: EventCase = {
    ...amended,
    tasks: [...c.tasks, ...newCards],
    feeLines: amendedFeeLines(c, estimate, ctx),
    flags: { ...amended.flags, amendmentPending: material },
  };

  if (material) {
    next = reopenSubmitCard(next, c, ctx);
  } else if (next.permit) {
    // In effect now: what it costs more or less is settled, and the work orders follow the plan.
    next = syncWorkOrders(settleDifference(next, ctx), ctx);
  }

  const lateFeeLine = estimate.lines.find((line) => line.kind === "late_fee");
  next = appendActivity(next, actor, `Amended the plan: ${cls.summary}.${lateFeeLine ? ` Late fee: ${fmtMoney(lateFeeLine.estimate)}.` : ""}`, ctx);
  return { ok: true, case: next };
}

/**
 * The amendment's own "Submit application" card: new, or (on a case that was submitted once
 * already) reopened and tagged. It carries what the record looked like before, which is how the
 * permit keeps its plan and how a decline puts everything back.
 */
function reopenSubmitCard(next: EventCase, before: EventCase, ctx: RulesCtx): EventCase {
  const id = taskId(next.id, SUBMIT);
  const card = findTask(next, id);
  if (!card) return next;
  const was = findTask(before, id);
  const stash: PendingAmendment = {
    priorAnswers: answersOf(before),
    priorTier: before.tier,
    priorTriggers: before.triggers,
    priorLateFee: before.flags.lateFee,
    priorFeeLines: before.feeLines,
    priorSubmit: was ? { status: was.status, unlocksOn: was.unlocksOn, tags: was.tags } : null,
    proposedOn: ctx.today,
  };
  const ready = preSubmitCardsIn(next);
  const status: "todo" | "locked" = ready ? "todo" : "locked";
  const payload = { ...card.payload, pendingAmendment: stash };
  return card.status === status
    ? patchTask(next, id, { tags: ["amendment"], payload })
    : moveTask(next, id, status, ctx, "system", { tags: ["amendment"], unlocksOn: ready ? null : "presubmit_done", payload });
}

/* ---------- 2. the applicant submits ---------- */

/** "Submit amendment": `submit` on a case with a pending amendment. The City Clerk gets the decision. */
export function submitAmendment(c: EventCase, actor: Actor, ctx: RulesCtx): EventCase {
  let next = moveTask(c, taskId(c.id, SUBMIT), "done", ctx, actor);
  const id = taskId(next.id, DECIDE);
  const waiting = amendmentCardsInFlight(next).length > 0;
  const status: "todo" | "locked" = waiting ? "locked" : "todo";
  const due = waiting ? null : decisionDue(ctx);
  // One decision task per case; a later amendment opens it again, so ids stay unique.
  next = findTask(next, id)
    ? moveTask(next, id, status, ctx, "system", { dueDate: due, payload: {} })
    : addTask(next, newTask({ id, catalogId: DECIDE, owner: CITY_TASKS.decide_amendment.owner, kind: CITY_TASKS.decide_amendment.kind, title: CITY_TASKS.decide_amendment.title, status, dueDate: due, phase: "review" }, ctx, "system"));
  return appendActivity(next, actor, "Submitted the amendment.", ctx);
}

function decisionDue(ctx: RulesCtx): ISODate {
  return dueDate(ctx.today, ctx.cfg.sla.intakeDays, ctx.cfg);
}

/**
 * "Decide amendment" is the Clerk's to act on only once the departments have checked the
 * amendment's cards: it opens when the last one is verified and waits again if one is sent back.
 * Called after every verification, send-back and re-upload; a no-op with no amendment submitted.
 */
export function syncAmendmentDecision(c: EventCase, ctx: RulesCtx): EventCase {
  if (amendmentStage(c) !== "submitted") return c;
  const id = taskId(c.id, DECIDE);
  const task = findTask(c, id);
  if (!task || task.status === "done") return c;
  const waiting = amendmentCardsInFlight(c).length > 0;
  if (waiting && task.status !== "locked") return moveTask(c, id, "locked", ctx, "system", { dueDate: null }, "Waiting on the amendment's cards");
  if (!waiting && task.status === "locked") return moveTask(c, id, "todo", ctx, "system", { dueDate: decisionDue(ctx) });
  return c;
}

/* ---------- 3. the City Clerk decides ---------- */

export function decideAmendment(c: EventCase, action: Extract_<"decide_amendment">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkDecideAmendment(c, action.decision, action.reason);
  if (!check.ok) return check;
  const decided = moveTask(c, taskId(c.id, DECIDE), "done", ctx, actor, { payload: { decision: action.decision === "approve" ? "approved" : "declined", reason: action.reason?.trim() || undefined } });
  return { ok: true, case: action.decision === "approve" ? approve(decided, actor, ctx) : decline(decided, action.reason ?? "", actor, ctx) };
}

/** Stages a permitted case is already past: a card the amendment added that waits for one of them opens with the approval. */
const BEHIND_A_PERMIT: UnlockEvent[] = ["accepted", "routed", "quote_sent", "signed", "paid", "permitted"];

/** The day the applicant has to have signed and paid an approved amendment by: the quote's own allowance, or the event if that is sooner. */
function settleBy(c: EventCase, ctx: RulesCtx): ISODate {
  const allowance = addDaysISO(ctx.today, ctx.cfg.hold.daysAfterQuote);
  const event = eventDate(c, ctx.today);
  return event && event < allowance ? event : allowance;
}

function approve(c: EventCase, actor: Actor, ctx: RulesCtx): EventCase {
  // Before the permit the amended plan simply is the application now: its review, quote and
  // payment are still ahead and cover it. A quote already out is brought up to the new figure.
  if (!c.permit) {
    let next = c;
    const payCard = findTask(next, taskId(next.id, "pay_fees"));
    if (next.state === "quote_sent" && payCard && payCard.status !== "done") {
      next = patchTask(next, payCard.id, { payload: { ...payCard.payload, amount: Math.max(0, quoteBalance(next, ctx.cfg)) } });
    }
    return finish(appendActivity(next, actor, "Approved the amendment.", ctx), ctx);
  }

  let next = unlockCardsBehindThePermit(c, ctx);
  const balance = amendmentBalance(next, ctx.cfg);
  next = settleDifference(next, ctx);
  next = withFoodPermitsTask(syncWorkOrders(next, ctx), ctx);
  const money = balance > 0 ? ` ${fmtMoney(balance)} more is due from the applicant.` : balance < 0 ? ` Refunded ${fmtMoney(-balance)}.` : "";
  next = appendActivity(next, actor, `Approved the amendment.${money}`, ctx);
  return maybeFinishAmendment(next, ctx);
}

/** The amendment's cards that wait on a stage this case passed long ago (the quote, the permit) open now, each with its due date. */
function unlockCardsBehindThePermit(c: EventCase, ctx: RulesCtx): EventCase {
  const by = settleBy(c, ctx);
  const tasks = c.tasks.map((t) => {
    if (!t.tags.includes("amendment") || t.status !== "locked" || !t.unlocksOn || !BEHIND_A_PERMIT.includes(t.unlocksOn)) return t;
    const due = (CARD_BY_ID as Record<string, CardSpec>)[t.catalogId]?.due;
    const dueDateNow = due?.type === "after_unlock" ? dueDate(ctx.today, ctx.cfg.sla[due.sla] as number, ctx.cfg) : due?.type === "hold_expiry" ? by : t.dueDate;
    return { ...t, status: "todo" as const, unlocksOn: null, dueDate: dueDateNow, history: [...t.history, { at: nowOf(ctx), actor: "system" as const, status: "todo" as const }] };
  });
  return { ...c, tasks };
}

/**
 * What the amended plan costs beyond what was paid, on a permitted case. Less: the difference
 * goes back now (a simulated refund, as at closeout). More: the payment card opens again for it
 * and the applicant pays it at checkout, as for a quote.
 */
function settleDifference(c: EventCase, ctx: RulesCtx): EventCase {
  const balance = amendmentBalance(c, ctx.cfg);
  const payId = taskId(c.id, "pay_fees");
  const payCard = findTask(c, payId);
  if (balance < 0) {
    const next: EventCase = { ...c, payments: [...c.payments, { id: taskId(c.id, "pay", c.payments.length + 1), at: nowOf(ctx), amount: balance, method: "card", kind: "refund", amendment: true }] };
    return payCard ? patchTask(next, payId, { payload: { ...payCard.payload, amount: totalPaid(next) } }) : next;
  }
  if (balance === 0 || !payCard) return c;
  const open = { unlocksOn: null, dueDate: settleBy(c, ctx), payload: { ...payCard.payload, amount: balance } };
  return payCard.status === "todo" ? patchTask(c, payId, open) : moveTask(c, payId, "todo", ctx, "system", open);
}

/**
 * An approved amendment takes effect when the applicant owes it nothing more: no signature
 * outstanding and no balance. Called after the approval itself, after `accept_and_sign` and
 * after a payment, since any of the three can be the last.
 */
export function maybeFinishAmendment(c: EventCase, ctx: RulesCtx): EventCase {
  if (amendmentStage(c) !== "approved") return c;
  if (amendmentSignOpen(c)) return c;
  if (amendmentPayOpen(c) && amendmentBalance(c, ctx.cfg) > 0) return c;
  return finish(c, ctx);
}

function finish(c: EventCase, ctx: RulesCtx): EventCase {
  const next = dropStash({ ...c, flags: { ...c.flags, amendmentPending: false } });
  return appendActivity(next, "system", c.permit ? "The amendment is in effect: the permit covers the amended plan." : "The amendment is part of the application now.", ctx);
}

/** The plan before the amendment is no longer needed once it is in effect or declined. */
function dropStash(c: EventCase): EventCase {
  const id = taskId(c.id, SUBMIT);
  const card = findTask(c, id);
  if (!card || card.payload.pendingAmendment === undefined) return c;
  const { pendingAmendment: _dropped, ...payload } = card.payload;
  void _dropped;
  return patchTask(c, id, { payload });
}

/** Puts the record back exactly as it was before the amendment and takes the amendment's cards off the board. */
function decline(c: EventCase, reason: string, actor: Actor, ctx: RulesCtx): EventCase {
  const prior = pendingAmendment(c);
  const why = reason.trim().replace(/[.\s]+$/, "");
  const said = `Declined the amendment: ${why}. The original plan stands.`;
  if (!prior) return appendActivity({ ...c, flags: { ...c.flags, amendmentPending: false } }, actor, said, ctx);

  // A series' session paid while the amendment was pending stays paid.
  const paidNow = new Set((c.schedule?.occurrences ?? []).filter((o) => o.billing === "paid").map((o) => o.date));
  const schedule = prior.priorAnswers.schedule
    ? { ...prior.priorAnswers.schedule, occurrences: prior.priorAnswers.schedule.occurrences.map((o) => (paidNow.has(o.date) && o.billing !== "skipped" ? { ...o, billing: "paid" as const } : o)) }
    : prior.priorAnswers.schedule;

  const submitId = taskId(c.id, SUBMIT);
  // The cards the amendment added go, and so does a check a department opened on one of them.
  const added = new Set(c.tasks.filter((t) => t.tags.includes("amendment") && !(t.id === submitId && prior.priorSubmit)).map((t) => idSuffix(c, t.id)));
  const tasks = c.tasks
    .filter((t) => !added.has(idSuffix(c, t.id)) && !(t.catalogId.startsWith("verify:") && added.has(t.catalogId.slice("verify:".length))))
    .map((t): Task => {
      if (t.id !== submitId || !prior.priorSubmit) return t;
      // "Submit application" was there before the amendment borrowed it: back to how it stood.
      const { pendingAmendment: _dropped, ...payload } = t.payload;
      void _dropped;
      return { ...t, ...prior.priorSubmit, payload, history: [...t.history, { at: nowOf(ctx), actor: "system", status: prior.priorSubmit.status, note: "The amendment was declined" }] };
    });

  const next: EventCase = {
    ...c,
    ...prior.priorAnswers,
    schedule,
    tier: prior.priorTier,
    triggers: prior.priorTriggers,
    feeLines: prior.priorFeeLines,
    tasks,
    flags: { ...c.flags, lateFee: prior.priorLateFee, amendmentPending: false },
  };
  return appendActivity(next, actor, said, ctx);
}
