/**
 * Pure view-model for the City Clerk's Payments tool (workstream 5B): the Due, Received and
 * Refunds lists, their totals, and the header summary. No React, no store: `PaymentsScreen`
 * reads `cases`, `demoToday` and `cfg` off the store and passes them in. Every figure comes from
 * `@/lib/state` (`caseTotals`, `quoteBalance`, `closeoutSettlement`, ...), never a sum of its
 * own (see "Money" in the readme). Tested against the real seed in `lib/view/payments.test.ts`.
 */
import { classify, estimateFees } from "@/lib/rules";
import { round2 } from "@/lib/rules/shared";
import type { RulesConfig } from "@/lib/rules/types";
import { amendmentPaymentDue, caseTotals, closeoutSettlement, quoteBalance } from "@/lib/state";
import { applicantNameOf } from "@/lib/data/people";
import { fmtDateShort, plural } from "@/lib/format";
import type { EventCase, ISODate, Payment } from "@/lib/types";

/* ---------------------------------------------------------------------------------------- */
/* Shared                                                                                     */
/* ---------------------------------------------------------------------------------------- */

export type PaymentsTab = "due" | "received" | "refunds";

export const PAYMENTS_TABS: PaymentsTab[] = ["due", "received", "refunds"];

export const PAYMENTS_TAB_LABEL: Record<PaymentsTab, string> = {
  due: "Due",
  received: "Received",
  refunds: "Refunds",
};

/** Event, applicant or case id, case-insensitive. Empty query matches everything. */
export function matchesPaymentsQuery(eventName: string, applicantName: string, caseId: string, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    eventName.toLowerCase().includes(needle) ||
    applicantName.toLowerCase().includes(needle) ||
    caseId.toLowerCase().includes(needle)
  );
}

/* ---------------------------------------------------------------------------------------- */
/* Due: every amount an applicant owes right now                                             */
/* ---------------------------------------------------------------------------------------- */

export interface DueRow {
  key: string;
  caseId: string;
  eventName: string;
  applicantName: string;
  kind: "quote" | "amendment" | "session" | "final_invoice";
  /** "Quote balance", "Amendment balance", "Session: Thu, Jun 10", "Final bill". */
  label: string;
  amount: number;
  dueDate: ISODate | null;
  /** Only for a quote still holding its date: when the hold expires (the same date it is due by). */
  holdExpiresOn: ISODate | null;
}

/**
 * Every amount owed now, across every open case: a quote awaiting payment (its pay-by date is
 * the hold's expiry), what an amendment added to a plan that was already paid (the payment card
 * open again on a permitted case), a series session whose day has come and is still unpaid, and
 * a final bill after closeout. An ended case owes nothing (see "How the engine behaves"), so it
 * is left out. A row's "Record payment" opens the case's own payment panel, which takes the same
 * amount under the same name.
 */
export function dueRows(cases: EventCase[], today: ISODate, cfg: RulesConfig): DueRow[] {
  const rows: DueRow[] = [];
  for (const c of cases) {
    if (c.ending !== null) continue;
    const applicantName = applicantNameOf(c);

    if (c.state === "quote_sent") {
      const balance = quoteBalance(c, cfg);
      if (balance > 0) {
        rows.push({
          key: `${c.id}:quote`,
          caseId: c.id,
          eventName: c.name,
          applicantName,
          kind: "quote",
          label: "Quote balance",
          amount: balance,
          dueDate: c.dateHold.expiresOn,
          holdExpiresOn: c.dateHold.status === "held" ? c.dateHold.expiresOn : null,
        });
      }
    }

    const amendmentDue = amendmentPaymentDue(c, cfg);
    if (amendmentDue > 0) {
      rows.push({
        key: `${c.id}:amendment`,
        caseId: c.id,
        eventName: c.name,
        applicantName,
        kind: "amendment",
        label: "Amendment balance",
        amount: amendmentDue,
        dueDate: c.tasks.find((t) => t.catalogId === "pay_fees")?.dueDate ?? null,
        holdExpiresOn: null,
      });
    }

    if (c.schedule?.recurrence && (c.state === "permitted" || c.state === "event_day")) {
      const perSession = estimateFees(c, classify(c, cfg), cfg).perSession ?? 0;
      for (const o of c.schedule.occurrences) {
        if (o.billing !== "due") continue;
        rows.push({
          key: `${c.id}:session:${o.date}`,
          caseId: c.id,
          eventName: c.name,
          applicantName,
          kind: "session",
          label: `Session: ${fmtDateShort(o.date)}`,
          amount: perSession,
          dueDate: o.date,
          holdExpiresOn: null,
        });
      }
    }

    if (c.state === "closed") {
      const due = caseTotals(c).due;
      if (due > 0) {
        const billTask = c.tasks.find((t) => t.catalogId === "final_bill_or_refund");
        rows.push({
          key: `${c.id}:final`,
          caseId: c.id,
          eventName: c.name,
          applicantName,
          kind: "final_invoice",
          label: "Final bill",
          amount: due,
          dueDate: billTask?.dueDate ?? null,
          holdExpiresOn: null,
        });
      }
    }
  }
  // Oldest due first, like every other queue; a row with no due date goes last.
  return rows.sort((a, b) => {
    if (a.dueDate === b.dueDate) return a.key.localeCompare(b.key);
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  });
}

