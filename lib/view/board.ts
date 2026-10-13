/**
 * Pure view-models for My events (/events) and the applicant board (/events/[id]).
 * Nothing here reads the store or dispatches; screens pass in cases, today and cfg.
 */
import { addDaysISO, daysBetween } from "@/lib/dates";
import { fmtDate, fmtMoney } from "@/lib/format";
import { classify, estimateFees } from "@/lib/rules";
import { CARD_BY_ID, type CatalogId } from "@/lib/rules/catalog";
import type { RulesConfig } from "@/lib/rules/types";
import { routes } from "@/lib/routes";
import {
  applicantCases,
  boardColumn,
  boardColumns,
  cardUnderVerification,
  closeoutSettlement,
  eventDate,
  hasActivePermit,
  taskDueDate,
  whoIsUp,
} from "@/lib/state";
import type { BoardColumn } from "@/lib/state/types";
import {
  DEPTS,
  PARTY_LABEL,
  TASK_PHASES,
  TASK_PHASE_LABEL,
  type Dept,
  type EventCase,
  type ISODate,
  type Occurrence,
  type Party,
  type ReviewStatus,
  type Task,
  type TaskPhase,
} from "@/lib/types";
import { canPaySession } from "@/lib/view/checkout";

/* ---------------------------------------------------------------------- */
/* My events                                                               */
/* ---------------------------------------------------------------------- */

export interface MyEventsItem {
  case: EventCase;
  /** Where the row (and its title) link to: the wizard for a Draft, the board otherwise. */
  href: string;
  /** Set when a live permit exists. */
  permitHref: string | null;
  /** The applicant's next move, in plain words. */
  nextActionText: string;
  nextActionDue: ISODate | null;
  /** True when the applicant is the one who has to act next. */
  needsApplicant: boolean;
  /** Ended or closed: listed under "Past". */
  isPast: boolean;
}

/** `whoIsUp` plus the first Do now card, or the PRD's waiting sentence. */
export function nextActionFor(c: EventCase, today: ISODate): { text: string; due: ISODate | null } {
  if (c.ending) return { text: "This event has ended.", due: null };
  if (c.state === "closed" && c.closeout.feedback && boardColumns(c).do_now.length === 0) {
    return { text: "Nothing more to do. Thanks for using Permitopolis.", due: null };
  }

  const up = whoIsUp(c, today);
  if (up.includes("applicant")) {
    const first = boardColumns(c).do_now[0];
    if (first) return { text: first.title, due: taskDueDate(first) };
    return { text: "Continue planning your event", due: null };
  }

  const otherParty = up.find((p): p is Exclude<Party, "applicant"> => p !== "applicant");
  if (otherParty) return { text: `Nothing for you to do right now. Waiting on ${PARTY_LABEL[otherParty]}.`, due: null };
  return { text: "Nothing for you to do right now.", due: null };
}

/**
 * True while a Draft is still only wizard answers: no plan has been confirmed, so it has no
 * cards and no board. An Instant draft stays this way until it is booked; a Reviewed or Special
 * one gets its board at the wizard's last step and stays a Draft until it is submitted.
 */
export function isUnplannedDraft(c: EventCase): boolean {
  return c.state === "draft" && c.tasks.length === 0;
}

/** Where an event opens from My events: the wizard while it is only answers, its board after. */
function hrefFor(c: EventCase): string {
  return isUnplannedDraft(c) ? routes.apply({ caseId: c.id }) : routes.event(c.id);
}

/** The permit page, while the event has a live permit; null before one and after it ends. */
export function permitHrefFor(c: EventCase): string | null {
  return hasActivePermit(c) ? routes.permit(c.id) : null;
}

