/**
 * Pure precondition checks, shared between the transition handlers (which apply the effect
 * once a check passes) and availableActions() (which only needs the same ok/reason). Keeping
 * them here is what makes "disabled, with the reason transition() would give" true by
 * construction instead of by convention.
 */
import { daysBetween } from "@/lib/dates";
import { fmtDate, fmtDateShort, plural } from "@/lib/format";
import { availability as availabilityRule, citywideBlackoutOn, occupiedWindow, occurrences } from "@/lib/rules";
import { CARD_BY_ID, type CardSpec } from "@/lib/rules/catalog";
import { tier as higherTier } from "@/lib/rules/shared";
import { PARTY_LABEL, STATE_LABEL, type Actor, type Availability, type Dept } from "@/lib/types";
import type { EventCase, ISODate, Task } from "@/lib/types";
import type { RulesConfig, RulesCtx } from "@/lib/rules/types";
import type { ActionType, RoutedReviewer } from "./actions";
import { sessionDates } from "./clock";
import { findTask, idSuffix, preSubmitCardsIn, quoteBalance, quotePaid, reviewFor, signoffsLeft, taskId } from "./core";
import { UNLOCK_NOTE } from "./waitingOn";

function unlockHintFor(catalogId: string): string | undefined {
  return (CARD_BY_ID as Record<string, CardSpec>)[catalogId]?.unlockHint;
}

export type CheckResult = { ok: true } | { ok: false; reason: string };

export const OK: CheckResult = { ok: true };

export function fail(reason: string): CheckResult {
  return { ok: false, reason };
}

/* ---------- who may raise each action ---------- */

const CITY: Actor[] = ["clerk", "pws", "hl"];

/**
 * The parties that may raise each action (plan 5.4). transition() checks this before anything
 * else, so a screen that dispatches as the wrong role gets a reason instead of a changed case.
 * "Simulate a sign-off" is a demo button on the block captain's own card, so the applicant may
 * press it for a neighbor.
 */
const ACTION_ACTORS: Record<ActionType, Actor[]> = {
  create_board: ["applicant"],
  book_and_pay: ["applicant"],
  complete_task: ["applicant"],
  simulate_signoff: ["neighbor", "applicant"],
  submit: ["applicant"],
  respond_to_request: ["applicant"],
  accept_and_sign: ["applicant"],
  pay: ["applicant", "clerk"],
  withdraw: ["applicant"],
  cancel: ["applicant"],
  submit_feedback: ["applicant"],
  book_again: ["applicant"],
  // The applicant proposes an amendment; the City Clerk decides a pending one with the same
  // action (see decideAmendment() in transitions/applicant.ts).
  amend: ["applicant", "clerk"],
  accept_complete: ["clerk"],
  confirm_routing: ["clerk"],
  send_to_commission: ["clerk"],
  send_quote: ["clerk"],
  deny: ["clerk"],
  issue_permit: ["clerk"],
  reconcile_close: ["clerk"],
  request_info: CITY,
  verify_document: CITY,
  reject_document: CITY,
  review_decide: CITY,
  schedule_meeting: ["clerk", "pws"],
  complete_city_task: CITY,
  log_closeout: ["pws"],
  add_note: CITY,
  remind: CITY,
  tick: ["system"],
};

/** Reads after "can": "Only the City Clerk can issue the permit." */
const ACTION_PHRASE: Record<ActionType, string> = {
  create_board: "confirm the plan",
  book_and_pay: "book and pay",
  complete_task: "complete a card",
  simulate_signoff: "add a neighbor sign-off",
  submit: "submit the application",
  respond_to_request: "respond to a request",
  accept_and_sign: "accept the conditions and sign",
  pay: "record a payment",
  withdraw: "withdraw the application",
  cancel: "cancel the event",
  submit_feedback: "send feedback",
  book_again: "book again",
  amend: "amend the application",
  accept_complete: "accept an application as complete",
  confirm_routing: "confirm the reviewers",
  send_to_commission: "send a case to commission",
  send_quote: "send the quote",
  deny: "deny an application",
  issue_permit: "issue the permit",
  reconcile_close: "reconcile and close",
  request_info: "request information",
  verify_document: "verify a document",
  reject_document: "send a document back",
  review_decide: "decide a review",
  schedule_meeting: "schedule a meeting",
  complete_city_task: "complete a city task",
  log_closeout: "log the closeout",
  add_note: "add a note",
  remind: "send a reminder",
  tick: "advance the clock",
};

