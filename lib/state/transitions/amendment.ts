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
 *
 * An amendment that is still pending when the event arrives never took effect: it lapses
 * (`lapseAmendment`, called by the clock), and the event is held under the plan the permit covers.
 */
import { addDaysISO } from "@/lib/dates";
import { fmtMoney } from "@/lib/format";
import { classify, dueDate, estimateFees, requirements } from "@/lib/rules";
import { CARD_BY_ID, CITY_TASKS, type CardSpec } from "@/lib/rules/catalog";
import { tierSummary } from "@/lib/rules/classify";
import type { Classification, FeeEstimate, RulesCtx } from "@/lib/rules/types";
import type { Actor, EventAnswers, EventCase, ISODate, Task, UnlockEvent } from "@/lib/types";
import type { Action } from "../actions";
import { AMENDMENT_SUBMIT_CARD, amendmentBalance, amendmentCardsInFlight, amendmentPayOpen, amendmentSignOpen, amendmentStage, pendingAmendment, type PendingAmendment } from "../amendment";
import { amendmentNeedsNotice, checkAmend, checkAmendedDate, checkDecideAmendment, lateFeeApplies } from "../checks";
import { withSessions } from "../newCase";
import { addTask, appendActivity, findTask, idSuffix, moveTask, newTask, nowOf, patchTask, preSubmitCardsIn, quoteBalance, taskId, totalPaid } from "../core";
import { eventDate } from "../selectors";
import type { TransitionResult } from "../types";
import { syncWorkOrders, withFoodPermitsTask } from "./shared";

type Extract_<T extends Action["type"]> = Extract<Action, { type: T }>;

const SUBMIT = "submit_application";
const DECIDE = "decide_amendment";
/** Why the payment card is open again on a permitted event. `pay` puts the card's own reason back when the balance is paid. */
const AMENDMENT_BALANCE_WHY = "What your change adds, beyond what you have paid";

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

/** A record with an amendment's answers on it, before anything is checked, tagged or settled. */
export interface AmendedPlan {
  /** The record with the new answers, sessions, tier, triggers and fee lines; its cards are still the old ones. */
  record: EventCase;
  cls: Classification;
  /** The new plan's own estimate, with the late fee when this amendment is charged one. */
  estimate: FeeEstimate;
  /** "This is a Standard event: about 3 weeks, $518.75 with the $53.75 late fee": the tier's line, for the estimate as charged. */
  summary: string;
  /** The cards the new plan calls for that the record does not have yet. */
  newCards: Task[];
}

/**
 * What the record becomes under new answers: `amend` starts from this, and the amendment
 * wizard's panel prices its diff from the same record (lib/view/amend.ts), so the difference it
 * shows is the one `amend` then settles. `lateFeeChosen` is the applicant's choice at the date
 * gate; the fee is charged only when the amendment needs notice it does not have.
 */
export function amendedPlan(c: EventCase, answers: EventAnswers, lateFeeChosen: boolean, ctx: RulesCtx): AmendedPlan {
  // Sessions first, as for a Draft: the new schedule's sessions come from the rules engine. Which
  // of them are paid (or due today) is the record's to say, whatever list came with the answers:
  // the wizard empties it whenever the hours or the date are edited.
  const schedule = answers.schedule && c.schedule ? { ...answers.schedule, occurrences: c.schedule.occurrences } : answers.schedule;
  const withAnswers = withSessions({ ...c, ...answersOf(answers), schedule, flags: { ...c.flags, lateFee: lateFeeChosen } }, ctx);
  const cls = classify(withAnswers, ctx.cfg);
  const amended: EventCase = { ...withAnswers, tier: cls.tier, triggers: cls.triggers };
  // The late fee is for notice the amendment needed and did not have, nothing else.
  const lateFee = amendmentNeedsNotice(c, amended) && lateFeeApplies(amended, ctx);
  const estimate = estimateFees(amended, cls, ctx.cfg, { caseId: c.id, lateFee });
  const newCards = requirements(amended, cls, { caseId: c.id, today: ctx.today, cfg: ctx.cfg }).filter((t) => !c.tasks.some((existing) => existing.id === t.id));
  const lateFeeLine = estimate.lines.find((line) => line.kind === "late_fee");
  const summary = lateFeeLine ? tierSummary(cls.tier, estimate.total, lateFeeLine.estimate) : cls.summary;
  return { record: { ...amended, feeLines: amendedFeeLines(c, estimate, ctx) }, cls, estimate, summary, newCards };
}

