/**
 * Pure precondition checks, shared between the transition handlers (which apply the effect
 * once a check passes) and availableActions() (which only needs the same ok/reason). Keeping
 * them here is what makes "disabled, with the reason transition() would give" true by
 * construction instead of by convention.
 */
import { daysBetween } from "@/lib/dates";
import { fmtDate, plural } from "@/lib/format";
import { availability as availabilityRule, occupiedWindow, occurrences } from "@/lib/rules";
import { CARD_BY_ID, type CardSpec } from "@/lib/rules/catalog";
import { PARTY_LABEL, type Availability, type Dept } from "@/lib/types";
import type { EventCase } from "@/lib/types";
import type { RulesCtx } from "@/lib/rules/types";
import { findTask, preSubmitCardsIn, quotePaid, reviewFor, signoffsLeft, taskId } from "./core";

function unlockHintFor(catalogId: string): string | undefined {
  return (CARD_BY_ID as Record<string, CardSpec>)[catalogId]?.unlockHint;
}

export type CheckResult = { ok: true } | { ok: false; reason: string };

export const OK: CheckResult = { ok: true };

export function fail(reason: string): CheckResult {
  return { ok: false, reason };
}

export function requireOpen(c: EventCase): CheckResult {
  if (c.ending) return fail(`This case is ${c.ending.replace("_", " ")}.`);
  return OK;
}

export function requireState(c: EventCase, ...states: EventCase["state"][]): CheckResult {
  const open = requireOpen(c);
  if (!open.ok) return open;
  if (!states.includes(c.state)) return fail(`This case is ${c.state.replace("_", " ")}.`);
  return OK;
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

export function checkConfirmRouting(c: EventCase): CheckResult {
  const state = requireState(c, "submitted");
  if (!state.ok) return state;
  if (!c.flags.acceptedComplete) return fail("Accept the application as complete first.");
  const task = findTask(c, taskId(c.id, "confirm_routing"));
  if (!task || task.status === "done") return fail("Routing is already confirmed.");
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
  const atIntake = c.state === "submitted" && actor === "clerk";
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

export function checkVerifyOrReject(c: EventCase, taskIdArg: string): CheckResult {
  const open = requireOpen(c);
  if (!open.ok) return open;
  const task = findTask(c, taskIdArg);
  if (!task) return fail("Card not found.");
  if (task.status !== "submitted") return fail("This card isn't submitted.");
  return OK;
}

export function checkReviewDecide(c: EventCase, dept: Dept): CheckResult {
  const open = requireOpen(c);
  if (!open.ok) return open;
  const review = reviewFor(c, dept);
  if (!review) return fail("Not routed to this department.");
  if (review.status === "needs_info") return fail("Waiting on the applicant's response.");
  if (review.status !== "pending") return fail(`Review is already ${review.status.replace("_", " ")}.`);
  return OK;
}

export function checkSendQuote(c: EventCase): CheckResult {
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

export function checkPayQuote(c: EventCase): CheckResult {
  return requireState(c, "quote_sent");
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
  return requireState(c, "closed");
}

export function checkBookAgain(c: EventCase): CheckResult {
  return requireState(c, "closed");
}

export function checkAmend(c: EventCase, today: string, eventDate: string | null): CheckResult {
  const open = requireOpen(c);
  if (!open.ok) return open;
  if (c.state === "draft") return fail("Confirm the plan and submit before amending.");
  if (c.state === "closed") return fail("This case is already closed.");
  if (eventDate && eventDate < today) return fail("The event has already happened.");
  return OK;
}

export function checkSendToCommission(c: EventCase): CheckResult {
  return requireState(c, "in_review", "needs_info");
}

export function checkScheduleMeeting(c: EventCase, taskIdArg: string): CheckResult {
  const open = requireOpen(c);
  if (!open.ok) return open;
  const task = findTask(c, taskIdArg);
  if (!task) return fail("Card not found.");
  if (task.kind !== "meeting") return fail("That card isn't a meeting.");
  return OK;
}

export function checkCompleteCityTask(c: EventCase, taskIdArg: string): CheckResult {
  const open = requireOpen(c);
  if (!open.ok) return open;
  const task = findTask(c, taskIdArg);
  if (!task) return fail("Card not found.");
  if (task.status === "locked") return fail("That card is locked.");
  if (task.status === "done") return fail("Already done.");
  return OK;
}

export function checkCompleteTask(c: EventCase, taskIdArg: string): CheckResult {
  const open = requireOpen(c);
  if (!open.ok) return open;
  const task = findTask(c, taskIdArg);
  if (!task) return fail("Card not found.");
  if (task.status === "locked") return fail(unlockHintFor(task.catalogId) ?? "This card is locked.");
  if (task.status === "submitted") return fail("This card is already submitted.");
  if (task.status === "done") {
    const canRedo = task.kind === "document" && c.state !== "permitted" && c.state !== "event_day" && c.state !== "closeout" && c.state !== "closed";
    if (!canRedo) return fail("This card is already done.");
  }
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