const ACTOR_NAME: Record<Actor, string> = {
  applicant: "the applicant",
  clerk: "the City Clerk",
  pws: PARTY_LABEL.pws,
  hl: PARTY_LABEL.hl,
  neighbor: "a neighbor",
  system: "the system",
};

function whoPhrase(actors: Actor[]): string {
  if (CITY.every((dept) => actors.includes(dept))) return "city staff";
  return actors.map((actor) => ACTOR_NAME[actor]).join(" or ");
}

/** The parties that may raise this action, e.g. ['applicant', 'clerk'] for `pay`. */
export function actorsFor(type: ActionType): Actor[] {
  return ACTION_ACTORS[type];
}

export function checkActor(type: ActionType, actor: Actor): CheckResult {
  const allowed = ACTION_ACTORS[type];
  if (allowed.includes(actor)) return OK;
  return fail(`Only ${whoPhrase(allowed)} can ${ACTION_PHRASE[type]}.`);
}

export function requireOpen(c: EventCase): CheckResult {
  if (c.ending) return fail(`This case is ${c.ending.replace("_", " ")}.`);
  return OK;
}

export function requireState(c: EventCase, ...states: EventCase["state"][]): CheckResult {
  const open = requireOpen(c);
  if (!open.ok) return open;
  // A sentence a person can read under a disabled button: "…in Needs info", not "is needs info".
  if (!states.includes(c.state)) return fail(`Not available while the case is in ${STATE_LABEL[c.state]}.`);
  return OK;
}

/** The department whose request the applicant has still to answer, if any (the first one asked). */
function openRequestFrom(c: EventCase): Dept | undefined {
  return c.tasks.find((t) => t.request && !t.request.resolved)?.request?.from;
}

export function checkCreateBoard(c: EventCase): CheckResult {
  return requireState(c, "draft");
}

/**
 * The first session of this case that cannot be held, or null. The sessions are the ones the
 * schedule has now (occurrences()), not the list stored on the case, which an edit may have
 * left behind. Each is checked over the window the event occupies its place (setup start to
 * teardown end), which is what availability() compares against the other cases. Another case's
 * booking always blocks. A blackout blocks a single event only: a series skips the session.
 */
function slotConflict(c: EventCase, ctx: RulesCtx, blackoutBlocks: boolean): { date: string; availability: Availability } | null {
  if (!c.location || !c.schedule) return null;
  const window = occupiedWindow(c.schedule);
  const isSeries = !!c.schedule.recurrence;
  for (const { date } of occurrences(c.schedule, c.location, ctx, c.id)) {
    const result = availabilityRule(c.location, { date, start: window.start, end: window.end }, ctx, c.id);
    if (result.status === "booked" || (result.status === "blackout" && blackoutBlocks && !isSeries)) {
      return { date, availability: result };
    }
  }
  return null;
}

/** A single event's reason reads as is; a series names the session it applies to. */
function conflictReason(c: EventCase, conflict: { date: string; availability: Availability }, fallback: string): string {
  const reason = conflict.availability.reason ?? fallback;
  return c.schedule?.recurrence ? `${fmtDate(conflict.date)}: ${reason}` : reason;
}

/** The date is inside the tier's lead time, counted to the event (the first session of a series). */
export function insideLeadTime(c: EventCase, ctx: RulesCtx): boolean {
  return !!c.schedule && daysBetween(ctx.today, c.schedule.date) < ctx.cfg.leadTimeDays[c.tier];
}

/** The applicant chose the late fee and it is what gets this date through: only then is it charged. */
export function lateFeeApplies(c: EventCase, ctx: RulesCtx): boolean {
  return c.flags.lateFee && insideLeadTime(c, ctx) && daysBetween(ctx.today, c.schedule!.date) >= ctx.cfg.lateFee.minDaysBeforeEvent;
}

