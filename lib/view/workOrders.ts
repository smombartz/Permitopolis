/**
 * Pure view-model for Work orders (workstream 5C): every work order across cases, grouped by
 * event and sorted by event date, the summary line, overdue flags, the Meetings tab (site
 * walkthroughs and coordination meetings), and the Day-of panel's closure checklist. No React,
 * no store: `WorkOrdersScreen` reads `cases` and `demoToday` off the store and passes them in.
 * Tested against the real seed in `lib/view/workOrders.test.ts`.
 *
 * The "what and how many" come from `workOrderDetail()` in `lib/view/reviewTools.ts` (4C/5C's
 * shared view-model, also behind `CompleteCityTask.tsx`): the same figures the panel shows
 * when a row's "Mark done" opens the case.
 */
import { addDaysISO } from "@/lib/dates";
import { isOverdue } from "@/lib/format";
import { eventDate, isOpen, isSessionDate } from "@/lib/state";
import { workOrderDetail } from "@/lib/view/reviewTools";
import { occupiesStreet } from "@/lib/view/closures";
import type { EventCase, ISODate, Task } from "@/lib/types";

/* ---------- work orders ---------- */

export type WorkOrderKind = "barricades" | "police" | "closure" | "trash" | "power";
export type WorkOrderStatus = "scheduled" | "done";

export const WORK_ORDER_KIND_LABEL: Record<WorkOrderKind, string> = {
  barricades: "Barricades",
  police: "Police",
  closure: "Street closure",
  trash: "Trash",
  power: "Power",
};

export interface WorkOrderRow {
  task: Task;
  case: EventCase;
  kind: WorkOrderKind;
  what: string;
  quantity: string | null;
  where: string;
  eventDate: ISODate | null;
  due: ISODate | null;
  status: WorkOrderStatus;
  overdue: boolean;
}

function workOrderKind(task: Task): WorkOrderKind {
  return task.catalogId.slice("work_order:".length) as WorkOrderKind;
}

/** Every open case's work orders, unsorted. `workOrderRowsGrouped()` is what a screen renders. */
export function workOrderRows(cases: EventCase[], today: ISODate): WorkOrderRow[] {
  const rows: WorkOrderRow[] = [];
  for (const c of cases) {
    if (!isOpen(c)) continue;
    for (const task of c.tasks) {
      if (!task.catalogId.startsWith("work_order:")) continue;
      const detail = workOrderDetail(c, task);
      const status: WorkOrderStatus = task.status === "done" ? "done" : "scheduled";
      rows.push({
        task,
        case: c,
        kind: workOrderKind(task),
        what: detail.what,
        quantity: detail.quantity,
        where: c.location?.label ?? "Not provided",
        eventDate: eventDate(c, today),
        due: detail.due,
        status,
        overdue: status !== "done" && isOverdue(detail.due, today),
      });
    }
  }
  return rows;
}

export interface WorkOrderFilters {
  status?: WorkOrderStatus;
  kind?: WorkOrderKind;
  from?: ISODate;
  to?: ISODate;
}

export function filterWorkOrders(rows: WorkOrderRow[], filters: WorkOrderFilters): WorkOrderRow[] {
  return rows.filter((row) => {
    if (filters.status && row.status !== filters.status) return false;
    if (filters.kind && row.kind !== filters.kind) return false;
    if (filters.from && (!row.due || row.due < filters.from)) return false;
    if (filters.to && (!row.due || row.due > filters.to)) return false;
    return true;
  });
}

export interface WorkOrderEventGroup {
  case: EventCase;
  eventDate: ISODate | null;
  rows: WorkOrderRow[];
}

/** Rows grouped by event, soonest event date first; a row with no event date sorts last. */
export function groupWorkOrdersByEvent(rows: WorkOrderRow[]): WorkOrderEventGroup[] {
  const byCase = new Map<string, WorkOrderEventGroup>();
  for (const row of rows) {
    const existing = byCase.get(row.case.id);
    if (existing) existing.rows.push(row);
    else byCase.set(row.case.id, { case: row.case, eventDate: row.eventDate, rows: [row] });
  }
  return [...byCase.values()].sort((a, b) => (a.eventDate ?? "9999-99-99").localeCompare(b.eventDate ?? "9999-99-99") || a.case.id.localeCompare(b.case.id));
}