export function amend(c: EventCase, action: Extract_<"amend">, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkAmend(c, ctx.today, eventDate(c, ctx.today));
  if (!check.ok) return check;

  const { record: amended, summary, newCards: fresh } = amendedPlan(c, action.answers, !!action.lateFee, ctx);

  const gate = checkAmendedDate(c, amended, ctx);
  if (!gate.ok) return gate;

  // A new card is dated from the amendment: it has been the applicant's since now, not since the
  // original application went in.
  const newCards = fresh.map((t) => ({ ...t, tags: ["amendment" as const], history: [{ at: nowOf(ctx), actor, status: t.status }] }));

  // Nothing new is required of anybody (a later time the same day, a smaller crowd), or the
  // change lowers the tier: there is nothing to send the City Clerk, so it takes effect at once.
  const material = newCards.length > 0;

  let next: EventCase = {
    ...amended,
    tasks: [...c.tasks, ...newCards],
    flags: { ...amended.flags, amendmentPending: material },
  };

  if (material) {
    next = reopenSubmitCard(next, c, ctx);
  } else if (next.permit) {
    // In effect now: what it costs more or less is settled, and the work orders follow the plan.
    next = syncWorkOrders(settleDifference(next, ctx), ctx);
  }
  // Before the permit nothing is settled, but a quote already out asks for the fee lines as
  // they now are, pending or not: its card says the figure checkout takes.
  if (!next.permit) next = requote(next, ctx);

  next = appendActivity(next, actor, `Amended the plan: ${summary}.`, ctx);
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
  const pay = findTask(before, taskId(before.id, "pay_fees"));
  const stash: PendingAmendment = {
    priorAnswers: answersOf(before),
    priorTier: before.tier,
    priorTriggers: before.triggers,
    priorLateFee: before.flags.lateFee,
    priorFeeLines: before.feeLines,
    priorSubmit: was ? { status: was.status, unlocksOn: was.unlocksOn, tags: was.tags, title: was.title, why: was.why } : null,
    // Only a permitted case has its payment card opened again by an approval; before the permit the card is still the quote's.
    priorPay: before.permit && pay ? { status: pay.status, title: pay.title, why: pay.why, dueDate: pay.dueDate, unlocksOn: pay.unlocksOn, payload: pay.payload } : null,
    proposedOn: ctx.today,
  };
  const ready = preSubmitCardsIn(next);
  const status: "todo" | "locked" = ready ? "todo" : "locked";
  const payload = { ...card.payload, pendingAmendment: stash };
  // Named for what it sends while it is the amendment's: "Submit amendment", as its sheet's button says.
  const asAmendment = { ...AMENDMENT_SUBMIT_CARD, tags: ["amendment" as const], payload };
  return card.status === status ? patchTask(next, id, asAmendment) : moveTask(next, id, status, ctx, "system", { ...asAmendment, unlocksOn: ready ? null : "presubmit_done" });
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
  if (!c.permit) return finish(appendActivity(requote(c, ctx), actor, "Approved the amendment.", ctx), ctx);

  let next = unlockCardsBehindThePermit(c, ctx);
  const balance = amendmentBalance(next, ctx.cfg);
  next = settleDifference(next, ctx);
  next = withFoodPermitsTask(syncWorkOrders(next, ctx), ctx);
  const money = balance > 0 ? ` ${fmtMoney(balance)} more is due from the applicant.` : balance < 0 ? ` Refunded ${fmtMoney(-balance)}.` : "";
  next = appendActivity(next, actor, `Approved the amendment.${money}`, ctx);
  return maybeFinishAmendment(next, ctx);
}

/**
 * A quote that is out follows the plan it is for: its payment card asks for what is still owed
 * on the amended fee lines, the figure checkout takes. Nothing to do before the quote is sent
 * (the card is still locked) or once it is paid.
 */