/** This persona's events: active ones first (what needs the applicant first, then by event date), then Past. */
export function myEvents(cases: EventCase[], personaId: string, today: ISODate): { active: MyEventsItem[]; past: MyEventsItem[] } {
  const items: MyEventsItem[] = applicantCases(cases, personaId).map((c) => {
    const { text, due } = nextActionFor(c, today);
    const isPast = c.ending !== null || c.state === "closed";
    return {
      case: c,
      href: hrefFor(c),
      permitHref: permitHrefFor(c),
      nextActionText: text,
      nextActionDue: due,
      needsApplicant: whoIsUp(c, today).includes("applicant"),
      isPast,
    };
  });

  const active = items
    .filter((i) => !i.isPast)
    .sort((a, b) => {
      if (a.needsApplicant !== b.needsApplicant) return a.needsApplicant ? -1 : 1;
      const ad = eventDate(a.case, today);
      const bd = eventDate(b.case, today);
      if (ad === bd) return a.case.id.localeCompare(b.case.id);
      if (ad === null) return 1;
      if (bd === null) return -1;
      return ad.localeCompare(bd);
    });

  const past = items
    .filter((i) => i.isPast)
    .sort((a, b) => {
      const ad = eventDate(a.case, today) ?? "";
      const bd = eventDate(b.case, today) ?? "";
      return bd.localeCompare(ad) || a.case.id.localeCompare(b.case.id);
    });

  return { active, past };
}

/* ---------------------------------------------------------------------- */
/* Board columns and swimlanes                                             */
/* ---------------------------------------------------------------------- */

export interface StackedCards {
  kind: "stack";
  catalogId: string;
  title: string;
  done: number;
  total: number;
  tasks: Task[];
}

export type ColumnEntry = { kind: "task"; task: Task } | StackedCards;

export const COLUMN_LABEL: Record<BoardColumn, string> = {
  do_now: "Do now",
  with_city: "With the city",
  coming_up: "Coming up",
  done: "Done",
};

function isPinned(task: Task): boolean {
  return Boolean(task.request) && task.request?.resolved === false;
}

/**
 * Repeated per-vendor health-permit cards stack into one entry, unless one of them is
 * pinned with an open request (S3: the one card stays on its own, pinned).
 */
export function groupColumnEntries(tasks: Task[]): ColumnEntry[] {
  const vendorCards = tasks.filter((t) => t.catalogId === "vendor_health_permit" && !isPinned(t));
  if (vendorCards.length <= 1) return tasks.map((task) => ({ kind: "task", task }));

  const stackedIds = new Set(vendorCards.map((t) => t.id));
  const entries: ColumnEntry[] = [];
  let stacked = false;
  for (const task of tasks) {
    if (stackedIds.has(task.id)) {
      if (!stacked) {
        entries.push({
          kind: "stack",
          catalogId: "vendor_health_permit",
          title: "Vendor health permits",
          done: vendorCards.filter((t) => t.status === "done").length,
          total: vendorCards.length,
          tasks: vendorCards,
        });
        stacked = true;
      }
      continue;
    }
    entries.push({ kind: "task", task });
  }
  return entries;
}

export function boardColumnsGrouped(c: EventCase): Record<BoardColumn, ColumnEntry[]> {
  const columns = boardColumns(c);
  return {
    do_now: groupColumnEntries(columns.do_now),
    with_city: groupColumnEntries(columns.with_city),
    coming_up: groupColumnEntries(columns.coming_up),
    done: groupColumnEntries(columns.done),
  };
}

export interface PhaseGroup {
  phase: TaskPhase;
  label: string;
  entries: ColumnEntry[];
}

/** Every applicant card (respecting the ended-case restriction boardColumns() already applies), by phase. */
export function phaseGroups(c: EventCase): PhaseGroup[] {
  const columns = boardColumns(c);
  const all = [...columns.do_now, ...columns.with_city, ...columns.coming_up, ...columns.done];
  return TASK_PHASES.map((phase) => ({
    phase,
    label: TASK_PHASE_LABEL[phase],
    entries: groupColumnEntries(all.filter((t) => t.phase === phase)),
  })).filter((group) => group.entries.length > 0);
}

/* ---------------------------------------------------------------------- */
/* Status strip: waiting-on chips, reviewer row, date-hold footnote        */
/* ---------------------------------------------------------------------- */

/** "Waiting on" chips, in the applicant's own words ("You" instead of "Applicant"). */
export function waitingOnChipItems(c: EventCase, today: ISODate): { party: Party; label: string }[] {
  return whoIsUp(c, today).map((party) => ({ party, label: party === "applicant" ? "You" : PARTY_LABEL[party] }));
}

const REVIEW_STATUS_WORD: Record<string, string> = {
  approved: "Approved",
  approved_with_conditions: "Approved with conditions",
  needs_info: "Asked you for something",
  pending: "Reviewing",
  denied: "Denied",
};

