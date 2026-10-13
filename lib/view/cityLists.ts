/**
 * Pure view-model for workstream 3E: My queue, Cases pipeline and Intake queue. No React, no
 * store: the screens read `useDemo` and pass plain values in. Tested against the real seed in
 * cityLists.test.ts.
 */
import { CARD_BY_ID, type CardSpec, type CatalogId } from "@/lib/rules/catalog";
import { availability, occupiedWindow, occurrences } from "@/lib/rules";
import type { RulesConfig, RulesCtx } from "@/lib/rules/types";
import { daysBetween } from "@/lib/dates";
import { PERSONA_BY_ID } from "@/lib/data/people";
import type { CasesFilters, CasesView } from "@/lib/routes";
import {
  availableActions,
  eventDate,
  involves,
  isOpen,
  isVisibleToCity,
  leadTimeRisk,
  queueFor,
  waitingOn,
  waitingOnOthers,
  whoIsUp,
  type ActionAvailability,
  type PartyStatus,
  type QueueGroup,
  type QueueItem,
  type WaitingOnOthersItem,
} from "@/lib/state";
import { PARTY_LABEL, STATE_LABEL, TIER_LABEL, type CaseState, type Dept, type EventCase, type ISODate, type Party, type Tier } from "@/lib/types";

/* ------------------------------------------------------------------------ */
/* My queue                                                                  */
/* ------------------------------------------------------------------------ */

export interface QueueGroups {
  overdue: QueueItem[];
  this_week: QueueItem[];
  later: QueueItem[];
}

const GROUP_ORDER: QueueGroup[] = ["overdue", "this_week", "later"];

/** `queueFor()`'s flat list, split into the three groups the brief's home screen shows. */
export function queueGroups(cases: EventCase[], role: Dept, today: ISODate): QueueGroups {
  const items = queueFor(cases, role, today);
  const groups: QueueGroups = { overdue: [], this_week: [], later: [] };
  for (const item of items) groups[item.group].push(item);
  return groups;
}

export function queueTotal(groups: QueueGroups): number {
  return groups.overdue.length + groups.this_week.length + groups.later.length;
}

/**
 * The briefing line: "5 things need you: 1 overdue, 3 due this week." Counts every group but
 * only names overdue and this-week, since those are the two that change what the role does
 * today. A queue with only "later" rows still gets a total, with no breakdown.
 */
export function queueBriefing(groups: QueueGroups): string {
  const total = queueTotal(groups);
  const subject = total === 1 ? "1 thing" : `${total} things`;
  const verb = total === 1 ? "needs" : "need";
  const parts: string[] = [];
  if (groups.overdue.length > 0) parts.push(`${groups.overdue.length} overdue`);
  if (groups.this_week.length > 0) parts.push(`${groups.this_week.length} due this week`);
  return parts.length > 0 ? `${subject} ${verb} you: ${parts.join(", ")}.` : `${subject} ${verb} you.`;
}

/** Cases this role is involved in where someone else is up, each with who and since when. */
export function queueWaitingOnOthers(cases: EventCase[], role: Dept, today: ISODate): WaitingOnOthersItem[] {
  return waitingOnOthers(cases, role, today);
}

/** The empty-queue line: "Nothing is waiting on you. 4 cases are with other parties." */
export function emptyQueueMessage(others: WaitingOnOthersItem[]): string {
  if (others.length === 0) return "Nothing is waiting on you.";
  const noun = others.length === 1 ? "case is" : "cases are";
  return `Nothing is waiting on you. ${others.length} ${noun} with other parties.`;
}

/** For a reviewer's row: the triggers that routed the case, in plain words. */
export function triggerLabels(c: EventCase): string[] {
  return c.triggers.map((t) => t.label);
}

/** The order the three groups render in, each with its label. */
export const QUEUE_GROUP_LABEL: Record<QueueGroup, string> = {
  overdue: "Overdue",
  this_week: "Due this week",
  later: "Later",
};

export function orderedQueueGroups(): QueueGroup[] {
  return GROUP_ORDER;
}

/* ------------------------------------------------------------------------ */
/* Cases pipeline: shared filtering                                         */
/* ------------------------------------------------------------------------ */

export const PIPELINE_BOARD_STATES: CaseState[] = ["submitted", "in_review", "needs_info", "quote_sent", "permitted", "event_day", "closeout"];