function requote(c: EventCase, ctx: RulesCtx): EventCase {
  const payCard = findTask(c, taskId(c.id, "pay_fees"));
  if (c.state !== "quote_sent" || !payCard || payCard.status === "done") return c;
  return patchTask(c, payCard.id, { payload: { ...payCard.payload, amount: Math.max(0, quoteBalance(c, ctx.cfg)) } });
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
  // No longer the booking's card ("Pay and book: payment holds your date") on an event that is
  // booked and permitted: it is the payment card of a plan with a balance, and says what for.
  const open = { title: CARD_BY_ID.pay_fees.title, why: AMENDMENT_BALANCE_WHY, unlocksOn: null, dueDate: settleBy(c, ctx), payload: { ...payCard.payload, amount: balance } };
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

/**
 * The plan before the amendment is no longer needed once it is in effect. A "Submit application"
 * card the amendment borrowed is the application's again, under its own name.
 */
function dropStash(c: EventCase): EventCase {
  const id = taskId(c.id, SUBMIT);
  const card = findTask(c, id);
  if (!card || card.payload.pendingAmendment === undefined) return c;
  const { pendingAmendment: stash, ...payload } = card.payload;
  const own = (stash as PendingAmendment).priorSubmit;
  return patchTask(c, id, { payload, title: own?.title ?? card.title, why: own?.why ?? card.why });
}

/** Puts the record back exactly as it was before the amendment and takes the amendment's cards off the board. */
function decline(c: EventCase, reason: string, actor: Actor, ctx: RulesCtx): EventCase {
  const prior = pendingAmendment(c);
  const why = reason.trim().replace(/[.\s]+$/, "");
  const said = `Declined the amendment: ${why}. The original plan stands.`;
  if (!prior) return appendActivity({ ...c, flags: { ...c.flags, amendmentPending: false } }, actor, said, ctx);
  // The fee lines are the original plan's again, and so is what a quote that is out asks for.
  return appendActivity(requote(restorePlan(c, prior, "The amendment was declined", ctx), ctx), actor, said, ctx);
}

/**
 * The record with the answers, tier, triggers and fee lines it had before the amendment, and
 * without the cards the amendment added: what a decline and a lapse both come to. `note` says
 * which it was, on the card that is put back.
 */
function restorePlan(c: EventCase, prior: PendingAmendment, note: string, ctx: RulesCtx): EventCase {
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
    // Health & Legal's "Issue food permits" came with the card an approval opened; it goes with it unless it is done.
    .filter((t) => !(t.catalogId === "issue_food_permits" && t.status !== "done" && added.has("vendor_food_permits")))
    .map((t): Task => {
      if (t.id !== submitId || !prior.priorSubmit) return t;
      // "Submit application" was there before the amendment borrowed it: back to how it stood.
      const { pendingAmendment: _dropped, ...payload } = t.payload;
      void _dropped;
      return { ...t, ...prior.priorSubmit, payload, history: [...t.history, { at: nowOf(ctx), actor: "system", status: prior.priorSubmit.status, note }] };
    });

  return {
    ...c,
    ...prior.priorAnswers,
    schedule,
    tier: prior.priorTier,
    triggers: prior.priorTriggers,
    feeLines: prior.priorFeeLines,
    tasks,
    // A signature given on the amendment's own card goes with the card.
    flags: { ...c.flags, lateFee: prior.priorLateFee, signed: c.flags.signed && !added.has("accept_and_sign"), amendmentPending: false },
  };
}

/* ---------- the event arrives first ---------- */

const LAPSED = "The amendment lapsed";

/**
 * The event arrived with the amendment still pending: never submitted, never decided, or
 * approved and not yet signed and paid. It never took effect, so the event is held under the
 * plan the permit covers. The record goes back as a decline puts it back, and what an approval
 * had already moved goes back with it: the payment card, the work orders, and anything paid
 * toward the amendment, which is refunded. Called by the clock (`applyTick`); a no-op when no
 * amendment is pending.
 */
export function lapseAmendment(c: EventCase, ctx: RulesCtx): EventCase {
  if (!c.flags.amendmentPending) return c;
  const prior = pendingAmendment(c);
  let next: EventCase = prior ? restorePlan(c, prior, LAPSED, ctx) : { ...c, flags: { ...c.flags, amendmentPending: false } };

  // The Clerk has nothing left to decide: the task leaves the queue and stays on the file.
  const decide = findTask(next, taskId(next.id, DECIDE));
  if (decide && decide.status !== "done") next = moveTask(next, decide.id, "done", ctx, "system", { dueDate: null, payload: { decision: "lapsed" } }, LAPSED);

  // The payment card as it stood before an approval opened it for the difference.
  const payId = taskId(next.id, "pay_fees");
  const pay = findTask(next, payId);
  const was = prior?.priorPay;
  if (pay && was && (pay.status !== was.status || pay.title !== was.title || pay.payload.amount !== was.payload.amount)) {
    next = pay.status === was.status ? patchTask(next, payId, was) : moveTask(next, payId, was.status, ctx, "system", was, LAPSED);
  }
  // What was paid toward the amendment goes back, and the card says what the plan that stands asks for.
  const refunded = Math.max(0, -amendmentBalance(next, ctx.cfg));
  next = settleDifference(next, ctx);
  const open = findTask(next, payId);
  if (open?.status === "todo" && amendmentBalance(next, ctx.cfg) <= 0) next = moveTask(next, payId, "done", ctx, "system", { payload: { ...open.payload, amount: totalPaid(next) } }, LAPSED);

  next = syncWorkOrders(next, ctx);
  const money = refunded > 0 ? ` Refunded ${fmtMoney(refunded)} paid toward it.` : "";
  return appendActivity(next, "system", `${LAPSED}: it was not in effect by the event, which goes ahead under the original plan.${money}`, ctx);
}