export interface ReviewerRow {
  dept: Dept;
  /** What `ReviewStatusDot` colors its dot by; the words beside it are `label`. */
  status: ReviewStatus;
  label: string;
}

/** Each department's status in the applicant's plain words (PRD: Approved / Approved with conditions / Asked you for something / Reviewing / Not involved). */
export function reviewerRows(c: EventCase): ReviewerRow[] {
  return DEPTS.map((dept): ReviewerRow => {
    const review = c.reviews.find((r) => r.dept === dept);
    if (review) return { dept, status: review.status, label: REVIEW_STATUS_WORD[review.status] ?? "Reviewing" };
    if (dept !== "clerk") return { dept, status: "not_routed", label: "Not involved" };
    // The Clerk owns the case even when it is never a formal "reviewer" on it. "Needs info"
    // can land here from before routing (an intake request) or after (a reviewer's request),
    // so this reads whether reviewers exist yet rather than the exact state.
    if (c.state === "draft") return { dept, status: "not_routed", label: "Not involved" };
    if (c.reviews.length === 0) return { dept, status: "pending", label: "Reviewing" };
    if (c.state === "in_review" || c.state === "needs_info") return { dept, status: "pending", label: "Waiting on reviews" };
    return { dept, status: "approved", label: "Approved" };
  });
}

/** The extra line HoldStatus's "No date hold yet" needs: how many sign-offs are still out. */
export function dateHoldFootnote(c: EventCase): string | null {
  if (c.dateHold.status !== "none") return null;
  const signoff = c.tasks.find((t) => t.catalogId === "neighbor_signoff");
  if (!signoff || signoff.status === "done") return null;
  const progress = signoff.payload.progress as { done: number; total: number } | undefined;
  if (!progress) return null;
  const left = Math.max(0, progress.total - progress.done);
  return left > 0 ? `${left} neighbor sign-off${left === 1 ? "" : "s"} to go` : null;
}

/* ---------------------------------------------------------------------- */
/* Card routing: which cards skip the sheet and link straight out          */
/* ---------------------------------------------------------------------- */

/**
 * Sign-off and payment cards (and an unlocked "Carry your permit") do not open a card
 * detail sheet: their button goes straight to the quote or the permit page. "Pay fees and
 * deposit" is the quote's own payment while it is open, for a series too: the quote asks for
 * the first session, and the checkout page is the one place it is paid.
 */
export function directLinkHref(c: EventCase, task: Task): string | null {
  if (task.status !== "todo") return null;
  if (task.catalogId === "accept_and_sign") return routes.quote(c.id);
  if (task.catalogId === "pay_fees") return routes.quote(c.id);
  if (task.catalogId === "final_bill_or_refund") return routes.quote(c.id, { pay: "final" });
  if (task.catalogId === "carry_permit") return routes.permit(c.id);
  return null;
}

/**
 * True for a series' "Pay fees and deposit" card once the booking or the quote is paid: from
 * then on it opens the session schedule, where the later sessions are paid one by one. While
 * the card is locked it opens as any locked card does, with what unlocks it.
 */
export function opensSessionSchedule(c: EventCase, task: Task): boolean {
  return task.catalogId === "pay_fees" && task.status === "done" && Boolean(c.schedule?.recurrence);
}

export interface CardRecord {
  /** What happened, one line each: "$6,530 paid by card on Mon, May 3, 2027". */
  lines: string[];
  /** Where the card's result can be seen: the quote while it is open, the permit after. */
  link: { href: string; label: string } | null;
}

/**
 * What the sheet of a finished payment, sign-off or permit card shows: the amount and date paid,
 * the signature and when it was given, and a link to the page that holds the result. These cards
 * have no form or file of their own, so without this the sheet repeats the card's one sentence
 * and nothing else. Empty for any other card.
 */
