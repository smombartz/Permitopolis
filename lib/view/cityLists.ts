/**
 * Pure view-model for workstream 3E: My queue, Cases pipeline and Intake queue. No React, no
 * store: the screens read `useDemo` and pass plain values in. Tested against the real seed in
 * cityLists.test.ts.
 */
import { CARD_BY_ID, type CardSpec, type CatalogId } from "@/lib/rules/catalog";
import { availability, occupiedWindow, occurrences } from "@/lib/rules";
import type { RulesConfig, RulesCtx } from "@/lib/rules/types";
import { daysBetween } from "@/lib/dates";
import { fmtMonthDay } from "@/lib/format";
import { applicantNameOf } from "@/lib/data/people";
import type { CasesFilters, CasesView } from "@/lib/routes";
import {
  availableActions,
  cardUnderVerification,
  eventDate,
  involves,
  isOpen,
  isStalled,
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
import { ENDING_LABEL, PARTY_LABEL, STATE_LABEL, TIER_LABEL, type CaseState, type Dept, type EventCase, type ISODate, type Party, type Task, type Tier } from "@/lib/types";

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

/** The day a task most recently became actionable (todo or changes requested), for the reason line. */
function lastOpenedOn(task: Task): ISODate | null {
  const opened = [...task.history].reverse().find((h) => h.status === "todo" || h.status === "changes_requested");
  return opened ? (opened.at.slice(0, 10) as ISODate) : null;
}

/**
 * A one-line reason a queue row is this role's move, e.g. "Insurance certificate re-uploaded
 * Apr 30", "Routed Apr 20", "A reviewer denied". Officials triage by deadline more than by
 * state (the PRD's push); this is the "why now" a due date alone does not say.
 */
export function queueReasonLine(item: QueueItem): string {
  const { case: c, task } = item;
  const when = lastOpenedOn(task);
  const since = when ? fmtMonthDay(when) : null;

  if (task.catalogId.startsWith("verify:")) {
    const card = cardUnderVerification(c, task);
    if (card) return since ? `${card.title} re-uploaded ${since}` : `${card.title} re-uploaded`;
  }
  if (task.catalogId.startsWith("review:")) return since ? `Routed ${since}` : "Routed";
  if (task.catalogId === "intake_check") return c.submittedAt ? `Submitted ${fmtMonthDay(c.submittedAt)}` : "Submitted";
  if (task.catalogId === "confirm_routing") return since ? `Accepted as complete ${since}` : "Accepted as complete";
  if (task.catalogId === "consolidate") return task.payload.denied === true ? "A reviewer denied" : "Every review is in";
  if (task.catalogId === "issue_permit") return "Signed, paid and verified";
  if (task.catalogId.startsWith("work_order:")) return since ? `Permitted ${since}` : "Permitted";
  if (task.status === "changes_requested") return since ? `Changes requested ${since}` : "Changes requested";
  return since ? `Opened ${since}` : task.title;
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

/** The board's "Group by" (plan 8, 4F): State is the default; Event date buckets by deadline. */
export type BoardGroupBy = "state" | "event_date";

/** The table's density toggle. */
export type TableDensity = "comfortable" | "compact";

/** Every table column that can be shown or hidden; the event's name, date and state are always on. */
export const TOGGLABLE_TABLE_COLUMNS = ["id", "tier", "waiting", "next_action", "due", "depts", "risk"] as const;
export type TableColumn = (typeof TOGGLABLE_TABLE_COLUMNS)[number];

/** Fits 1280px with the sidebar, no horizontal scroll; "Next action" and "Depts" are opt-in. */
export const DEFAULT_TABLE_COLUMNS: TableColumn[] = ["tier", "waiting", "due", "risk"];

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
  /** The board's grouping; the table is unaffected. */
  groupBy: BoardGroupBy;
  /** The table's visible optional columns. */
  columns: TableColumn[];
  density: TableDensity;
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
    from: isoDateParam(search.get("from")),
    to: isoDateParam(search.get("to")),
    involvesMe: involvesParam === null ? defaultInvolvesMe(role) : involvesParam === "1",
    closedAndEnded: search.get("closed") === "1",
    q: search.get("q") ?? "",
    view: search.get("view") === "table" ? "table" : "board",
    sort: SORT_FIELDS.includes(search.get("sort") as SortField) ? (search.get("sort") as SortField) : "event_date",
    dir: SORT_DIRS.includes(search.get("dir") as SortDir) ? (search.get("dir") as SortDir) : "asc",
    groupBy: search.get("group") === "event_date" ? "event_date" : "state",
    columns: parseTableColumns(search.get("cols")),
    density: search.get("density") === "compact" ? "compact" : "comfortable",
  };
}