/** "12 open: 2 overdue, 4 due this week" */
export function workOrdersSummary(rows: WorkOrderRow[], today: ISODate): string {
  const open = rows.filter((row) => row.status !== "done");
  const overdue = open.filter((row) => row.overdue).length;
  const dueThisWeek = open.filter((row) => !row.overdue && row.due && row.due >= today && row.due <= addDaysISO(today, 7)).length;
  return `${open.length} open: ${overdue} overdue, ${dueThisWeek} due this week`;
}

/* ---------- meetings: site walkthroughs and coordination meetings ---------- */

export type MeetingKind = "coordination_meeting" | "site_walkthrough";

export const MEETING_KIND_LABEL: Record<MeetingKind, string> = {
  coordination_meeting: "Coordination meeting",
  site_walkthrough: "Site walkthrough",
};

export interface MeetingRow {
  task: Task;
  case: EventCase;
  kind: MeetingKind;
  scheduledFor: ISODate | null;
  held: boolean;
  eventDate: ISODate | null;
}

function isMeetingCatalogId(id: string): id is MeetingKind {
  return id === "coordination_meeting" || id === "site_walkthrough";
}

/** Every site walkthrough and coordination meeting across open cases, scheduled or not. */
export function meetingRows(cases: EventCase[], today: ISODate): MeetingRow[] {
  const rows: MeetingRow[] = [];
  for (const c of cases) {
    if (!isOpen(c)) continue;
    for (const task of c.tasks) {
      if (!isMeetingCatalogId(task.catalogId)) continue;
      rows.push({
        task,
        case: c,
        kind: task.catalogId,
        scheduledFor: (task.payload.scheduledFor as ISODate | undefined) ?? null,
        held: task.status === "done",
        eventDate: eventDate(c, today),
      });
    }
  }
  return rows.sort((a, b) => (a.eventDate ?? "9999-99-99").localeCompare(b.eventDate ?? "9999-99-99") || a.case.id.localeCompare(b.case.id) || a.kind.localeCompare(b.kind));
}

/* ---------- Day-of: the closure checklist ---------- */

/** Open cases with a street closure that are on Event day right now: the Today panel's own. */
export function todaysClosureCases(cases: EventCase[], today: ISODate): EventCase[] {
  return cases.filter((c) => c.ending === null && c.state === "event_day" && isSessionDate(c, today) && c.location !== null && occupiesStreet(c.location));
}

/** This event's work orders for the Today panel's checklist, due date order. */
export function closureChecklist(c: EventCase): Task[] {
  return c.tasks.filter((t) => t.catalogId.startsWith("work_order:")).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
}

/** "Closed at 7:45 am.", the fixed wording an `add_note` activity entry reads back as. */
export function closedAtNote(time: string): string {
  return `Closed at ${time}.`;
}

/** "Reopened at 11:40 am.", the fixed wording an `add_note` activity entry reads back as. */
export function reopenedAtNote(time: string): string {
  return `Reopened at ${time}.`;
}

/* ---------- the URL ---------- */

export type WorkOrdersTab = "orders" | "meetings";

export interface WorkOrdersFilters {
  tab: WorkOrdersTab;
  status?: WorkOrderStatus;
  kind?: WorkOrderKind;
  from?: ISODate;
  to?: ISODate;
}

const WORK_ORDER_KINDS: WorkOrderKind[] = ["barricades", "police", "closure", "trash", "power"];

function isoDateParam(value: string | null): ISODate | undefined {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : undefined;
}

export function parseWorkOrdersFilters(search: URLSearchParams): WorkOrdersFilters {
  const tab: WorkOrdersTab = search.get("tab") === "meetings" ? "meetings" : "orders";
  const statusParam = search.get("status");
  const status = statusParam === "scheduled" || statusParam === "done" ? statusParam : undefined;
  const kindParam = search.get("kind");
  const kind = WORK_ORDER_KINDS.includes(kindParam as WorkOrderKind) ? (kindParam as WorkOrderKind) : undefined;
  return { tab, status, kind, from: isoDateParam(search.get("from")), to: isoDateParam(search.get("to")) };
}

export function workOrdersQueryString(filters: WorkOrdersFilters): string {
  const params = new URLSearchParams();
  if (filters.tab !== "orders") params.set("tab", filters.tab);
  if (filters.status) params.set("status", filters.status);
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return params.toString();
}