/**
 * The lead-time half of the date gate. The PRD's transitions table has an Instant date "at
 * least 10 days out"; the wizard's gate offers three fixes when a date is too close, and the
 * late fee (`flags.lateFee`, set through updateDraft) is the only one that lets it stand.
 */
function checkLeadTime(c: EventCase, ctx: RulesCtx): CheckResult {
  if (!insideLeadTime(c, ctx) || lateFeeApplies(c, ctx)) return OK;
  return fail(`Needs ${plural(ctx.cfg.leadTimeDays[c.tier], "day")} of notice; pick a later date or add the late fee.`);
}

export function checkBookAndPay(c: EventCase, ctx: RulesCtx): CheckResult {
  const state = requireState(c, "draft");
  if (!state.ok) return state;
  if (c.tier !== "instant") return fail("Only Instant events book and pay directly.");
  if (!c.location || !c.schedule) return fail("The event needs a place and a date first.");
  const conflict = slotConflict(c, ctx, true);
  if (conflict) return fail(conflictReason(c, conflict, "This date is not available."));
  return checkLeadTime(c, ctx);
}

export function checkSubmit(c: EventCase, ctx: RulesCtx): CheckResult {
  // A pending amendment reuses this same card and action outside Draft: "Submit amendment" is
  // "Submit application" reopened on the amendment's own pre-submit cards. The lead time was
  // already checked when the amendment was proposed (checkAmendedDate), so it is not re-checked
  // here.
  if (c.flags.amendmentPending) {
    const open = requireOpen(c);
    if (!open.ok) return open;
    const submitTask = findTask(c, taskId(c.id, "submit_application"));
    if (!submitTask || !submitTask.tags.includes("amendment")) return fail("There is nothing to submit yet.");
    if (submitTask.status === "done") return fail("The amendment is already submitted.");
    if (submitTask.status === "locked" || !preSubmitCardsIn(c)) return fail(unlockHintFor(submitTask.catalogId) ?? "Finish every card before submitting.");
    return OK;
  }
  const state = requireState(c, "draft");
  if (!state.ok) return state;
  if (c.tier === "instant") return fail("Instant events book and pay instead of submitting.");
  const submitTask = findTask(c, taskId(c.id, "submit_application"));
  if (!submitTask) return fail("There is nothing to submit yet.");
  if (submitTask.status === "done") return fail("Already submitted.");
  // The cards themselves, not only the lock: a board rebuilt after an edit can gain a card.
  if (submitTask.status === "locked" || !preSubmitCardsIn(c)) return fail(unlockHintFor(submitTask.catalogId) ?? "Finish every card before submitting.");
  return checkLeadTime(c, ctx);
}

export function checkAcceptComplete(c: EventCase, ctx: RulesCtx): CheckResult {
  // Asked for information at intake: the application comes back to Submitted when it is answered.
  if (!c.ending && c.state === "needs_info" && !c.flags.acceptedComplete && openRequestFrom(c) === "clerk") {
    return fail("Waiting on the applicant's response to your request");
  }
  const state = requireState(c, "submitted");
  if (!state.ok) return state;
  if (c.flags.acceptedComplete) return fail("Already accepted as complete.");
  const signoffs = signoffsLeft(c);
  if (signoffs > 0) return fail(`Waiting on ${plural(signoffs, "neighbor sign-off")}`);
  const openIntakeRequest = c.tasks.some((t) => t.request && !t.request.resolved && t.request.from === "clerk");
  if (openIntakeRequest) return fail("Waiting on the applicant's response to your request");
  const conflict = slotConflict(c, ctx, false);
  if (conflict) return fail(conflictReason(c, conflict, "Another case holds this space and date and was complete first"));
  return OK;
}

/**
 * `reviewers` is the list the Clerk confirms; availableActions() leaves it out, since the
 * panel has not been filled in yet. Routing nobody would move the case to In review with no
 * review to wait for, and routing a department twice would give it two reviews of one case.
 * Every reviewer needs a due date, on or after `today` (the day of routing) when that is given.
 */
