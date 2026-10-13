/**
 * Pure view-model for the checkout screen (`/events/[id]/quote`): which of the four modes a
 * case and the URL select, the plan summary shown as a receipt, and the money figures each
 * mode needs. No React, no store: the screen reads what it needs from useDemo and lib/rules
 * and calls these with it. Tested against the real seed in checkout.test.ts.
 *
 * Owned by workstream 3D (components/checkout, app/events/[id]/quote, app/events/[id]/permit,
 * app/verify/[id]).
 */
import { format } from "date-fns";
import { toDate } from "@/lib/dates";
import { fmtDate, fmtMoney, fmtTimeRange, plural } from "@/lib/format";
import { classify, estimateFees, type FeeEstimate, type RulesConfig, type RulesCtx } from "@/lib/rules";
import { caseTotals, dueAtQuote, hasActivePermit, lateFeeApplies, quoteBalance, quotePaid } from "@/lib/state";
import { ENDING_LABEL, type Condition, type EventCase, type ISODate } from "@/lib/types";
import { routes } from "@/lib/routes";

export interface CheckoutSearch {
  pay?: "session" | "final";
  date?: string;
}

export interface NotReadyInfo {
  message: string;
  href: string;
  label: string;
}

export type CheckoutDecision =
  | { mode: "booking" }
  | { mode: "quote" }
  | { mode: "session"; occurrenceDate: ISODate }
  | { mode: "final" }
  | { mode: "not_ready"; info: NotReadyInfo };

function endedInfo(c: EventCase): NotReadyInfo {
  return {
    message: `This case is ${ENDING_LABEL[c.ending as keyof typeof ENDING_LABEL].toLowerCase()}, so there's nothing to pay.`,
    href: routes.event(c.id),
    label: "Back to your board",
  };
}

/** The reason and link shown off the booking/quote path: an unknown mode or state for this URL. */
function generalNotReadyInfo(c: EventCase): NotReadyInfo {
  if (c.ending) return endedInfo(c);
  if (hasActivePermit(c)) {
    return { message: "This event already has its permit.", href: routes.permit(c.id), label: "View your permit" };
  }
  switch (c.state) {
    case "draft":
      return c.tier === "instant"
        ? { message: "This plan isn't ready to book yet.", href: routes.event(c.id), label: "Back to your board" }
        : {
            message: "Finish the wizard before you can pay.",
            href: routes.apply({ caseId: c.id, step: c.wizardStep }),
            label: "Back to the wizard",
          };
    case "submitted":
    case "in_review":
    case "needs_info":
      return {
        message: "Your quote isn't ready yet. It appears here once the City Clerk sends it.",
        href: routes.event(c.id),
        label: "Back to your board",
      };
    case "quote_sent":
      // Only reached with an invalid ?pay=session or ?pay=final on a quote not yet paid.
      return { message: "Accept and pay your quote first.", href: routes.quote(c.id), label: "Go to your quote" };
    case "closeout":
      return {
        message: "The final bill isn't ready yet; it appears once the city reconciles the costs.",
        href: routes.event(c.id),
        label: "Back to your board",
      };
    case "closed":
      return { message: "This event is closed, with nothing more to pay.", href: routes.event(c.id), label: "Back to your board" };
    default:
      return { message: "There's nothing to pay right now.", href: routes.event(c.id), label: "Back to your board" };
  }
}

function sessionNotReadyInfo(c: EventCase): NotReadyInfo {
  if (c.ending) return endedInfo(c);
  return { message: "There's no session due to pay right now.", href: routes.event(c.id), label: "Back to your board" };
}

function finalNotReadyInfo(c: EventCase): NotReadyInfo {
  if (c.ending) return endedInfo(c);
  return { message: "There's no final bill to pay right now.", href: routes.event(c.id), label: "Back to your board" };
}

/** The session matching `date` this case still owes for: due or upcoming, never skipped or already paid. */
function duePaySessionDate(c: EventCase, date: string | undefined): ISODate | null {
  if (!date || !c.schedule?.recurrence) return null;
  const occurrence = c.schedule.occurrences.find((o) => o.date === date);
  return occurrence && (occurrence.billing === "due" || occurrence.billing === "upcoming") ? occurrence.date : null;
}

/**
 * Which of the four checkout modes the case and the URL select (plan 3D): `?pay=session&date=`
 * pays one series session, `?pay=final` pays the closeout bill, an Instant Draft books and
 * pays, and a case in Quote sent accepts, signs and pays. Everything else explains where the
 * case stands and where to go instead; the screen never offers a payment this rules out.
 */
export function checkoutDecision(c: EventCase, search: CheckoutSearch): CheckoutDecision {
  if (search.pay === "final") {
    if (!c.ending && (c.state === "closeout" || c.state === "closed") && caseHasFinalBillDue(c)) {
      return { mode: "final" };
    }
    return { mode: "not_ready", info: finalNotReadyInfo(c) };
  }
  if (search.pay === "session") {
    const occurrenceDate = duePaySessionDate(c, search.date);
    if (occurrenceDate && !c.ending && (c.state === "permitted" || c.state === "event_day")) {
      return { mode: "session", occurrenceDate };
    }
    return { mode: "not_ready", info: sessionNotReadyInfo(c) };
  }
  if (!c.ending && c.tier === "instant" && c.state === "draft") return { mode: "booking" };
  if (!c.ending && c.state === "quote_sent") return { mode: "quote" };
  return { mode: "not_ready", info: generalNotReadyInfo(c) };
}