export type SortField = "event_date" | "due" | "state" | "waiting";
export type SortDir = "asc" | "desc";

/** Everything the Cases pipeline keeps in the URL: the PRD's filters plus view, sort and the toggle. */
export interface CasesListFilters {
  tier?: Tier;
  state?: CaseState | "off_path";
  waiting?: "me" | Party;
  from?: ISODate;
  to?: ISODate;
  involvesMe: boolean;
  closedAndEnded: boolean;
  q: string;
  view: CasesView;
  sort: SortField;
  dir: SortDir;
}

/** Public Works & Safety and Health & Legal start with "Involves me" on; the Clerk starts off. */
export function defaultInvolvesMe(role: Party): boolean {
  return role !== "clerk" && role !== "applicant";
}

const SORT_FIELDS: SortField[] = ["event_date", "due", "state", "waiting"];
const SORT_DIRS: SortDir[] = ["asc", "desc"];

/** Parses the Cases pipeline's URL into a filters object, filling in this role's defaults. */
export function parseCasesFilters(search: URLSearchParams, role: Party): CasesListFilters {
  const tier = search.get("tier");
  const state = search.get("state");
  const waiting = search.get("waiting");
  const involvesParam = search.get("involves");
  return {
    tier: tier === "instant" || tier === "reviewed" || tier === "special" ? tier : undefined,
    state: isCaseStateOrOffPath(state) ? state : undefined,
    waiting: isWaitingValue(waiting) ? waiting : undefined,
    from: search.get("from") || undefined,
    to: search.get("to") || undefined,
    involvesMe: involvesParam === null ? defaultInvolvesMe(role) : involvesParam === "1",
    closedAndEnded: search.get("closed") === "1",
    q: search.get("q") ?? "",
    view: search.get("view") === "table" ? "table" : "board",
    sort: SORT_FIELDS.includes(search.get("sort") as SortField) ? (search.get("sort") as SortField) : "event_date",
    dir: SORT_DIRS.includes(search.get("dir") as SortDir) ? (search.get("dir") as SortDir) : "asc",
  };
}

function isCaseStateOrOffPath(value: string | null): value is CaseState | "off_path" {
  if (value === null) return false;
  return value === "off_path" || Object.hasOwn(STATE_LABEL, value);
}

function isWaitingValue(value: string | null): value is "me" | Party {
  return value === "me" || value === "applicant" || value === "clerk" || value === "pws" || value === "hl";
}

/** The filters as `CasesFilters` for `routes.city.cases()`, plus the three keys it does not carry. */
export function casesFiltersToParams(filters: CasesListFilters, role: Party): Record<string, string | undefined> {
  const base: CasesFilters & Record<string, string | undefined> = {
    view: filters.view === "board" ? undefined : filters.view,
    tier: filters.tier,
    state: filters.state,
    waiting: filters.waiting,
    from: filters.from,
    to: filters.to,
    involves: filters.involvesMe === defaultInvolvesMe(role) ? undefined : filters.involvesMe ? "1" : "0",
    q: filters.q || undefined,
  };
  return {
    ...base,
    closed: filters.closedAndEnded ? "1" : undefined,
    sort: filters.sort === "event_date" ? undefined : filters.sort,
    dir: filters.dir === "asc" ? undefined : filters.dir,
  };
}

/** `casesFiltersToParams()`, flattened into a query string ready to append after `?`. */
export function casesQueryString(filters: CasesListFilters, role: Party): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(casesFiltersToParams(filters, role))) {
    if (value !== undefined && value !== "") params.set(key, value);
  }
  return params.toString();
}

/** `PERSONA_BY_ID[c.applicantId].name`, falling back to the id for a persona not in the data. */
export function applicantNameOf(c: EventCase): string {
  return PERSONA_BY_ID[c.applicantId]?.name ?? c.applicantId;
}

function matchesSearch(c: EventCase, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return c.name.toLowerCase().includes(needle) || applicantNameOf(c).toLowerCase().includes(needle) || c.id.toLowerCase().includes(needle);
}