export function checkConfirmRouting(c: EventCase, reviewers?: RoutedReviewer[], today?: ISODate): CheckResult {
  const state = requireState(c, "submitted");
  if (!state.ok) return state;
  if (!c.flags.acceptedComplete) return fail("Accept the application as complete first.");
  const task = findTask(c, taskId(c.id, "confirm_routing"));
  if (!task || task.status === "done") return fail("Routing is already confirmed.");
  if (reviewers) {
    if (reviewers.length === 0) return fail("Choose at least one reviewer.");
    const twice = reviewers.find((r, i) => reviewers.findIndex((other) => other.dept === r.dept) !== i);
    if (twice) return fail(`${PARTY_LABEL[twice.dept]} is on the list twice; route each department once.`);
    // The due date is the review's allowance (days from routing): none gives "Day 0 of NaN".
    const undated = reviewers.find((r) => !/^\d{4}-\d{2}-\d{2}$/.test(r.dueDate ?? ""));
    if (undated) return fail(`Give ${PARTY_LABEL[undated.dept]} a due date.`);
    const past = today ? reviewers.find((r) => r.dueDate < today) : undefined;
    if (past) return fail(`${PARTY_LABEL[past.dept]}'s due date has passed; choose today or later.`);
    // A document or form names the department that checks it. Routed without that department,
    // the card would sit "With the city" with nobody tasked (the Clerk checks its own cards
    // whether or not it is on the list, and a meeting is held, not checked).
    const routed = new Set(reviewers.map((r) => r.dept));
    const orphans = c.tasks.filter((t) => t.owner === "applicant" && (t.kind === "document" || t.kind === "form") && t.reviewer !== null && t.reviewer !== "clerk" && !routed.has(t.reviewer));
    if (orphans.length > 0) {
      const dept = orphans[0].reviewer as Dept;
      const others = orphans.filter((t) => t.reviewer === dept).length - 1;
      return fail(`Route ${PARTY_LABEL[dept]} too: it checks "${orphans[0].title}"${others > 0 ? ` and ${plural(others, "more card")}` : ""}.`);
    }
  }
  return OK;
}

/**
 * The Clerk asks at intake; a routed department asks while its own review is still open. A
 * department that has decided has nothing left to ask for: its review task is done, so an
 * answer would come back to nobody. With `taskIdArg`, the request must pin an applicant card.
 */
export function checkRequestInfo(c: EventCase, actor: string, taskIdArg?: string): CheckResult {
  const open = requireOpen(c);
  if (!open.ok) return open;
  // Intake lasts until the application is accepted: a first request moves the case to Needs
  // info, and the Clerk may still ask for something else while that one is out.
  const atIntake = actor === "clerk" && (c.state === "submitted" || (c.state === "needs_info" && c.reviews.length === 0 && !c.flags.acceptedComplete));
  if (!atIntake) {
    const review = c.state === "in_review" || c.state === "needs_info" ? c.reviews.find((r) => r.dept === actor) : undefined;
    if (!review) return fail("Can't request information in this state.");
    if (review.status !== "pending" && review.status !== "needs_info") return fail(`Review is already ${review.status.replace(/_/g, " ")}.`);
  }
  if (taskIdArg !== undefined && !c.tasks.some((t) => t.id === taskIdArg && t.owner === "applicant")) return fail("Card not found.");
  return OK;
}

export function checkRespondToRequest(c: EventCase, taskIdArg: string): CheckResult {
  const open = requireOpen(c);
  if (!open.ok) return open;
  const task = findTask(c, taskIdArg);
  if (!task) return fail("Card not found.");
  if (!task.request || task.request.resolved) return fail("No open request on this card.");
  return OK;
}

/**
 * A submitted card is accepted or sent back by the department that checks it. The department
 * that asked for it in a request can accept its own answer too (the Clerk at intake asks about
 * cards another department reviews later).
 */
export function checkVerifyOrReject(c: EventCase, taskIdArg: string, actor: Actor): CheckResult {
  const open = requireOpen(c);
  if (!open.ok) return open;
  const task = findTask(c, taskIdArg);
  if (!task || task.owner !== "applicant") return fail("Card not found.");
  if (task.status !== "submitted") return fail("This card isn't submitted.");
  if (actor !== task.reviewer && actor !== task.request?.from) {
    return fail(task.reviewer ? `${PARTY_LABEL[task.reviewer]} checks this card.` : "Nobody has to check this card.");
  }
  return OK;
}