export function dueTotal(rows: DueRow[]): number {
  return round2(rows.reduce((sum, r) => sum + r.amount, 0));
}

/* ---------------------------------------------------------------------------------------- */
/* Received: every payment made                                                              */
/* ---------------------------------------------------------------------------------------- */

export interface ReceivedRow {
  key: string;
  caseId: string;
  eventName: string;
  applicantName: string;
  at: string;
  amount: number;
  method: "card" | "in_person";
  kind: Payment["kind"];
  label: string;
  occurrenceDate?: ISODate;
}

const RECEIVED_KIND_LABEL: Partial<Record<Payment["kind"], string>> = {
  booking: "Booking payment",
  quote: "Quote payment",
  session: "Session payment",
  final_invoice: "Final bill",
};

/** Every payment made (refunds are the Refunds tab's own), newest first, across every case. */
export function receivedRows(cases: EventCase[]): ReceivedRow[] {
  const rows: ReceivedRow[] = [];
  for (const c of cases) {
    const applicantName = applicantNameOf(c);
    for (const p of c.payments) {
      if (p.kind === "refund") continue;
      const label = p.amendment
        ? "Amendment payment"
        : p.occurrenceDate
          ? `${RECEIVED_KIND_LABEL[p.kind] ?? "Payment"}: ${fmtDateShort(p.occurrenceDate)}`
          : RECEIVED_KIND_LABEL[p.kind] ?? "Payment";
      rows.push({
        key: p.id,
        caseId: c.id,
        eventName: c.name,
        applicantName,
        at: p.at,
        amount: p.amount,
        method: p.method,
        kind: p.kind,
        label,
        occurrenceDate: p.occurrenceDate,
      });
    }
  }
  return rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.key < b.key ? 1 : -1));
}

export interface ReceivedFilters {
  method?: "card" | "in_person";
  /** Inclusive, as a calendar day (the payment's own day, not its time). */
  from?: ISODate;
  to?: ISODate;
}

export function filterReceivedRows(rows: ReceivedRow[], filters: ReceivedFilters): ReceivedRow[] {
  return rows.filter((r) => {
    if (filters.method && r.method !== filters.method) return false;
    const day = r.at.slice(0, 10);
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;
    return true;
  });
}

export function receivedTotal(rows: ReceivedRow[]): number {
  return round2(rows.reduce((sum, r) => sum + r.amount, 0));
}

/** "13 sessions: 1 paid, 12 upcoming" (and "due" too, once a session's day has come). */
export function seriesProgressSummary(c: EventCase): string | null {
  if (!c.schedule?.recurrence) return null;
  const held = c.schedule.occurrences.filter((o) => o.billing !== "skipped");
  const paid = held.filter((o) => o.billing === "paid").length;
  const due = held.filter((o) => o.billing === "due").length;
  const upcoming = held.filter((o) => o.billing === "upcoming").length;
  const parts = [`${paid} paid`];
  if (due > 0) parts.push(`${plural(due, "session")} due`);
  if (upcoming > 0) parts.push(`${upcoming} upcoming`);
  return `${plural(held.length, "session")}: ${parts.join(", ")}`;
}

export interface ReceivedGroup {
  caseId: string;
  eventName: string;
  applicantName: string;
  /** A series' payments collapse to `seriesSummary` by default; this is what expands them. */
  isSeries: boolean;
  seriesSummary: string | null;
  /** This case's rows from the filtered set given, newest first. */
  rows: ReceivedRow[];
}

/** `receivedRows()` (already filtered), grouped by case so a series collapses to one row. */
export function groupReceivedRows(rows: ReceivedRow[], cases: EventCase[]): ReceivedGroup[] {
  const byCase = new Map<string, ReceivedRow[]>();
  const order: string[] = [];
  for (const r of rows) {
    const existing = byCase.get(r.caseId);
    if (existing) existing.push(r);
    else {
      byCase.set(r.caseId, [r]);
      order.push(r.caseId);
    }
  }
  return order.map((caseId) => {
    const caseRows = byCase.get(caseId)!;
    const c = cases.find((candidate) => candidate.id === caseId);
    const isSeries = Boolean(c?.schedule?.recurrence);
    return {
      caseId,
      eventName: caseRows[0].eventName,
      applicantName: caseRows[0].applicantName,
      isSeries,
      seriesSummary: isSeries && c ? seriesProgressSummary(c) : null,
      rows: caseRows,
    };
  });
}

