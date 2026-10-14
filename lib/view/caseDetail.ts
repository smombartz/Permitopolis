/**
 * Pure view-model for the case detail screen (workstream 3F): what each tab shows, the
 * documents grouping, and which action panel a task or a sticky-panel row opens. No React, no
 * store: CaseDetailScreen and its tabs read the pieces of store state this needs and pass them
 * in. Covered by lib/view/caseDetail.test.ts against the real seed.
 */
import type { PermitComponent } from "@/lib/rules/types";
import { addDaysISO } from "@/lib/dates";
import { cardUnderVerification, meetingCardFor, permitCovers, reviewClock } from "@/lib/state";
import type { ActionAvailability, ReviewClockView } from "@/lib/state/types";
import { ACTION_TYPES, type ActionType } from "@/lib/state/actions";
import type { CaseTab } from "@/lib/routes";
import { routes } from "@/lib/routes";
import { cityPageIsFor } from "@/lib/view/shell";
import { addOnsSummary, seriesSummary, setupTeardownText } from "@/lib/view/eventSummary";
import { fmtDate, fmtNumber, fmtTimeRange } from "@/lib/format";
import {
  DEPTS,
  EVENT_TYPE_LABEL,
  type Activity,
  type Actor,
  type Condition,
  type DateHold,
  type Dept,
  type EventCase,
  type FeeLine,
  type ISODate,
  type ISODateTime,
  type Party,
  type Review,
  type Task,
  type Trigger,
} from "@/lib/types";
import type { KeyValueItem } from "@/components/ui/key-value";
import type { MapHighlight } from "@/components/map/types";

/* ---------- tabs ---------- */

export const CASE_TABS: CaseTab[] = ["overview", "reviews", "documents", "conditions", "activity"];

export const CASE_TAB_LABEL: Record<CaseTab, string> = {
  overview: "Overview",
  reviews: "Reviews",
  documents: "Documents",
  conditions: "Conditions and fees",
  activity: "Activity",
};

export function isCaseTab(value: string | null): value is CaseTab {
  return value !== null && (CASE_TABS as string[]).includes(value);
}

/**
 * The lists a case is opened from, and what its back link calls each of them: the four shared
 * lists, then each role's own tool pages, named as the city tabs name them.
 */
const BACK_LABEL: [path: string, label: string][] = [
  [routes.city.queue(), "Back to My queue"],
  [routes.city.cases(), "Back to cases"],
  [routes.city.active(), "Back to Active permits"],
  [routes.city.intake(), "Back to Intake"],
  [routes.city.payments(), "Back to Payments"],
  [routes.city.map(), "Back to Closures and routes"],
  [routes.city.workOrders(), "Back to Work orders"],
  [routes.city.verifications(), "Back to Verifications"],
  [routes.city.inspections(), "Back to Inspections"],
];

export interface CaseBackLink {
  href: string;
  label: string;
}

/**
 * Where a case's back link goes: the list it was opened from (`?from=`, a city path with its
 * own query string, so a filtered pipeline comes back filtered), or the cases pipeline. A list
 * this role does not have (the Clerk's Intake or Payments, after a switch to another
 * department) and anything that is not one of the lists above fall back to the pipeline too.
 */
export function caseBackLink(fromParam: string | null, role: Party): CaseBackLink {
  const fallback: CaseBackLink = { href: routes.city.cases(), label: "Back to cases" };
  if (!fromParam) return fallback;
  const path = fromParam.split("?")[0];
  const known = BACK_LABEL.find(([listPath]) => listPath === path);
  if (!known || !cityPageIsFor(role, path)) return fallback;
  return { href: fromParam, label: known[1] };
}

/* ---------- header ---------- */

/**
 * The review clock the header shows: the viewer's own department's, or, for the Clerk, the
 * slowest of every review still open (the one furthest past its own allowance).
 */
export function headerReviewClock(c: EventCase, role: Party, today: ISODate): ReviewClockView | null {
  if (role === "applicant") return null;
  if (role !== "clerk") return reviewClock(c, role, today);
  let slowest: ReviewClockView | null = null;
  for (const dept of DEPTS) {
    const review = c.reviews.find((r) => r.dept === dept);
    if (!review || review.decidedOn) continue;
    const rc = reviewClock(c, dept, today);
    if (!rc) continue;
    if (!slowest || rc.day - rc.of > slowest.day - slowest.of) slowest = rc;
  }
  return slowest;
}