/** Every case the Cases pipeline can show for this role, before sorting: drafts are never city cases. */
export function filteredCases(cases: EventCase[], role: Party, filters: CasesListFilters, today: ISODate): EventCase[] {
  return cases.filter((c) => {
    if (!isVisibleToCity(c)) return false;
    const endedOrClosed = c.ending !== null || c.state === "closed";
    if (!filters.closedAndEnded && endedOrClosed) return false;
    if (filters.involvesMe && !involves(c, role)) return false;
    if (filters.tier && c.tier !== filters.tier) return false;
    if (filters.state) {
      if (filters.state === "off_path") {
        if (c.ending === null) return false;
      } else if (c.state !== filters.state) {
        return false;
      }
    }
    if (filters.waiting) {
      const party = filters.waiting === "me" ? role : filters.waiting;
      if (!whoIsUp(c, today).includes(party)) return false;
    }
    const date = eventDate(c, today);
    if (filters.from && (date ?? "") < filters.from) return false;
    if (filters.to && (date ?? "9999-12-31") > filters.to) return false;
    if (!matchesSearch(c, filters.q)) return false;
    return true;
  });
}

/** Removable chips for the filters that narrow the list (not the two on/off toggles). */
export interface FilterChipView {
  key: "tier" | "state" | "waiting" | "dates" | "q";
  label: string;
}

export function activeFilterChips(filters: CasesListFilters): FilterChipView[] {
  const chips: FilterChipView[] = [];
  if (filters.tier) chips.push({ key: "tier", label: TIER_LABEL[filters.tier] });
  if (filters.state) chips.push({ key: "state", label: filters.state === "off_path" ? "Closed or ended" : STATE_LABEL[filters.state] });
  if (filters.waiting) chips.push({ key: "waiting", label: `Waiting on ${filters.waiting === "me" ? "me" : PARTY_LABEL[filters.waiting]}` });
  if (filters.from || filters.to) chips.push({ key: "dates", label: `Event date ${filters.from ?? "any"} – ${filters.to ?? "any"}` });
  if (filters.q) chips.push({ key: "q", label: `"${filters.q}"` });
  return chips;
}

/* ------------------------------------------------------------------------ */
/* Cases pipeline: board                                                    */
/* ------------------------------------------------------------------------ */

/** One column per state, each already in event-date order. Columns with no case stay, empty. */
export function pipelineBoardColumns(cases: EventCase[], today: ISODate): Record<CaseState, EventCase[]> {
  const columns = Object.fromEntries(PIPELINE_BOARD_STATES.map((s) => [s, [] as EventCase[]])) as Record<CaseState, EventCase[]>;
  const sorted = [...cases].sort((a, b) => (eventDate(a, today) ?? "9999-12-31").localeCompare(eventDate(b, today) ?? "9999-12-31"));
  for (const c of sorted) {
    if (c.state in columns) columns[c.state as CaseState].push(c);
  }
  return columns;
}

/** A board card's "Waiting on" row: the parties up now, with the days they have held it. */
export function boardCardWaiting(c: EventCase, today: ISODate): { party: Party; days: number }[] {
  return waitingOn(c, today)
    .filter((p) => p.status === "up_now")
    .map((p) => ({ party: p.party, days: p.daysHolding }));
}

/* ------------------------------------------------------------------------ */
/* Cases pipeline: table                                                    */
/* ------------------------------------------------------------------------ */

function deptStatusOf(c: EventCase, dept: Dept) {
  return c.reviews.find((r) => r.dept === dept)?.status ?? "not_routed";
}

export interface PipelineTableRow {
  case: EventCase;
  waitingOn: { party: Party; days: number }[];
  nextAction: string;
  due: ISODate | null;
  daysWaiting: number;
  deptStatus: { dept: Dept; status: ReturnType<typeof deptStatusOf> }[];
  leadTimeRisk: "ok" | "at_risk";
}