export function checkReviewDecide(c: EventCase, dept: Dept): CheckResult {
  const open = requireOpen(c);
  if (!open.ok) return open;
  const review = reviewFor(c, dept);
  if (!review) return fail("Not routed to this department.");
  if (review.status === "needs_info") return fail("Waiting on the applicant's response.");
  if (review.status !== "pending") return fail(`Review is already ${review.status.replace(/_/g, " ")}.`);
  return OK;
}

export function checkSendQuote(c: EventCase): CheckResult {
  // In Needs info the quote waits for an answer: say whose request, not only the state.
  if (!c.ending && c.state === "needs_info") {
    const asker = openRequestFrom(c);
    return fail(asker ? `Waiting on the applicant's response to ${PARTY_LABEL[asker]}'s request.` : "Waiting on the applicant's response.");
  }
  const state = requireState(c, "in_review");
  if (!state.ok) return state;
  const denied = c.reviews.find((r) => r.status === "denied");
  if (denied) return fail(`${PARTY_LABEL[denied.dept]} denied its section.`);
  const allApproved = c.reviews.every((r) => r.status === "approved" || r.status === "approved_with_conditions");
  if (!allApproved) return fail("Waiting on every reviewer to approve.");
  return OK;
}

export function checkDeny(c: EventCase): CheckResult {
  return requireState(c, "submitted", "in_review", "needs_info");
}

export function checkAcceptAndSign(c: EventCase): CheckResult {
  return requireState(c, "quote_sent");
}

/** What a `pay` records: a quote payment, one session of a series, or a final bill. */
export interface PaymentAsk {
  kind: "booking" | "quote" | "session" | "final_invoice" | "refund";
  /** Left out by availableActions(), which asks before any amount has been entered. */
  amount?: number;
  occurrenceDate?: string;
}

/**
 * `pay` records three kinds of payment: toward a quote, for one session of a series, and for a
 * final bill, each in the state it belongs to. A booking payment and a refund are written by
 * the actions that cause them (book_and_pay; cancel, withdraw and reconcile_close), never
 * through `pay`. An ended case takes no payment at all, and neither does a quote that is already
 * paid in full (`cfg` is what the balance is worked out with; transition() always passes it).
 */
export function checkPay(c: EventCase, ask: PaymentAsk, cfg?: RulesConfig): CheckResult {
  const open = requireOpen(c);
  if (!open.ok) return open;
  if (ask.amount !== undefined && !(ask.amount > 0)) return fail("Enter an amount above $0.");
  switch (ask.kind) {
    case "quote":
      if (c.state !== "quote_sent") return fail("No quote to pay.");
      // A quote already covered has nothing left to take: no row for it, and no overpayment.
      if (cfg && quoteBalance(c, cfg) <= 0) return fail("The quote is paid in full.");
      return OK;
    case "session": {
      if (!c.schedule?.recurrence) return fail("Only a series is paid by session.");
      const occurrence = c.schedule.occurrences.find((o) => o.date === ask.occurrenceDate);
      if (!occurrence) return fail("No such session.");
      if (occurrence.billing === "skipped") return fail("That session is skipped.");
      if (occurrence.billing === "paid") return fail("That session is already paid.");
      return OK;
    }
    case "final_invoice":
      return c.state === "closeout" || c.state === "closed" ? OK : fail("There is no final bill yet.");
    default:
      return fail("That payment is recorded by the action that causes it.");
  }
}

/** The next session of a series still to be paid for (earliest first), or undefined. */
export function nextUnpaidSession(c: EventCase): string | undefined {
  if (!c.schedule?.recurrence) return undefined;
  return c.schedule.occurrences
    .filter((o) => o.billing === "upcoming" || o.billing === "due")
    .map((o) => o.date)
    .sort()[0];
}

export function checkIssuePermit(c: EventCase, ctx: RulesCtx): CheckResult {
  const state = requireState(c, "quote_sent");
  if (!state.ok) return state;
  const missing: string[] = [];
  if (!c.flags.signed) missing.push("signature (applicant)");
  if (!quotePaid(c, ctx.cfg)) missing.push("payment (applicant)");
  const insurance = findTask(c, taskId(c.id, "insurance_certificate"));
  if (insurance && insurance.status !== "done") missing.push("insurance (Health & Legal)");
  if (missing.length > 0) return fail(`Needs: ${missing.join(", ")}`);
  return OK;
}

