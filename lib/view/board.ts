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
  amendmentPaymentDue,
  amendmentSignOpen,
  amendmentStage,
  applicantCases,
  boardColumn,
  boardColumns,
  cardUnderVerification,
  closeoutSettlement,
  eventDate,
  hasActivePermit,
  involvement,
  lastSessionDate,
  taskDueDate,
  taskSubmittedOn,
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

/**
 * Each department's status in the applicant's plain words (PRD: Approved / Approved with
 * conditions / Asked you for something / Reviewing / Not involved). A department with no review
 * yet reads as `involvement()` has it, so the strip agrees with the city's Who's up: one named
 * on a card before routing "starts after intake", it is not "not involved".
 */
export function reviewerRows(c: EventCase): ReviewerRow[] {
  return DEPTS.map((dept): ReviewerRow => {
    const review = c.reviews.find((r) => r.dept === dept);
    if (review) return { dept, status: review.status, label: REVIEW_STATUS_WORD[review.status] ?? "Reviewing" };
    if (dept !== "clerk") return { dept, status: "not_routed", label: involvement(c, dept) === "awaiting_routing" ? "Starts after intake" : "Not involved" };
    // The Clerk owns the case even when it is never a formal "reviewer" on it. "Needs info"
    // can land here from before routing (an intake request) or after (a reviewer's request),
    // so this reads whether reviewers exist yet rather than the exact state.
    if (c.state === "draft") return { dept, status: "not_routed", label: "Not involved" };
    // An Instant event is booked, never reviewed (PRD, S1: "Nobody; permit active"), and a
    // case past its permit with no review has nothing left for anybody to review either.
    const atIntake = c.state === "submitted" || c.state === "needs_info";
    if (c.reviews.length === 0 && (c.tier === "instant" || !atIntake)) return { dept, status: "not_routed", label: "Nothing to review" };
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
  /** Who holds the card now: the department that checks it, or the City Clerk while the application is still at intake. */
  dept: Dept;
  deptLabel: string;
  /** The department that checks the card: the same as `dept` once the case is routed. */
  reviewer: Dept;
  reviewerLabel: string;
  /** Not routed yet: the Clerk's intake has the application, and the reviewer starts after routing. */
  atIntake: boolean;
  /** Days `dept` has had the card: since it was sent, or since `dept` got the case if that was later. */
  daysWaiting: number;
  expectedBy: ISODate | null;
  overdue: boolean;
}

/**
 * Who has a "With the city" card, how many days they have had it, and when it is expected
 * back, so the column is never a black hole. Every part is read off the task the city itself
 * works from, so the board cannot disagree with a reviewer's queue (`tests/both-sides.test.ts`):
 *
 * - the card's own `verify:*` task, once its department has decided its review;
 * - the department's `review:<dept>` task while that review is open, which covers every card
 *   sent to it;
 * - before routing, the Clerk's intake check. The card's reviewer has not started ("Starts when
 *   the City Clerk routes the case" on the city's side), so the Clerk is who holds it. While
 *   the intake check itself waits (on a neighbor sign-off, on an answer) there is no date.
 *
 * The days are counted from the day the party named got the card, not from the upload: a card
 * uploaded to a Draft has been at intake since the application went in (the Intake queue's
 * "20 days"), and a department has had it since the Clerk routed the case (its queue's "0 days
 * waiting"). A card sent later than that counts from when it was sent.
 *
 * Null for a card nobody checks.
 */
export function withCityInfo(c: EventCase, task: Task, today: ISODate): WithCityInfo | null {
  const reviewer = task.reviewer;
  if (!reviewer) return null;
  const sent = taskSubmittedOn(task) ?? today;
  const laterOf = (day: string | null | undefined): ISODate => (day && day.slice(0, 10) > sent ? day.slice(0, 10) : sent);
  const atIntake = c.reviews.length === 0;

  let expectedBy: ISODate | null = null;
  let since: ISODate;
  const verifyTask = c.tasks.find((t) => t.catalogId.startsWith("verify:") && t.status !== "done" && cardUnderVerification(c, t)?.id === task.id);
  if (verifyTask) {
    expectedBy = taskDueDate(verifyTask);
    // A verify task is opened for this one card, and opened again when it is uploaded again.
    since = laterOf([...verifyTask.history].reverse().find((h) => h.status === "todo")?.at);
  } else if (atIntake) {
    const intake = c.tasks.find((t) => t.catalogId === "intake_check" && t.status === "todo");
    expectedBy = intake ? taskDueDate(intake) : null;
    since = laterOf(c.submittedAt);
  } else {
    const reviewTask = c.tasks.find((t) => t.catalogId === `review:${reviewer}` && t.status === "todo");
    expectedBy = reviewTask ? taskDueDate(reviewTask) : null;
    // A card the Clerk checks itself has been the Clerk's since the application went in.
    since = laterOf(c.reviews.find((r) => r.dept === reviewer)?.clock.startedOn ?? c.submittedAt);
  }
  const daysWaiting = Math.max(0, daysBetween(since, today));

  const dept: Dept = atIntake ? "clerk" : reviewer;
  return {
    dept,
    deptLabel: PARTY_LABEL[dept],
    reviewer,
    reviewerLabel: PARTY_LABEL[reviewer],
    atIntake,
    daysWaiting,
    expectedBy,
    overdue: expectedBy !== null && expectedBy < today,
  };
}

export interface WithCitySummaryRow {
  dept: Dept;
  deptLabel: string;
  /** These cards are at the Clerk's intake, not yet with the department that checks them. */
  atIntake: boolean;
  count: number;
  /** The soonest expected-by date among this holder's cards; null when none has one. */
  expectedBy: ISODate | null;
}

/**
 * The "With the city" column's own summary line, one row per party holding a card ("2 cards
 * with Health & Legal, expected by Fri, May 7"; "3 cards at intake with the City Clerk"), so the
 * column says at a glance who has what and when it is expected back.
 */
export function withCityColumnSummary(c: EventCase, today: ISODate): WithCitySummaryRow[] {
  const cards = boardColumns(c).with_city;
  const byDept = new Map<Dept, { atIntake: boolean; count: number; expectedBy: ISODate | null }>();
  for (const task of cards) {
    const info = withCityInfo(c, task, today);
    if (!info) continue;
    const row = byDept.get(info.dept) ?? { atIntake: info.atIntake, count: 0, expectedBy: null };
    row.count += 1;
    if (info.expectedBy && (!row.expectedBy || info.expectedBy < row.expectedBy)) row.expectedBy = info.expectedBy;
    byDept.set(info.dept, row);
  }
  return DEPTS.filter((d) => byDept.has(d)).map((dept) => {
    const row = byDept.get(dept)!;
    return { dept, deptLabel: PARTY_LABEL[dept], atIntake: row.atIntake, count: row.count, expectedBy: row.expectedBy };
  });
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

export interface SeriesTotals {
  /** Every session already paid (the booking or quote's first session, plus each one paid since). */
  paid: number;
  /** Due and upcoming sessions together: what the series still asks for, skipped ones excluded. */
  outstanding: number;
}

/** The series schedule's own totals (PRD "Series... with the total paid and outstanding"). */
export function seriesTotals(c: EventCase, cfg: RulesConfig): SeriesTotals {
  const rows = seriesSessions(c, cfg);
  const sum = (billings: Occurrence["billing"][]) => rows.filter((r) => billings.includes(r.billing)).reduce((s, r) => s + r.amount, 0);
  return { paid: sum(["paid"]), outstanding: sum(["due", "upcoming"]) };
}

/* ---------------------------------------------------------------------- */
/* Amendment (PRD "Amend"): the board's menu, and the pending banner       */
/* ---------------------------------------------------------------------- */

export interface AmendEligibility {
  ok: boolean;
  /** Why it cannot be amended, for a Draft, an ended case, a closed one, or one past its last session. */
  reason?: string;
}

/**
 * The board menu's "Change your event" and the permit page's amend link both ask this first,
 * so a case that cannot be amended explains why instead of opening a wizard that has nothing to
 * do: a Draft is edited in the wizard instead (`isUnplannedDraft`'s opposite number), an ended
 * or closed case is over, and a case cannot be amended once its last session has passed. This
 * mirrors `checkAmend()` in `lib/state/checks.ts` for the parts a screen needs to know before
 * the click; the engine's own check is still what `dispatch` runs.
 */
export function canAmend(c: EventCase, today: ISODate): AmendEligibility {
  if (c.state === "draft") return { ok: false, reason: "Edit your plan in the wizard instead." };
  if (c.ending) return { ok: false, reason: `This case is ${c.ending.replace("_", " ")}; it cannot be amended.` };
  if (c.state === "closed") return { ok: false, reason: "This case is closed; it cannot be amended." };
  const last = lastSessionDate(c);
  if (last && last < today) return { ok: false, reason: "The event has already happened; it cannot be amended." };
  if (c.flags.amendmentPending) {
    // The engine's own two reasons (`checkAmend()`): one amendment at a time.
    return { ok: false, reason: amendmentStage(c) === "approved" ? "An amendment is approved; sign and pay it before changing the plan again." : "An amendment is already pending; wait for the City Clerk's decision." };
  }
  return { ok: true };
}

export interface AmendmentBanner {
  text: string;
  /** Once the applicant has submitted it (the amendment's own "Submit application" is done) and until the city has decided: nothing for them to do but wait. */
  awaitingCity: boolean;
}

/**
 * The board's "an amendment is pending" banner (PRD "Amend", "the current permit stays valid
 * for the original plan until the amendment is approved"), in three stages: the applicant is
 * on its cards; it is with the city (the departments check its cards, then the City Clerk
 * decides); the Clerk approved it and it waits for the applicant's signature and payment. Null
 * once nothing is pending.
 */
export function amendmentBanner(c: EventCase, cfg?: RulesConfig): AmendmentBanner | null {
  if (!c.flags.amendmentPending) return null;
  const submitCard = c.tasks.find((t) => t.catalogId === "submit_application" && t.tags.includes("amendment"));
  const submitted = submitCard?.status === "done";
  if (submitted && amendmentStage(c) === "approved") {
    const due = cfg ? amendmentPaymentDue(c, cfg) : 0;
    const sign = amendmentSignOpen(c);
    const todo = sign && due > 0 ? `Accept and sign, then pay ${fmtMoney(due)},` : sign ? "Accept and sign" : due > 0 ? `Pay ${fmtMoney(due)}` : "Finish what is left below";
    return { text: `The City Clerk approved your amendment. ${todo} to put it into effect; your current permit stays valid for the original plan until then.`, awaitingCity: false };
  }
  const checking = [...new Set(c.tasks.filter((t) => t.owner === "applicant" && t.tags.includes("amendment") && t.status === "submitted" && t.reviewer && t.reviewer !== "clerk").map((t) => PARTY_LABEL[t.reviewer as Dept]))];
  const withCity = checking.length > 0 ? `${checking.join(" and ")} ${checking.length === 1 ? "is" : "are"} checking its cards, then the City Clerk decides.` : "It is with the City Clerk for a decision.";
  const text = submitted
    ? `An amendment is pending. ${withCity} Your current permit stays valid for the original plan until it is decided.`
    : "An amendment is pending. Finish the new cards below, then submit it; your current permit stays valid for the original plan until it is decided.";
  return { text, awaitingCity: submitted };
}

/* ---------------------------------------------------------------------- */
/* Re-exported for screens that only need the plain column (no grouping)   */
/* ---------------------------------------------------------------------- */

export { boardColumn };