/** The table's row model: one row per case, with the fields the brief's table lists. */
export function pipelineTableRow(c: EventCase, today: ISODate, cfg: RulesConfig): PipelineTableRow {
  const parties = waitingOn(c, today);
  const upNow = parties.filter((p) => p.status === "up_now");
  const firstTask = upNow.map((p) => p.openTasks[0]).find((t) => t !== undefined);
  const due = upNow
    .map((p) => p.oldestDue)
    .filter((d): d is ISODate => d !== null)
    .sort()
    .at(0) ?? null;
  const depts: Dept[] = c.reviews.some((r) => r.dept === "clerk") ? ["clerk", "pws", "hl"] : ["pws", "hl"];
  return {
    case: c,
    waitingOn: upNow.map((p) => ({ party: p.party, days: p.daysHolding })),
    nextAction: c.ending ? `Ended: ${c.ending.replace("_", " ")}` : firstTask ? firstTask.title : "Nothing actionable",
    due,
    daysWaiting: Math.max(0, ...upNow.map((p) => p.daysHolding), 0),
    deptStatus: depts.map((dept) => ({ dept, status: deptStatusOf(c, dept) })),
    leadTimeRisk: leadTimeRisk(c, today, cfg),
  };
}

export function pipelineTableRows(cases: EventCase[], today: ISODate, cfg: RulesConfig): PipelineTableRow[] {
  return cases.map((c) => pipelineTableRow(c, today, cfg));
}

const STATE_SORT_ORDER: CaseState[] = ["draft", "submitted", "in_review", "needs_info", "quote_sent", "permitted", "event_day", "closeout", "closed"];

function compareBy(a: PipelineTableRow, b: PipelineTableRow, field: SortField, today: ISODate): number {
  switch (field) {
    case "event_date": {
      const da = eventDate(a.case, today) ?? "9999-12-31";
      const db = eventDate(b.case, today) ?? "9999-12-31";
      return da.localeCompare(db);
    }
    case "due": {
      const da = a.due ?? "9999-12-31";
      const db = b.due ?? "9999-12-31";
      return da.localeCompare(db);
    }
    case "state":
      return STATE_SORT_ORDER.indexOf(a.case.state) - STATE_SORT_ORDER.indexOf(b.case.state);
    case "waiting":
      return a.daysWaiting - b.daysWaiting;
  }
}

/** Sorts a copy of the rows; ties keep the case id order so the result is stable. */
export function sortTableRows(rows: PipelineTableRow[], sort: SortField, dir: SortDir, today: ISODate): PipelineTableRow[] {
  const sorted = [...rows].sort((a, b) => compareBy(a, b, sort, today) || a.case.id.localeCompare(b.case.id));
  return dir === "desc" ? sorted.reverse() : sorted;
}

/* ------------------------------------------------------------------------ */
/* Intake queue                                                             */
/* ------------------------------------------------------------------------ */

export type IntakeTab = "special" | "reviewed" | "instant";

export const INTAKE_TABS: IntakeTab[] = ["special", "reviewed", "instant"];

export const INTAKE_TAB_LABEL: Record<IntakeTab, string> = {
  special: "Special",
  reviewed: "Reviewed",
  instant: "Instant exceptions",
};

function submittedUnacceptedCases(cases: EventCase[]): EventCase[] {
  return cases.filter((c) => c.ending === null && c.state === "submitted" && !c.flags.acceptedComplete);
}

function instantExceptionCases(cases: EventCase[]): EventCase[] {
  return cases.filter(
    (c) => c.ending === null && c.tier === "instant" && c.tasks.some((t) => t.catalogId === "instant_exception" && (t.status === "todo" || t.status === "changes_requested")),
  );
}

export function intakeCasesFor(cases: EventCase[], tab: IntakeTab): EventCase[] {
  if (tab === "instant") return instantExceptionCases(cases);
  return submittedUnacceptedCases(cases).filter((c) => c.tier === tab);
}

export function intakeCounts(cases: EventCase[]): Record<IntakeTab, number> {
  return {
    special: intakeCasesFor(cases, "special").length,
    reviewed: intakeCasesFor(cases, "reviewed").length,
    instant: intakeCasesFor(cases, "instant").length,
  };
}

/**
 * "7 of 8 items": the case's pre-submit cards, done or submitted over the total. A block
 * party's neighbor sign-offs stand in for that count instead, since that is what intake is
 * really waiting on (the Clerk cannot accept until every household has signed).
 */
export function intakeCompleteness(c: EventCase): { done: number; total: number } {
  const signoff = c.tasks.find((t) => t.catalogId === "neighbor_signoff");
  if (signoff?.payload.progress) return { done: signoff.payload.progress.done, total: signoff.payload.progress.total };
  const items = c.tasks.filter((t) => t.owner === "applicant" && (CARD_BY_ID as Record<string, CardSpec>)[t.catalogId as CatalogId]?.preSubmit);
  const done = items.filter((t) => t.status === "submitted" || t.status === "done").length;
  return { done, total: items.length };
}