export function checkReconcileClose(c: EventCase): CheckResult {
  const state = requireState(c, "closeout");
  if (!state.ok) return state;
  if (!c.closeout.hoursLoggedOn) return fail("Waiting on Public Works & Safety to log hours.");
  return OK;
}

export function checkLogCloseout(c: EventCase): CheckResult {
  const open = requireOpen(c);
  if (!open.ok) return open;
  // Logged once: a second log would write the estimates back over the actuals and add the
  // extra lines again. From here the case is the Clerk's to reconcile.
  if (c.closeout.hoursLoggedOn) return fail(`Hours were logged on ${fmtDate(c.closeout.hoursLoggedOn)}; the City Clerk is reconciling.`);
  if (c.state === "closeout") return OK;
  if (c.tier === "instant" && c.state === "event_day") return OK;
  return fail("Nothing to close out yet.");
}

export function checkWithdraw(c: EventCase): CheckResult {
  const open = requireOpen(c);
  if (!open.ok) return open;
  if (c.permit) return fail("A permit already exists; cancel instead.");
  return OK;
}

export function checkCancel(c: EventCase, today: string, lastSession: string | null): CheckResult {
  const open = requireOpen(c);
  if (!open.ok) return open;
  if (!c.permit) return fail("No permit to cancel.");
  if (lastSession && lastSession < today) return fail("The event has already happened.");
  return OK;
}

export function checkSubmitFeedback(c: EventCase): CheckResult {
  const state = requireState(c, "closed");
  if (!state.ok) return state;
  // Feedback is given once: a second form would overwrite the first.
  if (c.closeout.feedback) return fail("Feedback is already in. Thank you.");
  return OK;
}

export function checkBookAgain(c: EventCase): CheckResult {
  return requireState(c, "closed");
}

/**
 * `actor` defaults to "applicant" so availableActions() (outside this workstream's files), which
 * calls this with three arguments, keeps asking "can the applicant amend now". The City Clerk's
 * decision on an already-pending amendment is the same action, so it is checked here too: the
 * applicant may not start a second one while the first is pending, and the Clerk may only decide
 * one the applicant has actually submitted (decideAmendment() in transitions/applicant.ts).
 */
export function checkAmend(c: EventCase, today: string, eventDate: string | null, actor: Actor = "applicant"): CheckResult {
  const open = requireOpen(c);
  if (!open.ok) return open;
  if (c.state === "draft") return fail("Confirm the plan and submit before amending.");
  if (c.state === "closed") return fail("This case is already closed.");
  if (eventDate && eventDate < today) return fail("The event has already happened.");
  if (actor === "clerk") {
    if (!c.flags.amendmentPending) return fail("There is no amendment pending.");
    const submitTask = findTask(c, taskId(c.id, "submit_application"));
    if (!submitTask || !submitTask.tags.includes("amendment") || submitTask.status !== "done") {
      return fail("The applicant has not submitted the amendment yet.");
    }
    return OK;
  }
  if (c.flags.amendmentPending) return fail("An amendment is already pending; wait for the City Clerk's decision.");
  return OK;
}

/**
 * An amendment needs the tier's notice again when it raises the tier or moves the date. One
 * that does neither (five more guests, a new description) changes nothing the lead time
 * protects, so it is not refused for being made close to the day.
 */
export function amendmentNeedsNotice(before: EventCase, amended: EventCase): boolean {
  const tierRose = before.tier !== amended.tier && higherTier(before.tier, amended.tier) === amended.tier;
  return tierRose || before.schedule?.date !== amended.schedule?.date;
}

/**
 * The date gate, run again on the amended plan (PRD, Amend): the place must still be free for
 * every session, and an amendment that needs notice must meet the new tier's lead time or
 * carry the late fee. `amended` is the case with its new answers, tier and `flags.lateFee`.
 */
export function checkAmendedDate(before: EventCase, amended: EventCase, ctx: RulesCtx): CheckResult {
  const conflict = slotConflict(amended, ctx, true);
  if (conflict) return fail(conflictReason(amended, conflict, "This date is not available."));
  return amendmentNeedsNotice(before, amended) ? checkLeadTime(amended, ctx) : OK;
}