export function cardRecord(c: EventCase, task: Task): CardRecord {
  const doneAt = [...task.history].reverse().find((h) => h.status === "done")?.at ?? null;
  const permit = c.permit ? { href: routes.permit(c.id), label: "View permit" } : null;
  const quote = c.state === "quote_sent" ? { href: routes.quote(c.id), label: "View the quote" } : null;
  const paidLine = (p: EventCase["payments"][number]) =>
    p.amount < 0
      ? `${fmtMoney(-p.amount)} refunded on ${fmtDate(p.at)}`
      : `${fmtMoney(p.amount)} paid ${p.method === "card" ? "by card" : "in person"} on ${fmtDate(p.at)}`;

  switch (task.catalogId) {
    case "pay_fees":
      return { lines: c.payments.filter((p) => p.kind === "booking" || p.kind === "quote").map(paidLine), link: permit ?? quote };
    case "final_bill_or_refund":
      return { lines: c.payments.filter((p) => p.kind === "final_invoice" || p.kind === "refund").map(paidLine), link: permit };
    case "accept_and_sign": {
      if (task.status !== "done") return { lines: [], link: quote };
      const signature = typeof task.payload.signature === "string" ? task.payload.signature : null;
      const when = doneAt ? ` on ${fmtDate(doneAt)}` : "";
      return { lines: [signature ? `Signed by ${signature}${when}` : `Signed${when}`], link: permit ?? quote };
    }
    case "carry_permit":
      return { lines: task.status === "done" && doneAt ? [`Carried on the day; finished on ${fmtDate(doneAt)}`] : [], link: permit };
    default:
      return { lines: [], link: null };
  }
}

export function unlockHintFor(catalogId: string): string | undefined {
  return CARD_BY_ID[catalogId as CatalogId]?.unlockHint;
}

/* ---------------------------------------------------------------------- */
/* After the event: Closeout's "what's happening" line and the settlement  */
/* ---------------------------------------------------------------------- */

/**
 * What is happening in Closeout before the Clerk reconciles (PRD "After the event"): the board
 * says plainly who has the case next, instead of leaving it a silent wait. Null once reconciled
 * (`closeoutSettlement` then has the answer) or outside Closeout altogether.
 */
export function closeoutStatusLine(c: EventCase): string | null {
  if (c.state !== "closeout" || c.closeout.balance !== null) return null;
  return c.closeout.hoursLoggedOn === null
    ? "Public Works & Safety is checking cleanup; the City Clerk then reconciles costs."
    : "Public Works & Safety logged the cleanup; the City Clerk is reconciling costs.";
}

export interface FinalSettlement {
  /** "how it settled", in one sentence: a refund kept in part, or a balance owed. */
  sentence: string;
  /** When a balance is still owed and the final-bill card names a due date. */
  due: ISODate | null;
  /** Where to pay it, while the final-bill card is still open. Null once paid or refunded. */
  payHref: string | null;
}

/**
 * How Closeout settled (PRD "the final bill or refund card shows... how it settled"), from
 * `closeoutSettlement()`: the deposit kept in part and the rest refunded, or a balance owed
 * with its due date and the way to pay. Null until the Clerk reconciles.
 */
export function finalSettlement(c: EventCase): FinalSettlement | null {
  if (c.closeout.balance === null) return null;
  const s = closeoutSettlement(c);
  if (s.refund !== null) {
    const sentence =
      s.over > 0
        ? `Your event ran ${fmtMoney(s.over)} over the estimate, kept from your ${fmtMoney(s.deposit)} deposit; ${fmtMoney(s.refund)} was refunded.`
        : `Your event came in at or under the estimate. Your full ${fmtMoney(s.deposit)} deposit was refunded.`;
    return { sentence, due: null, payHref: null };
  }
  const billTask = c.tasks.find((t) => t.catalogId === "final_bill_or_refund");
  const due = billTask ? taskDueDate(billTask) : null;
  const owed = billTask?.status !== "done";
  return {
    sentence: `Your event ran ${fmtMoney(s.over)} over the estimate. Your ${fmtMoney(s.deposit)} deposit covered part of it; ${fmtMoney(s.bill ?? 0)} is${owed ? "" : " was"} still owed${due && owed ? ` by ${fmtDate(due)}` : ""}.`,
    due,
    payHref: owed ? routes.quote(c.id, { pay: "final" }) : null,
  };
}

/** The date "Book again next year" drafts for: the same weekday a year later (`bookAgain()`'s own +364 days). */
export function bookAgainDraftDate(c: EventCase): ISODate | null {
  return c.schedule ? addDaysISO(c.schedule.date, 364) : null;
}