/* ---------------------------------------------------------------------------------------- */
/* Refunds: issued and owed                                                                  */
/* ---------------------------------------------------------------------------------------- */

/** The band or ending from `endingReason`'s own parenthetical, or the whole sentence without one. */
function ruleFromEndingReason(reason: string | null): string | null {
  if (!reason) return null;
  const match = /\(([^)]+)\)\.?\s*$/.exec(reason);
  return match ? match[1] : reason;
}

function refundRule(c: EventCase, p: Payment): string {
  // What an amended plan gave back, on a permit that is still live: no cancellation, no closeout.
  if (p.amendment) return "Amended plan costs less";
  if (c.ending === "cancelled" || c.ending === "withdrawn") {
    return ruleFromEndingReason(c.endingReason) ?? (c.ending === "cancelled" ? "Cancellation" : "Withdrawal");
  }
  return "Deposit refund after closeout";
}

export interface RefundIssuedRow {
  key: string;
  caseId: string;
  eventName: string;
  applicantName: string;
  at: string;
  /** Positive: what went back. */
  amount: number;
  method: "card" | "in_person";
  /** The rule that produced it: the cancellation band, "Withdrawal", "Deposit refund after closeout", or "Amended plan costs less". */
  rule: string;
}

/** Every refund already paid: cancellations, withdrawals and deposit refunds after closeout. */
export function refundsIssuedRows(cases: EventCase[]): RefundIssuedRow[] {
  const rows: RefundIssuedRow[] = [];
  for (const c of cases) {
    const applicantName = applicantNameOf(c);
    for (const p of c.payments) {
      if (p.kind !== "refund") continue;
      rows.push({
        key: p.id,
        caseId: c.id,
        eventName: c.name,
        applicantName,
        at: p.at,
        amount: round2(-p.amount),
        method: p.method,
        rule: refundRule(c, p),
      });
    }
  }
  return rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.key < b.key ? 1 : -1));
}

export function refundsIssuedTotal(rows: RefundIssuedRow[]): number {
  return round2(rows.reduce((sum, r) => sum + r.amount, 0));
}

export interface RefundOwedRow {
  key: string;
  caseId: string;
  eventName: string;
  applicantName: string;
  amount: number;
  rule: string;
}

/**
 * A deposit refund the Clerk has not issued yet: Public Works & Safety has logged the cleanup,
 * but reconciling (which pays it) has not happened. Once reconciled it is a row above, not here.
 */
export function refundsOwedRows(cases: EventCase[]): RefundOwedRow[] {
  const rows: RefundOwedRow[] = [];
  for (const c of cases) {
    if (c.ending !== null || c.state !== "closeout" || !c.closeout.hoursLoggedOn) continue;
    const settlement = closeoutSettlement(c);
    if (settlement.refund !== null && settlement.refund > 0) {
      rows.push({
        key: `${c.id}:refund-owed`,
        caseId: c.id,
        eventName: c.name,
        applicantName: applicantNameOf(c),
        amount: settlement.refund,
        rule: "Deposit refund pending reconciliation",
      });
    }
  }
  return rows;
}

export function refundsOwedTotal(rows: RefundOwedRow[]): number {
  return round2(rows.reduce((sum, r) => sum + r.amount, 0));
}

/* ---------------------------------------------------------------------------------------- */
/* Header summary                                                                             */
/* ---------------------------------------------------------------------------------------- */

export interface PaymentsSummary {
  collectedThisMonth: number;
  outstanding: number;
  refundsIssuedThisMonth: number;
}

/** "Collected this month", "Outstanding" (every amount due right now) and "Refunds issued" (this month). */
export function paymentsSummary(cases: EventCase[], today: ISODate, cfg: RulesConfig): PaymentsSummary {
  const month = today.slice(0, 7);
  const collected = receivedRows(cases).filter((r) => r.at.slice(0, 7) === month);
  const refunded = refundsIssuedRows(cases).filter((r) => r.at.slice(0, 7) === month);
  return {
    collectedThisMonth: receivedTotal(collected),
    outstanding: dueTotal(dueRows(cases, today, cfg)),
    refundsIssuedThisMonth: refundsIssuedTotal(refunded),
  };
}