export function checkSendToCommission(c: EventCase): CheckResult {
  const state = requireState(c, "in_review", "needs_info");
  if (!state.ok) return state;
  if (c.flags.sentToCommission) return fail("Already sent to commission.");
  return OK;
}

/**
 * The meeting card a schedule_meeting acts on. The Clerk's own "Schedule the pre-application
 * meeting" task stands for the applicant's meeting card: My queue opens the Clerk's task, and
 * the date belongs on the card the applicant sees.
 */
export function meetingCardFor(c: EventCase, taskIdArg: string): Task | undefined {
  const task = findTask(c, taskIdArg);
  if (task?.catalogId === "schedule_pre_application_meeting") return findTask(c, taskId(c.id, "pre_application_meeting"));
  return task;
}

/** A meeting is scheduled and closed by the department that holds it, or by the Clerk, who owns every case. */
function meetingHosts(task: Task): Actor[] {
  return task.reviewer && task.reviewer !== "clerk" ? [task.reviewer, "clerk"] : ["clerk"];
}

/** The session a meeting has to come before: the next one still ahead, or the last one once all have passed. */
function sessionToMeetBefore(c: EventCase, today: ISODate): ISODate | null {
  const dates = sessionDates(c);
  if (dates.length === 0) return null;
  const ahead = dates.filter((d) => d >= today).sort();
  return ahead[0] ?? dates.reduce((a, b) => (a > b ? a : b));
}

/**
 * `when` is the day being asked about: availableActions() and a panel that has no date yet
 * leave it out, and get only who may schedule and whether the meeting is still open. With it,
 * the day must be today or later, before the event, and not a citywide blackout: a walkthrough
 * after the race, or a coordination meeting on Memorial Day, is refused here for every caller,
 * not only by the panel that offers the date field.
 */
export function checkScheduleMeeting(c: EventCase, taskIdArg: string, actor: Actor, when?: { date: ISODate; today: ISODate }): CheckResult {
  const open = requireOpen(c);
  if (!open.ok) return open;
  const task = meetingCardFor(c, taskIdArg);
  if (!task) return fail("Card not found.");
  if (task.kind !== "meeting") return fail("That card isn't a meeting.");
  const hosts = meetingHosts(task);
  if (!hosts.includes(actor)) return fail(`Only ${whoPhrase(hosts)} can schedule this meeting.`);
  if (task.status === "done") return fail("That meeting has already been held.");
  if (when) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(when.date ?? "")) return fail("Choose a date.");
    if (when.date < when.today) return fail("Choose today or a later date.");
    const event = sessionToMeetBefore(c, when.today);
    if (event && when.date >= event) return fail(`Choose a date before ${fmtDate(event)}.`);
    if (citywideBlackoutOn(when.date)) return fail("That date is a citywide blackout.");
  }
  return OK;
}

/**
 * City tasks that are finished by an action of their own. Marking one done by hand would skip
 * what that action does (the hold, the reviews, the permit), so complete_city_task refuses and
 * says which action to take.
 */
function ownActionFor(catalogId: string): string | undefined {
  if (catalogId.startsWith("review:")) return "Decide the review";
  const actions: Record<string, string> = {
    intake_check: "Accept the application as complete",
    confirm_routing: "Confirm the reviewers",
    schedule_pre_application_meeting: "Schedule the meeting",
    consolidate: "Send the quote, or deny the application,",
    issue_permit: "Issue the permit",
    reconcile: "Reconcile and close",
    instant_exception: "Reconcile and close",
    cleanup_inspection: "Log the closeout",
    log_actual_hours: "Log the closeout",
  };
  return actions[catalogId];
}

/**
 * complete_city_task closes a work order, a meeting that was held, or a re-review with no
 * change. Nothing else: an applicant's card is the applicant's to finish, a department's task
 * is its own, and a task with its own action is finished by that action.
 *
 * A locked task says what unlocks it, in the words Who's up uses for city staff. With `today`
 * (transition() always passes it; a button asks with the day it is shown on), a meeting set for
 * a later day is refused: it cannot have been held yet.
 */