/**
 * A hand-edited or stale `cols` list is filtered to the columns that still exist; a missing or
 * garbled one is the default set, and "none" (how every column hidden round-trips) is empty.
 */
function parseTableColumns(raw: string | null): TableColumn[] {
  if (raw === null) return DEFAULT_TABLE_COLUMNS;
  if (raw === "none") return [];
  const known = raw.split(",").filter((c): c is TableColumn => (TOGGLABLE_TABLE_COLUMNS as readonly string[]).includes(c));
  return known.length > 0 ? known : DEFAULT_TABLE_COLUMNS;
}

function sameColumns(a: TableColumn[], b: TableColumn[]): boolean {
  return a.length === b.length && TOGGLABLE_TABLE_COLUMNS.every((c) => a.includes(c) === b.includes(c));
}

/** A date param is a date or nothing: anything else in the URL (a hand-edited link) is ignored, not shown. */
function isoDateParam(value: string | null): ISODate | undefined {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : undefined;
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
    group: filters.groupBy === "state" ? undefined : filters.groupBy,
    cols: sameColumns(filters.columns, DEFAULT_TABLE_COLUMNS) ? undefined : filters.columns.length === 0 ? "none" : filters.columns.join(","),
    density: filters.density === "comfortable" ? undefined : filters.density,
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
    // Asking for Closed, or for the endings, is asking to see them: a link from elsewhere
    // (`routes.city.cases({ state: "closed" })`) needs no second switch.
    const askedFor = filters.state === "closed" || filters.state === "off_path";
    if (!filters.closedAndEnded && !askedFor && endedOrClosed) return false;
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

/** "Event date Jun 1 to Aug 1", "Event date from Jun 1", "Event date to Aug 1": never a raw ISO date. */
function dateRangeLabel(from: ISODate | undefined, to: ISODate | undefined): string {
  if (from && to) return `Event date ${fmtMonthDay(from)} to ${fmtMonthDay(to)}`;
  return from ? `Event date from ${fmtMonthDay(from)}` : `Event date to ${fmtMonthDay(to!)}`;
}

export function activeFilterChips(filters: Pick<CasesListFilters, "tier" | "state" | "waiting" | "from" | "to" | "q">): FilterChipView[] {
  const chips: FilterChipView[] = [];
  if (filters.tier) chips.push({ key: "tier", label: TIER_LABEL[filters.tier] });
  if (filters.state) chips.push({ key: "state", label: filters.state === "off_path" ? "Ended" : STATE_LABEL[filters.state] });
  if (filters.waiting) chips.push({ key: "waiting", label: `Waiting on ${filters.waiting === "me" ? "me" : PARTY_LABEL[filters.waiting]}` });
  if (filters.from || filters.to) chips.push({ key: "dates", label: dateRangeLabel(filters.from, filters.to) });
  if (filters.q) chips.push({ key: "q", label: `"${filters.q}"` });
  return chips;
}

/* ------------------------------------------------------------------------ */
/* Cases pipeline: board                                                    */
/* ------------------------------------------------------------------------ */

/**
 * The board's columns for the cases it is given: the seven pipeline states, and Closed after
 * them once a closed case is among those shown (the "Closed and ended" toggle, or the Closed
 * state filter). An ended case sits in the state it ended in, so it needs no column of its own.
 *
 * With a State filter the board is that one column: every other column could only be empty,
 * and at 1280px three columns fit, so "3 of 28 cases" stood over a row of "Nothing here" with
 * the matches scrolled out of view. "Ended" keeps the columns that hold a case.
 */
export function pipelineBoardStates(cases: EventCase[], stateFilter?: CasesListFilters["state"]): CaseState[] {
  const all: CaseState[] = cases.some((c) => c.state === "closed") ? [...PIPELINE_BOARD_STATES, "closed"] : PIPELINE_BOARD_STATES;
  if (!stateFilter) return all;
  if (stateFilter === "off_path") return all.filter((state) => cases.some((c) => c.state === state));
  return [stateFilter];
}

/** One column per state, each already in event-date order. Columns with no case stay, empty. */
export function pipelineBoardColumns(cases: EventCase[], today: ISODate, stateFilter?: CasesListFilters["state"]): Record<CaseState, EventCase[]> {
  const columns = Object.fromEntries(pipelineBoardStates(cases, stateFilter).map((s) => [s, [] as EventCase[]])) as Record<CaseState, EventCase[]>;
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

/**
 * Grouping by deadline instead of by state (the PRD's push: "officials may triage by deadline
 * more than by state"). A case with no event date yet (a case the Clerk has accepted but not
 * yet scheduled is not possible, but a draft reopened as an exception could still lack one)
 * goes to "Later" rather than being dropped.
 */
export const EVENT_DATE_BUCKETS = ["this_week", "next_two_weeks", "this_month", "later", "past"] as const;
export type EventDateBucket = (typeof EVENT_DATE_BUCKETS)[number];

export const EVENT_DATE_BUCKET_LABEL: Record<EventDateBucket, string> = {
  this_week: "This week",
  next_two_weeks: "Next two weeks",
  this_month: "This month",
  later: "Later",
  past: "Past",
};

function eventDateBucket(date: ISODate | null, today: ISODate): EventDateBucket {
  if (!date) return "later";
  if (date < today) return "past";
  const days = daysBetween(today, date);
  if (days <= 7) return "this_week";
  if (days <= 14) return "next_two_weeks";
  if (days <= 31) return "this_month";
  return "later";
}

/** One column per deadline bucket, each case's state shown on its own card as a chip. */
export function pipelineEventDateColumns(cases: EventCase[], today: ISODate): Record<EventDateBucket, EventCase[]> {
  const columns = Object.fromEntries(EVENT_DATE_BUCKETS.map((b) => [b, [] as EventCase[]])) as Record<EventDateBucket, EventCase[]>;
  const sorted = [...cases].sort((a, b) => (eventDate(a, today) ?? "9999-12-31").localeCompare(eventDate(b, today) ?? "9999-12-31"));
  for (const c of sorted) columns[eventDateBucket(eventDate(c, today), today)].push(c);
  return columns;
}

/* ------------------------------------------------------------------------ */
/* Cases pipeline: table                                                    */
/* ------------------------------------------------------------------------ */

export type AlwaysOnColumn = "event" | "event_date" | "state";

/** The event's name, date and state always show; every other column only while it is toggled on. */
export function visibleTableColumns(filters: Pick<CasesListFilters, "columns">): (AlwaysOnColumn | TableColumn)[] {
  return ["event", "event_date", "state", ...TOGGLABLE_TABLE_COLUMNS.filter((c) => filters.columns.includes(c))];
}

export const TABLE_COLUMN_LABEL: Record<TableColumn, string> = {
  id: "ID",
  tier: "Tier",
  waiting: "Waiting on",
  next_action: "Next action",
  due: "Due",
  depts: "Depts",
  risk: "Risk",
};

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
    nextAction: c.ending ? ENDING_LABEL[c.ending] : firstTask ? firstTask.title : "Nothing actionable",
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
