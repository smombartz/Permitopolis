/**
 * Pure helpers for the City Clerk's tools (workstream 4A): Intake's request-info picker,
 * Confirm routing's defaults, the Consolidation and quote builder's conflict detection and
 * editable merged lists, Issue permit's checklist, and Closeout reconciliation's per-line
 * breakdown. Nothing here mutates a case; every panel still changes state only through
 * useCaseDispatch() (lib/state's transition()).
 */
import { addDaysISO, daysBetween, dateOf } from "@/lib/dates";
import { fmtDateShort } from "@/lib/format";
import { classify, dueDate as dueDateRule, estimateFees } from "@/lib/rules";
import type { RulesConfig } from "@/lib/rules/types";
import type { Condition, Dept, EventCase, FeeLine, ISODate, Party, Task, TaskStatus } from "@/lib/types";
import type { ConditionDraft, FeeLineDraft } from "@/lib/state/actions";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ---------------------------------------------------------------------------------------- */
/* Request information: the applicant's cards, grouped by status                            */
/* ---------------------------------------------------------------------------------------- */

const REQUESTABLE_STATUS_ORDER: TaskStatus[] = ["submitted", "changes_requested", "todo", "locked", "done"];

export const REQUESTABLE_STATUS_LABEL: Record<TaskStatus, string> = {
  submitted: "Submitted, waiting on a check",
  changes_requested: "Changes requested",
  todo: "Not yet submitted",
  locked: "Locked",
  done: "Done",
};

export interface RequestableGroup {
  status: TaskStatus;
  label: string;
  cards: Task[];
}

/** The applicant's cards the request could be pinned to, grouped by where each one stands. */
export function requestableCardGroups(c: EventCase): RequestableGroup[] {
  const cards = c.tasks.filter((t) => t.owner === "applicant");
  return REQUESTABLE_STATUS_ORDER.map((status) => ({
    status,
    label: REQUESTABLE_STATUS_LABEL[status],
    cards: cards.filter((t) => t.status === status),
  })).filter((group) => group.cards.length > 0);
}

/**
 * A request template as it goes into the message: `{vendor}` is the vendor of the one per-vendor
 * card ticked, or "each vendor" when none or several are, since the same words go out on every
 * card chosen. The message is stored and shown to the applicant as written, so nothing later
 * could fill the placeholder in.
 */
export function fillRequestTemplate(template: string, cards: Task[]): string {
  const vendors = cards.map((t) => t.payload.vendorName).filter((name): name is string => typeof name === "string" && name.length > 0);
  return template.replaceAll("{vendor}", vendors.length === 1 ? vendors[0] : "each vendor");
}

/** A preview of the card the applicant will see once this request goes out. */
export function previewRequestCard(target: Task | null, dept: Dept, item: string, message: string, dueDate: ISODate, now: string): Task {
  const base: Task = target ?? {
    id: "preview",
    catalogId: "respond_to_request",
    owner: "applicant",
    kind: "action",
    title: item || "Respond to a request",
    why: "",
    reviewer: dept,
    dueDate,
    status: "todo",
    unlocksOn: null,
    phase: "review",
    payload: {},
    history: [],
    tags: [],
  };
  return {
    ...base,
    status: base.status === "done" || base.status === "locked" ? "todo" : base.status,
    request: { from: dept, message, at: now, dueDate, resolved: false },
  };
}

/* ---------------------------------------------------------------------------------------- */
/* Confirm routing: the default due date and the lead time left after it                    */
/* ---------------------------------------------------------------------------------------- */

/** Today plus the tier's review days, rolled back off a weekend. Never empty, never a weekend. */
export function defaultReviewDueDate(c: EventCase, cfg: RulesConfig, today: ISODate): ISODate {
  return dueDateRule(today, cfg.sla.reviewDays[c.tier], cfg);
}

/**
 * Days between the latest reviewer due date and the event (the first session of a series):
 * the runway left for consolidation, the quote and payment once every review is in. Null with
 * no date on the case yet.
 */
export function leadTimeLeftAfterRouting(c: EventCase, latestDueDate: ISODate): number | null {
  if (!c.schedule) return null;
  return daysBetween(latestDueDate, c.schedule.date);
}

/* ---------------------------------------------------------------------------------------- */
/* Consolidation: conflicts between departments' conditions                                  */
/* ---------------------------------------------------------------------------------------- */

export type ConditionConflictKind = "duplicate" | "value";

export interface ConditionConflict {
  /** The normalized phrase the conflicting conditions share. */
  key: string;
  kind: ConditionConflictKind;
  conditions: Condition[];
}

