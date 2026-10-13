/**
 * Pure view-models for My events (/events) and the applicant board (/events/[id]).
 * Nothing here reads the store or dispatches; screens pass in cases, today and cfg.
 */
import { classify, estimateFees } from "@/lib/rules";
import { CARD_BY_ID, type CatalogId } from "@/lib/rules/catalog";
import type { RulesConfig } from "@/lib/rules/types";
import { routes } from "@/lib/routes";
import {
  applicantCases,
  boardColumn,
  boardColumns,
  eventDate,
  hasActivePermit,
  taskDueDate,
  whoIsUp,
} from "@/lib/state";
import type { BoardColumn } from "@/lib/state/types";
import { PARTY_LABEL, type EventCase, type ISODate, type Occurrence, type Party, type Task, type TaskPhase } from "@/lib/types";

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

function hrefFor(c: EventCase): string {
  return c.state === "draft" ? routes.apply({ caseId: c.id }) : routes.event(c.id);
}

/** This persona's events: active ones first (what needs the applicant first, then by event date), then Past. */
export function myEvents(cases: EventCase[], personaId: string, today: ISODate): { active: MyEventsItem[]; past: MyEventsItem[] } {
  const items: MyEventsItem[] = applicantCases(cases, personaId).map((c) => {
    const { text, due } = nextActionFor(c, today);
    const isPast = c.ending !== null || c.state === "closed";
    return {
      case: c,
      href: hrefFor(c),
      permitHref: hasActivePermit(c) ? routes.permit(c.id) : null,
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

export const PHASE_LABEL: Record<TaskPhase, string> = {
  before_submitting: "Before submitting",
  review: "Review",
  permit: "Permit",
  before_event: "Before the event",
  event_day: "Event day",
  after: "After",
};

export const PHASE_ORDER: TaskPhase[] = ["before_submitting", "review", "permit", "before_event", "event_day", "after"];

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
  return PHASE_ORDER.map((phase) => ({
    phase,
    label: PHASE_LABEL[phase],
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
  dept: "clerk" | "pws" | "hl";
  label: string;
}

/** Each department's status in the applicant's plain words (PRD: Approved / Approved with conditions / Asked you for something / Reviewing / Not involved). */
export function reviewerRows(c: EventCase): ReviewerRow[] {
  return (["clerk", "pws", "hl"] as const).map((dept) => {
    const review = c.reviews.find((r) => r.dept === dept);
    if (review) return { dept, label: REVIEW_STATUS_WORD[review.status] ?? "Reviewing" };
    if (dept !== "clerk") return { dept, label: "Not involved" };
    // The Clerk owns the case even when it is never a formal "reviewer" on it. "Needs info"
    // can land here from before routing (an intake request) or after (a reviewer's request),
    // so this reads whether reviewers exist yet rather than the exact state.
    if (c.state === "draft") return { dept, label: "Not involved" };
    if (c.reviews.length === 0) return { dept, label: "Reviewing" };
    if (c.state === "in_review" || c.state === "needs_info") return { dept, label: "Waiting on reviews" };
    return { dept, label: "Approved" };
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
 * detail sheet: their button goes straight to the quote or the permit page. A series'
 * "Pay fees and deposit" is the exception: it opens the session schedule instead (see
 * `BoardScreen`), so it is left out here.
 */
export function directLinkHref(c: EventCase, task: Task): string | null {
  if (task.status !== "todo") return null;
  if (task.catalogId === "accept_and_sign") return routes.quote(c.id);
  if (task.catalogId === "pay_fees" && !c.schedule?.recurrence) return routes.quote(c.id);
  if (task.catalogId === "final_bill_or_refund") return routes.quote(c.id, { pay: "final" });
  if (task.catalogId === "carry_permit") return routes.permit(c.id);
  return null;
}

/** True for a series' own "Pay fees and deposit" card: it opens the session schedule sheet. */
export function opensSessionSchedule(c: EventCase, task: Task): boolean {
  return task.catalogId === "pay_fees" && Boolean(c.schedule?.recurrence);
}

export function unlockHintFor(catalogId: string): string | undefined {
  return CARD_BY_ID[catalogId as CatalogId]?.unlockHint;
}

/* ---------------------------------------------------------------------- */
/* Series session schedule                                                 */
/* ---------------------------------------------------------------------- */

export interface SessionRow {
  date: ISODate;
  billing: Occurrence["billing"];
  amount: number;
}

/** Every session of a series, with its own per-session amount, in date order. */
export function seriesSessions(c: EventCase, cfg: RulesConfig): SessionRow[] {
  if (!c.schedule?.recurrence) return [];
  const perSession = estimateFees(c, classify(c, cfg), cfg).perSession ?? 0;
  return [...c.schedule.occurrences].sort((a, b) => a.date.localeCompare(b.date)).map((o) => ({ date: o.date, billing: o.billing, amount: perSession }));
}

/* ---------------------------------------------------------------------- */
/* Re-exported for screens that only need the plain column (no grouping)   */
/* ---------------------------------------------------------------------- */

export { boardColumn };