/** True while this case's date hold expires tomorrow: a case that needs attention today, not yet an error. */
export function isHoldExpiringTomorrow(hold: DateHold, today: ISODate): boolean {
  return hold.status === "held" && hold.expiresOn === addDaysISO(today, 1);
}

/* ---------- overview tab ---------- */

// Shared with the wizard's recap; re-exported so the Overview tab's callers keep their import.
export { seriesSummary };

function mapHighlightFor(c: EventCase): MapHighlight | null {
  if (!c.location) return null;
  const status: MapHighlight["status"] =
    c.state === "permitted" || c.state === "event_day" || c.state === "closeout"
      ? "permitted"
      : c.dateHold.status === "held"
        ? "held"
        : "pending";
  return { id: c.id, location: c.location, status, tier: c.tier, label: c.location.label };
}

export interface OverviewData {
  rows: KeyValueItem[];
  triggers: Trigger[];
  components: PermitComponent[];
  mapHighlight: MapHighlight | null;
}

/**
 * The Overview tab's event summary: type, description, place, date, setup/teardown, sessions,
 * attendance, add-ons. "What the permit covers" is the record's own list (`permitCovers()`): the
 * plan the permit is for while an amendment is pending, and never the tier rules re-read as
 * Settings has them now.
 */
export function buildOverview(c: EventCase): OverviewData {
  const sched = c.schedule;
  const rows: KeyValueItem[] = [
    { label: "Event type", value: c.eventType ? EVENT_TYPE_LABEL[c.eventType] : null },
    { label: "Description", value: c.description || null },
    { label: "Place", value: c.location?.label ?? null },
    { label: "Date and hours", value: sched ? `${fmtDate(sched.date)}, ${fmtTimeRange(sched.start, sched.end)}` : null },
    { label: "Setup and teardown", value: setupTeardownText(c) },
    // A single event has no sessions to list: the row is left out, not shown as "Not provided".
    ...(sched?.recurrence ? [{ label: "Sessions", value: seriesSummary(c) }] : []),
    { label: "Attendance", value: c.attendance !== null ? fmtNumber(c.attendance) : null },
    // No add-ons is an answer ("None"), not a missing one.
    { label: "Add-ons", value: addOnsSummary(c) ?? "None" },
  ];
  return { rows, triggers: c.triggers, components: permitCovers(c), mapHighlight: mapHighlightFor(c) };
}

/* ---------- documents tab ---------- */

export interface DocumentGroup {
  dept: Dept;
  cards: Task[];
}

const DOCUMENT_KINDS: Task["kind"][] = ["document", "form"];

function carriesFilesOrForm(t: Task): boolean {
  if (DOCUMENT_KINDS.includes(t.kind)) return true;
  if ((t.payload.files?.length ?? 0) > 0) return true;
  if (t.payload.form && Object.keys(t.payload.form).length > 0) return true;
  return false;
}

/** Every applicant card that carries files or a form, in the order the plan created them. */
export function documentCards(c: EventCase): Task[] {
  return c.tasks.filter((t) => t.owner === "applicant" && carriesFilesOrForm(t));
}

/** Documents grouped by the department that reviews them (the Clerk for its own, e.g. the community notice). */
export function documentGroups(c: EventCase): DocumentGroup[] {
  const byDept = new Map<Dept, Task[]>();
  for (const t of documentCards(c)) {
    const dept = t.reviewer ?? "clerk";
    const list = byDept.get(dept);
    if (list) list.push(t);
    else byDept.set(dept, [t]);
  }
  return DEPTS.filter((d) => byDept.has(d)).map((dept) => ({ dept, cards: byDept.get(dept)! }));
}

/**
 * A card's form as rows a person can read (labels, Yes or No, 12-hour times, a list entry per
 * line). The Documents tab and the Verify and Send back panels print these; the formatter is
 * shared with the applicant's board (see ./cardForms).
 */
export { formRows, type FormRow } from "@/lib/view/cardForms";

/* ---------- reviews tab ---------- */

export interface ReviewSummary {
  dept: Dept;
  routed: boolean;
  review: Review | null;
  conditions: Condition[];
  feeLines: FeeLine[];
  isOwn: boolean;
}