const HOLD_SUFFIX = " has this date held";

function competingLabel(reason: string): string {
  const name = reason.endsWith(HOLD_SUFFIX) ? reason.slice(0, -HOLD_SUFFIX.length) : reason;
  return `Competing with ${name} — complete first`;
}

/**
 * Any other case holding this one's space and date, found with `rules.availability()` exactly
 * as `accept_complete`'s own check does, so the note on the row never disagrees with the
 * button. Null when nothing conflicts.
 */
export function competingApplication(c: EventCase, cases: EventCase[], cfg: RulesConfig, today: ISODate): { reason: string } | null {
  if (!c.location || !c.schedule) return null;
  const ctx: RulesCtx = { today, cases, cfg };
  const window = occupiedWindow(c.schedule);
  for (const occ of occurrences(c.schedule, c.location, ctx, c.id)) {
    const result = availability(c.location, { date: occ.date, start: window.start, end: window.end }, ctx, c.id);
    if (result.status === "booked") return { reason: competingLabel(result.reason ?? "Another application holds this date.") };
  }
  return null;
}

export interface IntakeRow {
  case: EventCase;
  completeness: { done: number; total: number };
  competing: { reason: string } | null;
  risk: "ok" | "at_risk";
  daysInIntake: number;
  accept: ActionAvailability;
  requestInfo: ActionAvailability;
  intakeTaskId: string;
}

const DISABLED_ACCEPT: ActionAvailability = { type: "accept_complete", label: "Accept as complete", enabled: false, reason: "Not available for this case." };
const DISABLED_REQUEST: ActionAvailability = { type: "request_info", label: "Request information", enabled: false };

/** The Special and Reviewed tabs' rows, oldest submission first. */
export function intakeRows(cases: EventCase[], tab: Exclude<IntakeTab, "instant">, today: ISODate, cfg: RulesConfig): IntakeRow[] {
  const ctx: RulesCtx = { today, cases, cfg };
  return intakeCasesFor(cases, tab)
    .map((c) => {
      const actions = availableActions(c, "clerk", ctx);
      const submittedOn = (c.submittedAt ?? c.createdAt).slice(0, 10);
      return {
        case: c,
        completeness: intakeCompleteness(c),
        competing: competingApplication(c, cases, cfg, today),
        risk: leadTimeRisk(c, today, cfg),
        daysInIntake: Math.max(0, daysBetween(submittedOn, today)),
        accept: actions.find((a) => a.type === "accept_complete") ?? DISABLED_ACCEPT,
        requestInfo: actions.find((a) => a.type === "request_info") ?? DISABLED_REQUEST,
        intakeTaskId: `${c.id}:intake_check`,
      };
    })
    .sort((a, b) => (a.case.submittedAt ?? a.case.createdAt).localeCompare(b.case.submittedAt ?? b.case.createdAt));
}

export interface InstantExceptionRow {
  case: EventCase;
  task: { id: string; title: string } | null;
  daysInCloseout: number;
}

export function instantExceptionRows(cases: EventCase[], today: ISODate): InstantExceptionRow[] {
  return instantExceptionCases(cases)
    .map((c) => {
      const task = c.tasks.find((t) => t.catalogId === "instant_exception") ?? null;
      const since = c.closeout.hoursLoggedOn ?? taskOpenedOn(c);
      return { case: c, task: task ? { id: task.id, title: task.title } : null, daysInCloseout: Math.max(0, daysBetween(since, today)) };
    })
    .sort((a, b) => a.case.id.localeCompare(b.case.id));
}

function taskOpenedOn(c: EventCase): ISODate {
  const task = c.tasks.find((t) => t.catalogId === "instant_exception");
  return (task?.history.at(-1)?.at ?? c.createdAt).slice(0, 10);
}

/* ------------------------------------------------------------------------ */
/* Shared                                                                    */
/* ------------------------------------------------------------------------ */

export function isOpenCase(c: EventCase): boolean {
  return isOpen(c);
}

export function waitingOnForCase(c: EventCase, today: ISODate): PartyStatus[] {
  return waitingOn(c, today);
}