/**
 * Whether the checkout takes a payment for this session: the rule the board's session schedule
 * reads before it offers "Pay this session", so its link never lands on "nothing to pay".
 */
export function canPaySession(c: EventCase, date: ISODate): boolean {
  return checkoutDecision(c, { pay: "session", date }).mode === "session";
}

/** Whether a closed or closeout case still owes a final bill. */
function caseHasFinalBillDue(c: EventCase): boolean {
  return caseTotals(c).due > 0;
}

export interface PlanSummary {
  name: string;
  placeLabel: string;
  isSeries: boolean;
  /** Sessions actually held: a series session skipped for a blackout does not count. */
  sessionsCount: number;
  /** "Sat, Jun 18, 2027, 6 to 9 pm", or "Sundays, 8 to 9 am · 13 sessions starting Jun 6, 2027" for a series. */
  whenLabel: string;
  attendance: number | null;
}

/** The plan summary shown on both the booking and quote screens. */
export function planSummary(c: EventCase): PlanSummary {
  const sched = c.schedule;
  const isSeries = !!sched?.recurrence;
  const sessionsCount = sched ? Math.max(1, sched.occurrences.filter((o) => o.billing !== "skipped").length) : 1;
  let whenLabel = "No date chosen yet";
  if (sched) {
    const timeRange = fmtTimeRange(sched.start, sched.end);
    whenLabel = isSeries
      ? `${format(toDate(sched.date), "EEEE")}s, ${timeRange} · ${plural(sessionsCount, "session")} starting ${fmtDate(sched.date)}`
      : `${fmtDate(sched.date)}, ${timeRange}`;
  }
  return {
    name: c.name,
    placeLabel: c.location?.label ?? "No place chosen yet",
    isSeries,
    sessionsCount,
    whenLabel,
    attendance: c.attendance,
  };
}

/** The fee estimate a BOOKING screen previews, built the same way book_and_pay will build it. */
export function bookingEstimate(c: EventCase, ctx: RulesCtx): FeeEstimate {
  const cls = classify(c, ctx.cfg);
  return estimateFees(c, cls, ctx.cfg, { caseId: c.id, lateFee: lateFeeApplies(c, ctx) });
}

/** What is due right now from a fee estimate: a series' first session plus one-off lines, or the total. */
export function dueNowOf(estimate: FeeEstimate): number {
  return estimate.dueNow ?? estimate.total;
}

/** What the quote asks for right now (lib/state/core's dueAtQuote; see the import note above). */
export function quoteDueNow(c: EventCase, cfg: RulesConfig): number {
  return dueAtQuote(c, cfg);
}

/** What is still owed on the quote, never negative (a part payment leaves a balance). */
export function quoteAmountOwed(c: EventCase, cfg: RulesConfig): number {
  return Math.max(0, quoteBalance(c, cfg));
}

export function isQuotePaid(c: EventCase, cfg: RulesConfig): boolean {
  return quotePaid(c, cfg);
}

export interface SeriesQuoteNote {
  /** Sessions still billed on schedule, after the one due now. */
  sessionsRemaining: number;
  /** What each of those later sessions costs. */
  perSession: number;
}

/** For a series' quote: "first session now, the rest on schedule." Null for a single event. */
export function seriesQuoteNote(c: EventCase, cfg: RulesConfig): SeriesQuoteNote | null {
  if (!c.schedule?.recurrence) return null;
  const estimate = estimateFees(c, classify(c, cfg), cfg, { caseId: c.id });
  const sessions = estimate.sessions ?? 1;
  return { sessionsRemaining: Math.max(0, sessions - 1), perSession: estimate.perSession ?? 0 };
}

/** One series session's price, for the SESSION mode's payment form. */
export function sessionAmount(c: EventCase, cfg: RulesConfig): number {
  if (!c.schedule?.recurrence) return 0;
  const estimate = estimateFees(c, classify(c, cfg), cfg, { caseId: c.id });
  return estimate.perSession ?? 0;
}

/** Every condition in `conditions` has a matching id in `acceptedIds`. */
export function allAccepted(conditions: Condition[], acceptedIds: string[]): boolean {
  return conditions.every((condition) => acceptedIds.includes(condition.id));
}

/**
 * The "who's still up" line shown right after paying the quote (PRD, "Quote"): Health & Legal
 * if the insurance card isn't done yet, otherwise the Clerk's own issue step.
 */
export function afterQuotePaymentMessage(c: EventCase): string {
  const insurance = c.tasks.find((t) => t.catalogId === "insurance_certificate");
  if (insurance && insurance.status !== "done") return "Paid. Waiting on Health & Legal to verify your insurance.";
  return "Paid. The City Clerk will issue your permit.";
}

/** A human label for a payment's amount, used on the card form's button: "Pay $715". */
export function payButtonLabel(amount: number): string {
  return `Pay ${fmtMoney(amount)}`;
}