/* ---------------------------------------------------------------------- */
/* "With the city": who has it, how long, and when it is expected back     */
/* ---------------------------------------------------------------------- */

export interface WithCityInfo {
  dept: Dept;
  deptLabel: string;
  daysWaiting: number;
  expectedBy: ISODate | null;
  overdue: boolean;
}

/** The day a card most recently became "with the city": its last move to `submitted`. */
function submittedOn(task: Task): ISODate | null {
  return [...task.history].reverse().find((h) => h.status === "submitted")?.at.slice(0, 10) ?? null;
}

/**
 * Who has a "With the city" card, how many days it has waited, and the expected-by date the
 * reviewer's own task carries (the review's due date while its review is still open, or the
 * card's own `verify:*` task's due date once the review has decided) — so "With the city" is
 * never a black hole. Null for a card with nobody tasked yet (should not happen; see the
 * readme, "A card 'With the city' always has someone tasked").
 */
export function withCityInfo(c: EventCase, task: Task, today: ISODate): WithCityInfo | null {
  const dept = task.reviewer;
  if (!dept) return null;
  const since = submittedOn(task) ?? task.dueDate ?? today;
  const daysWaiting = Math.max(0, daysBetween(since, today));

  const verifyTask = c.tasks.find((t) => t.catalogId.startsWith("verify:") && cardUnderVerification(c, t)?.id === task.id);
  let expectedBy: ISODate | null = null;
  if (verifyTask) {
    expectedBy = taskDueDate(verifyTask);
  } else {
    const review = c.reviews.find((r) => r.dept === dept);
    if (review && (review.status === "pending" || review.status === "needs_info")) expectedBy = review.dueDate;
  }

  return {
    dept,
    deptLabel: PARTY_LABEL[dept],
    daysWaiting,
    expectedBy,
    overdue: expectedBy !== null && expectedBy < today,
  };
}

export interface WithCitySummaryRow {
  dept: Dept;
  deptLabel: string;
  count: number;
  /** The soonest expected-by date among this department's cards; null when none has one. */
  expectedBy: ISODate | null;
}

/**
 * The "With the city" column's own summary line, one row per department holding a card
 * ("2 documents with Health & Legal, expected by Fri, May 7"), so the column says at a glance
 * who has what and when it is expected back.
 */
export function withCityColumnSummary(c: EventCase, today: ISODate): WithCitySummaryRow[] {
  const cards = boardColumns(c).with_city;
  const byDept = new Map<Dept, { count: number; expectedBy: ISODate | null }>();
  for (const task of cards) {
    const info = withCityInfo(c, task, today);
    if (!info) continue;
    const row = byDept.get(info.dept) ?? { count: 0, expectedBy: null };
    row.count += 1;
    if (info.expectedBy && (!row.expectedBy || info.expectedBy < row.expectedBy)) row.expectedBy = info.expectedBy;
    byDept.set(info.dept, row);
  }
  return DEPTS.filter((d) => byDept.has(d)).map((dept) => ({ dept, deptLabel: PARTY_LABEL[dept], ...byDept.get(dept)! }));
}

/* ---------------------------------------------------------------------- */
/* Series session schedule                                                 */
/* ---------------------------------------------------------------------- */

export interface SessionRow {
  date: ISODate;
  billing: Occurrence["billing"];
  amount: number;
  /** The checkout page for this session, when it can be paid there now; null otherwise. */
  payHref: string | null;
}

/** Every session of a series, with its own per-session amount, in date order. */
export function seriesSessions(c: EventCase, cfg: RulesConfig): SessionRow[] {
  if (!c.schedule?.recurrence) return [];
  const perSession = estimateFees(c, classify(c, cfg), cfg).perSession ?? 0;
  return [...c.schedule.occurrences]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((o) => ({
      date: o.date,
      billing: o.billing,
      amount: perSession,
      payHref: canPaySession(c, o.date) ? routes.quote(c.id, { pay: "session", date: o.date }) : null,
    }));
}

/* ---------------------------------------------------------------------- */
/* Re-exported for screens that only need the plain column (no grouping)   */
/* ---------------------------------------------------------------------- */

export { boardColumn };