/** One row per department, in order, whether routed or not: Reviews tab and the routing summary. */
export function reviewSummaries(c: EventCase, role: Party): ReviewSummary[] {
  return DEPTS.map((dept) => {
    const review = c.reviews.find((r) => r.dept === dept) ?? null;
    return {
      dept,
      routed: review !== null,
      review,
      conditions: c.conditions.filter((cond) => cond.dept === dept),
      feeLines: c.feeLines.filter((f) => f.dept === dept && f.kind !== "deposit"),
      isOwn: dept === role,
    };
  });
}

/** Where a card of a pending amendment stands, as the end of a sentence. */
const AMENDMENT_CARD_WHERE: Record<Task["status"], string> = {
  locked: "not open yet",
  todo: "with the applicant",
  submitted: "being checked",
  changes_requested: "sent back to the applicant",
  done: "checked",
};

/**
 * What the Reviews tab says of a department that has no review on the case. A department named
 * on a card before routing is waiting for it. One named on a card a pending amendment added is
 * not: an amendment is never routed, its cards are checked one by one (the department has
 * "Verify Sound details" in its queue), so the line says that and where each card is.
 */
export function unroutedDeptNote(c: EventCase, dept: Dept): string {
  if (dept === "clerk") return "No license review on this case.";
  if (c.ending) return "This case ended before it could be routed here.";
  const named = c.tasks.filter((t) => t.owner === "applicant" && t.reviewer === dept);
  const amending = c.flags.amendmentPending ? named.filter((t) => t.tags.includes("amendment")) : [];
  if (amending.length > 0) {
    return `Checks the amendment's ${amending.length === 1 ? "card" : "cards"}: ${amending.map((t) => `${t.title} (${AMENDMENT_CARD_WHERE[t.status]})`).join(", ")}.`;
  }
  if (named.length > 0) return `Named on ${named.length === 1 ? "a card" : "cards"} (${named.map((t) => t.title).join(", ")}), waiting for routing.`;
  return "The City Clerk has not routed this case to this department.";
}

/* ---------- activity tab ---------- */

/** Every actor who has an entry, in first-appearance order: the filter's options. */
export function activityActors(c: EventCase): Actor[] {
  const seen = new Set<Actor>();
  const list: Actor[] = [];
  for (const entry of c.activity) {
    if (!seen.has(entry.actor)) {
      seen.add(entry.actor);
      list.push(entry.actor);
    }
  }
  return list;
}

/** Newest first, optionally narrowed to one actor. */
export function filterActivity(c: EventCase, actor: Actor | "all") {
  const items = [...c.activity].reverse();
  return actor === "all" ? items : items.filter((entry) => entry.actor === actor);
}

export interface ActivityDayGroup {
  day: ISODate;
  items: Activity[];
}