export function checkCompleteCityTask(c: EventCase, taskIdArg: string, actor: Actor, today?: ISODate): CheckResult {
  const open = requireOpen(c);
  if (!open.ok) return open;
  const task = findTask(c, taskIdArg);
  if (!task) return fail("Card not found.");
  if (task.owner === "applicant") {
    if (task.kind !== "meeting") return fail("That card is the applicant's to finish.");
    const hosts = meetingHosts(task);
    if (!hosts.includes(actor)) return fail(`Only ${whoPhrase(hosts)} can close this meeting.`);
  } else {
    if (task.owner !== actor) return fail(`That task belongs to ${PARTY_LABEL[task.owner]}.`);
    const ownAction = ownActionFor(task.catalogId);
    if (ownAction) return fail(`${ownAction} to finish this task.`);
  }
  if (task.status === "locked") return fail((task.unlocksOn ? UNLOCK_NOTE[task.unlocksOn] : undefined) ?? "That card is locked.");
  if (task.status === "done") return fail("Already done.");
  const scheduledFor = task.kind === "meeting" ? task.payload.scheduledFor : undefined;
  if (today && scheduledFor && scheduledFor > today) return fail(`Scheduled for ${fmtDateShort(scheduledFor)}; mark it held on or after that day.`);
  return OK;
}

/** The applicant card a `verify:<card suffix>` task checks, while it still waits for that check. */
export function cardUnderVerification(c: EventCase, verifyTask: Task): Task | undefined {
  if (!verifyTask.catalogId.startsWith("verify:")) return undefined;
  const card = findTask(c, taskId(c.id, idSuffix(c, verifyTask.id).slice("verify:".length)));
  return card?.status === "submitted" ? card : undefined;
}

/**
 * Applicant cards that are finished by an action of their own, or by somebody else. Marking one
 * done by hand would skip what that action does (the payment, the signature, the sign-offs, the
 * answer to a reviewer), so complete_task refuses and says what finishes the card instead.
 */
function ownCardActionFor(c: EventCase, task: Task): string | undefined {
  if (task.request && !task.request.resolved) return "Respond to the request to finish this card.";
  if (task.kind === "meeting") return "The city closes this card once the meeting has been held.";
  const actions: Record<string, string> = {
    pay_fees: c.tier === "instant" && c.state === "draft" ? "Pay and book to finish this card." : "Pay the fees and deposit to finish this card.",
    final_bill_or_refund: "Pay the final bill to finish this card.",
    accept_and_sign: "Accept the conditions and sign to finish this card.",
    neighbor_signoff: "Collect the neighbor sign-offs to finish this card.",
    submit_application: "Submit the application to finish this card.",
    feedback: "Send your feedback to finish this card.",
    book_again: "Book again to finish this card.",
    carry_permit: "This card is finished for you once the event day has passed.",
  };
  return actions[task.catalogId];
}

export function checkCompleteTask(c: EventCase, taskIdArg: string): CheckResult {
  const open = requireOpen(c);
  if (!open.ok) return open;
  const task = findTask(c, taskIdArg);
  if (!task) return fail("Card not found.");
  if (task.owner !== "applicant") return fail(`That task belongs to ${PARTY_LABEL[task.owner]}.`);
  if (task.status === "locked") return fail(unlockHintFor(task.catalogId) ?? "This card is locked.");
  if (task.status === "submitted") return fail("This card is already submitted.");
  if (task.status === "done") {
    const canRedo = task.kind === "document" && c.state !== "permitted" && c.state !== "event_day" && c.state !== "closeout" && c.state !== "closed";
    if (!canRedo) return fail("This card is already done.");
  }
  const ownAction = ownCardActionFor(c, task);
  if (ownAction) return fail(ownAction);
  return OK;
}

export function checkSimulateSignoff(c: EventCase, taskIdArg: string): CheckResult {
  const open = requireOpen(c);
  if (!open.ok) return open;
  const task = findTask(c, taskIdArg);
  if (!task) return fail("There is no neighbor sign-off card on this case.");
  const progress = task.payload.progress as { done: number; total: number } | undefined;
  if (progress && progress.done >= progress.total) return fail("All neighbors have already signed off.");
  return OK;
}