// A time ("9 pm", "11:30 am") or a bare number, so "Sound ends at 9 pm" and "Sound ends at
// 10 pm" canonicalize to the same phrase and "85 dB at 50 feet" to the same shape as "90 dB at
// 60 feet".
const TIME_OR_NUMBER = /\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b|\b\d+(?:\.\d+)?\b/gi;

function canonicalCondition(text: string): string {
  return text
    .toLowerCase()
    .replace(TIME_OR_NUMBER, "#")
    .replace(/[^\w\s#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Flags two kinds of problem in the merged conditions list: an exact duplicate (the same
 * wording more than once, usually from two departments), and a value conflict (the same
 * phrase, with the numbers and times blanked out, set to different values by more than one
 * department — "Sound ends at 9 pm" next to "Sound ends at 10 pm"). A value conflict needs at
 * least two departments; a duplicate is flagged even from the same one.
 */
export function detectConditionConflicts(conditions: Condition[]): ConditionConflict[] {
  const groups = new Map<string, Condition[]>();
  for (const condition of conditions) {
    const key = canonicalCondition(condition.text);
    if (!key) continue;
    const list = groups.get(key);
    if (list) list.push(condition);
    else groups.set(key, [condition]);
  }
  const conflicts: ConditionConflict[] = [];
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const distinctTexts = new Set(group.map((g) => g.text.trim().toLowerCase()));
    if (distinctTexts.size === 1) {
      conflicts.push({ key, kind: "duplicate", conditions: group });
    } else if (new Set(group.map((g) => g.dept)).size > 1) {
      conflicts.push({ key, kind: "value", conditions: group });
    }
  }
  return conflicts;
}

/** The conditions a conflict names, as a set of ids, for highlighting rows in the merged list. */
export function conditionIdsInConflict(conflicts: ConditionConflict[]): Set<string> {
  return new Set(conflicts.flatMap((conflict) => conflict.conditions.map((c) => c.id)));
}

/* ---------------------------------------------------------------------------------------- */
/* The merged conditions list: editable, reorderable rows                                   */
/* ---------------------------------------------------------------------------------------- */

export interface ConditionRow {
  id: string;
  dept: Dept;
  text: string;
}

/** The case's conditions as they stand, one editable row each, in the order they were decided. */
export function conditionRowsFromCase(c: EventCase): ConditionRow[] {
  return c.conditions.map((condition) => ({ id: condition.id, dept: condition.dept, text: condition.text }));
}

export function addConditionRow(rows: ConditionRow[], row: ConditionRow): ConditionRow[] {
  return [...rows, row];
}

export function updateConditionRow(rows: ConditionRow[], id: string, patch: Partial<Pick<ConditionRow, "dept" | "text">>): ConditionRow[] {
  return rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
}

export function removeConditionRow(rows: ConditionRow[], id: string): ConditionRow[] {
  return rows.filter((row) => row.id !== id);
}

/** Moves one row up (-1) or down (1); a move past either end is a no-op. */
export function moveConditionRow(rows: ConditionRow[], id: string, direction: -1 | 1): ConditionRow[] {
  const index = rows.findIndex((row) => row.id === id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= rows.length) return rows;
  const next = [...rows];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** What `send_quote` takes: blank rows left out, every row's text trimmed. */
export function conditionRowsToDrafts(rows: ConditionRow[]): ConditionDraft[] {
  return rows.filter((row) => row.text.trim().length > 0).map((row) => ({ dept: row.dept, text: row.text.trim() }));
}

/* ---------------------------------------------------------------------------------------- */
/* The quote: editable fee-line rows, the deposit, the late fee, and live totals             */
/* ---------------------------------------------------------------------------------------- */

export interface QuoteLineRow {
  id: string;
  dept: Dept;
  label: string;
  qty: number;
  unit: string;
  unitPrice: number;
  kind: FeeLine["kind"];
}

/** Every fee and late-fee line on the case (the Clerk's own estimate plus what reviewers added), one editable row each. The deposit is kept out: it is shown as its own fixed line. */
export function quoteLineRowsFromCase(c: EventCase): QuoteLineRow[] {
  return c.feeLines
    .filter((line) => line.kind !== "deposit")
    .map((line) => ({ id: line.id, dept: line.dept, label: line.label, qty: line.qty, unit: line.unit, unitPrice: line.unitPrice, kind: line.kind }));
}

export function addQuoteLineRow(rows: QuoteLineRow[], row: QuoteLineRow): QuoteLineRow[] {
  return [...rows, row];
}

export function updateQuoteLineRow(rows: QuoteLineRow[], id: string, patch: Partial<Pick<QuoteLineRow, "dept" | "label" | "qty" | "unit" | "unitPrice">>): QuoteLineRow[] {
  return rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
}

export function removeQuoteLineRow(rows: QuoteLineRow[], id: string): QuoteLineRow[] {
  return rows.filter((row) => row.id !== id);
}

export function quoteLineAmount(row: Pick<QuoteLineRow, "qty" | "unitPrice">): number {
  return round2(row.qty * row.unitPrice);
}

/** What `send_quote` takes: blank or zero-quantity rows left out. */
export function quoteLineRowsToDrafts(rows: QuoteLineRow[]): FeeLineDraft[] {
  return rows
    .filter((row) => row.label.trim().length > 0 && row.qty > 0)
    .map((row) => ({ dept: row.dept, label: row.label.trim(), qty: row.qty, unit: row.unit, unitPrice: row.unitPrice, kind: row.kind }));
}

/** The deposit line's amount, from the case's own fee lines (there is at most one). 0 when the tier carries none. */
export function depositAmountFor(c: EventCase): number {
  return round2(c.feeLines.filter((line) => line.kind === "deposit").reduce((sum, line) => sum + line.estimate, 0));
}

/**
 * The deposit, as the draft `send_quote` needs it alongside the edited fee lines: kept exactly
 * as the case already carries it (label, unit and amount), since the deposit is shown as its
 * own fixed line, not one of the editable rows. `send_quote` replaces the whole list when it is
 * given any lines at all, so leaving the deposit out would drop it from the quote.
 */
export function depositLineDrafts(c: EventCase): FeeLineDraft[] {
  return c.feeLines
    .filter((line) => line.kind === "deposit")
    .map((line) => ({ dept: line.dept, label: line.label, qty: line.qty, unit: line.unit, unitPrice: line.unitPrice, kind: line.kind }));
}

/**
 * The late fee the edited lines would carry if one were added now: 25% of the fee rows
 * (the deposit excluded), the engine's own rate. A preview only — sending includes a late fee
 * line only when one of `rows` already has `kind: "late_fee"`.
 */
export function previewLateFeeAmount(rows: QuoteLineRow[], cfg: RulesConfig): number {
  const feesExclLate = round2(rows.filter((row) => row.kind === "fee").reduce((sum, row) => sum + quoteLineAmount(row), 0));
  return round2(feesExclLate * cfg.lateFee.rate);
}

export interface QuoteTotals {
  /** Every non-deposit row, summed. */
  feesSubtotal: number;
  deposit: number;
  total: number;
  /** What dueAtQuote() would read once this is sent: everything for a single event; a series' one-off lines plus its first session. */
  dueNow: number;
  holdExpiresOn: ISODate;
}

/** Live totals for the panel, in the same figures `send_quote` and `dueAtQuote()` would read once it is sent. */
export function computeQuoteTotals(rows: QuoteLineRow[], deposit: number, c: EventCase, cfg: RulesConfig, today: ISODate): QuoteTotals {
  const feesSubtotal = round2(rows.reduce((sum, row) => sum + quoteLineAmount(row), 0));
  const total = round2(feesSubtotal + deposit);
  let dueNow = total;
  if (c.schedule?.recurrence) {
    const estimate = estimateFees(c, classify(c, cfg), cfg);
    const laterSessions = Math.max(0, (estimate.sessions ?? 1) - 1);
    dueNow = Math.max(0, round2(total - laterSessions * (estimate.perSession ?? 0)));
  }
  return { feesSubtotal, deposit, total, dueNow, holdExpiresOn: addDaysISO(today, cfg.hold.daysAfterQuote) };
}

/* ---------------------------------------------------------------------------------------- */
/* Record a payment: which session of a series, when more than one sits unpaid              */
/* ---------------------------------------------------------------------------------------- */

/**
 * Every session of a series marked `due` (its day has come and it is still unpaid), earliest
 * first. Usually at most one, but nothing stops more than one from accumulating unpaid (see
 * "Open questions for the owner"), so a payment panel should let the Clerk choose among them.
 */
export function overdueSessionDates(c: EventCase): ISODate[] {
  if (!c.schedule?.recurrence) return [];
  return c.schedule.occurrences
    .filter((o) => o.billing === "due")
    .map((o) => o.date)
    .sort();
}

/* ---------------------------------------------------------------------------------------- */
/* Issue permit: the checklist                                                               */
/* ---------------------------------------------------------------------------------------- */

export interface PermitChecklistItem {
  key: "signature" | "payment" | "insurance";
  label: string;
  owedBy: Party;
  done: boolean;
  /** The day this started being owed: the task's own first "to do", from its history. */
  sinceDate: ISODate | null;
}

/**
 * The day this task started being owed. A card that was created locked carries a "todo" entry
 * for the day it unlocked (applyUnlockEvent appends one); a card open from the start of the
 * plan (insurance, for every Reviewed or Special event) carries no entry until something
 * happens to it, so its earliest entry — however it reads — is the earliest evidence there is.
 * Falls back to when the case was submitted, for a card untouched since the plan was built.
 */
function firstTodoDate(task: Task | undefined, submittedAt: string | null): ISODate | null {
  const todo = task?.history.find((h) => h.status === "todo");
  if (todo) return dateOf(todo.at);
  const earliest = task?.history[0];
  if (earliest) return dateOf(earliest.at);
  return submittedAt ? dateOf(submittedAt) : null;
}

/**
 * The three things Issue permit waits for (checkIssuePermit's own list, in the same order):
 * signed, paid, and — only while the case carries an insurance card — verified. Each with who
 * owes it and the day it started being owed.
 */
export function issuePermitChecklist(c: EventCase): PermitChecklistItem[] {
  const items: PermitChecklistItem[] = [];
  const signTask = c.tasks.find((t) => t.catalogId === "accept_and_sign");
  items.push({ key: "signature", label: "Accepted the conditions and signed", owedBy: "applicant", done: c.flags.signed, sinceDate: firstTodoDate(signTask, c.submittedAt) });
  const payTask = c.tasks.find((t) => t.catalogId === "pay_fees");
  items.push({ key: "payment", label: "Paid the quote in full", owedBy: "applicant", done: (payTask?.status ?? "todo") === "done", sinceDate: firstTodoDate(payTask, c.submittedAt) });
  const insuranceTask = c.tasks.find((t) => t.catalogId === "insurance_certificate");
  if (insuranceTask) {
    items.push({ key: "insurance", label: "Insurance certificate verified", owedBy: "hl", done: insuranceTask.status === "done", sinceDate: firstTodoDate(insuranceTask, c.submittedAt) });
  }
  return items;
}

/* ---------------------------------------------------------------------------------------- */
/* Closeout reconciliation: estimate against actual, by line                                 */
/* ---------------------------------------------------------------------------------------- */

export interface ReconciliationLine {
  id: string;
  dept: Dept;
  label: string;
  estimate: number;
  /** Null while nothing has been logged for this line yet (never shown for a case ready to reconcile: log_closeout fills every line). */
  actual: number | null;
  difference: number | null;
}

/** Every non-deposit fee line, estimate against actual, with the difference: what the Clerk reads before closing. */
export function reconciliationLines(c: EventCase): ReconciliationLine[] {
  return c.feeLines
    .filter((line) => line.kind !== "deposit")
    .map((line) => ({
      id: line.id,
      dept: line.dept,
      label: line.label,
      estimate: line.estimate,
      actual: line.actual,
      difference: line.actual !== null ? round2(line.actual - line.estimate) : null,
    }));
}

/* ---------------------------------------------------------------------------------------- */
/* Conditions and fees tab: payments made, with dates and methods                            */
/* ---------------------------------------------------------------------------------------- */

export interface PaymentRow {
  id: string;
  at: string;
  amount: number;
  method: "card" | "in_person";
  label: string;
}

const PAYMENT_KIND_LABEL: Record<string, string> = {
  booking: "Booking payment",
  quote: "Quote payment",
  session: "Session payment",
  final_invoice: "Final bill",
  refund: "Refund",
};

/** Every payment and refund on the case, newest first, each with a plain-language label. */
export function paymentRows(c: EventCase): PaymentRow[] {
  return [...c.payments]
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .map((p) => ({
      id: p.id,
      at: p.at,
      amount: p.amount,
      method: p.method,
      // A session is named by its day, written as every other date on the screen is. What an
      // amendment added or gave back says so: the case never had a quote, or has paid it already.
      label: p.amendment
        ? p.kind === "refund" ? "Amendment refund" : "Amendment payment"
        : p.occurrenceDate ? `${PAYMENT_KIND_LABEL[p.kind] ?? "Payment"}: ${fmtDateShort(p.occurrenceDate)}` : PAYMENT_KIND_LABEL[p.kind] ?? "Payment",
    }));
}