/** `filterActivity()`'s list (already newest first), grouped by the calendar day each entry fell on. */
export function groupActivityByDay(items: Activity[]): ActivityDayGroup[] {
  const groups: ActivityDayGroup[] = [];
  for (const item of items) {
    const day = item.at.slice(0, 10) as ISODate;
    const last = groups.at(-1);
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
}

/**
 * The most recent moment this role itself wrote an activity entry. A city role's own actor
 * name is the same string as its Party, so this reads directly off `activity`; null when the
 * viewing role has never acted on this case (nothing to mark as "since").
 */
export function lastActedAt(c: EventCase, role: Party): ISODateTime | null {
  for (let i = c.activity.length - 1; i >= 0; i--) {
    if (c.activity[i].actor === role) return c.activity[i].at;
  }
  return null;
}

/**
 * Where the "Since you last acted" marker goes in a newest-first list: the number of entries at
 * the top that happened after `lastActed`. 0 means nothing has happened since (no marker to
 * show); null means this role has never acted (nothing to compare against, so no marker either).
 */
export function sinceLastActedCount(items: Activity[], lastActed: ISODateTime | null): number | null {
  if (lastActed === null) return null;
  const index = items.findIndex((item) => item.at <= lastActed);
  return index === -1 ? items.length : index;
}

/* ---------- action panels ---------- */

/** The sticky panel's own rows open their action's panel directly: the row's type is the key. */
export function openKeyForAction(type: ActionType): string {
  return type;
}

/** `"review_decide:pws"` -> `{ action: "review_decide", arg: "pws" }`; `"issue_permit"` -> no arg. */
export function parseOpenKey(key: string): { action: ActionType; arg?: string } {
  const sep = key.indexOf(":");
  if (sep === -1) return { action: key as ActionType };
  return { action: key.slice(0, sep) as ActionType, arg: key.slice(sep + 1) };
}

/** The action (and its argument) that advances a city-owned task, independent of who is looking. */
function cityTaskAction(c: EventCase, task: Task): { action: ActionType; arg?: string } | null {
  const id = task.catalogId;
  if (id === "intake_check") return { action: "accept_complete" };
  if (id === "confirm_routing") return { action: "confirm_routing" };
  if (id === "schedule_pre_application_meeting") {
    const card = meetingCardFor(c, task.id);
    return card ? { action: "schedule_meeting", arg: card.id } : null;
  }
  if (id.startsWith("review:")) return { action: "review_decide", arg: task.owner };
  if (id.startsWith("verify:")) {
    const card = cardUnderVerification(c, task);
    return card ? { action: "verify_document", arg: card.id } : null;
  }
  if (id === "consolidate") return { action: task.payload.denied === true ? "deny" : "send_quote" };
  if (id === "issue_permit") return { action: "issue_permit" };
  // An Instant event's closeout exception (a damage report) is settled by reconciling it.
  if (id === "instant_exception") return { action: "reconcile_close" };
  if (id.startsWith("work_order:") || id === "issue_food_permits") return { action: "complete_city_task", arg: task.id };
  if (id === "cleanup_inspection" || id === "log_actual_hours") return { action: "log_closeout" };
  if (id === "reconcile") return { action: "reconcile_close" };
  if (id === "decide_amendment") return { action: "decide_amendment" };
  return null;
}

/**
 * What selecting a task from Who's up opens, for the current viewer. An applicant's own card,
 * or another department's, is not this viewer's to act on: it opens a reminder addressed to
 * whoever holds it instead. Returns null when nothing is mapped (so the click is a no-op).
 */
export function openKeyForTask(c: EventCase, task: Task, role: Party): string | null {
  // A meeting card is the applicant's, but the city runs the meeting: the Clerk, or the
  // department that holds it, sets its date and closes it once it has been held. Nobody else
  // can finish the card, so without this it stays "Up now" for good.
  if (task.owner === "applicant" && task.kind === "meeting" && task.status !== "done" && (role === "clerk" || role === task.reviewer)) {
    return `${task.payload.scheduledFor ? "complete_city_task" : "schedule_meeting"}:${task.id}`;
  }
  if (task.owner === "applicant") return "remind:applicant";
  if (task.owner !== role) return `remind:${task.owner}`;
  const mapped = cityTaskAction(c, task);
  if (!mapped) return null;
  return mapped.arg ? `${mapped.action}:${mapped.arg}` : mapped.action;
}

/**
 * What `?task=` opens, as an open key. The param holds either a task's id, which is what a
 * link from outside carries (a My queue row, an Intake row, a Who's up task): that opens the
 * panel that moves the task on for this viewer. Or it holds an open key already, which is what
 * this screen's own buttons write. Null when it names neither, so the sheet stays shut.
 */
export function resolveOpenKey(c: EventCase, param: string | null, role: Party): string | null {
  if (!param) return null;
  const task = c.tasks.find((t) => t.id === param);
  if (task) return openKeyForTask(c, task, role);
  return (ACTION_TYPES as string[]).includes(parseOpenKey(param).action) ? param : null;
}

/**
 * The viewer's own open tasks that the sticky panel has no row for. `availableActions()` lists
 * what a role can do in a state, never a task: a document to verify, a work order, a meeting to
 * schedule. Each is the role's real next step, and Who's up, which lists it, is on the Overview
 * tab only. A task whose panel a row already opens (a review, the intake check, the closeout
 * log) is left to that row. `openTasks` is the viewer's own row of `waitingOn()`.
 */
export function ownTaskRows(c: EventCase, role: Party, openTasks: Task[], actions: ActionAvailability[]): Task[] {
  const covered = new Set<string>(actions.map((action) => openKeyForAction(action.type)));
  return openTasks.filter((task) => {
    const key = openKeyForTask(c, task, role);
    return key !== null && !covered.has(parseOpenKey(key).action);
  });
}

/** True when the role's action panel has nothing enabled or disabled to show at all. */
export function hasNothingToDo(actions: ActionAvailability[]): boolean {
  return actions.length === 0;
}
