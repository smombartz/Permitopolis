/**
 * Pure view-model for Health & Legal's Verifications page (workstream 5D): one queue of
 * documents waiting for a check, across every case, so a verifier works documents rather than
 * cases. No React, no store: the screen reads `useDemo` and passes the cases, role and date in.
 * Tested against the real seed in verifications.test.ts.
 *
 * Built on `lib/view/verify.ts` (4D): `canActOn()` decides what is in the queue,
 * `buildVerificationPreview()` gives each row its pre-evaluated checklist summary, and
 * `daysWaiting()` / `submittedOn()` give the row's own timing. This file never re-derives the
 * checklist itself.
 */
import { dateOf } from "@/lib/dates";
import { applicantNameOf } from "@/lib/data/people";
import { isOpen, isVisibleToCity, taskDueDate } from "@/lib/state";
import { buildVerificationPreview, canActOn, daysWaiting as docDaysWaiting, submittedOn as docSubmittedOn } from "@/lib/view/verify";
import type { Actor, Dept, EventCase, ISODate, Party, Task } from "@/lib/types";

/* ---------- document type grouping ---------- */

export type DocTypeGroup = "insurance" | "health_permits" | "accessibility" | "other";

export const DOC_TYPE_GROUPS: DocTypeGroup[] = ["insurance", "health_permits", "accessibility", "other"];

export const DOC_TYPE_LABEL: Record<DocTypeGroup, string> = {
  insurance: "Insurance",
  health_permits: "Health permits",
  accessibility: "Accessibility plans",
  other: "Other",
};

/** Which of the page's four groups a card's catalogue id falls under. */
export function documentTypeGroup(catalogId: string): DocTypeGroup {
  if (catalogId === "insurance_certificate") return "insurance";
  if (catalogId === "vendor_health_permit") return "health_permits";
  if (catalogId === "accessibility_plan") return "accessibility";
  return "other";
}

/* ---------- rows ---------- */

export interface VerificationQueueRow {
  taskId: string;
  caseId: string;
  caseName: string;
  applicantName: string;
  catalogId: string;
  title: string;
  typeGroup: DocTypeGroup;
  vendorName: string | null;
  submittedOn: ISODate | null;
  daysWaiting: number | null;
  dueDate: ISODate | null;
  overdue: boolean;
  summary: string;
  allPass: boolean;
  failingCount: number;
  totalCount: number;
}

export interface DecidedRow {
  taskId: string;
  caseId: string;
  caseName: string;
  applicantName: string;
  catalogId: string;
  title: string;
  typeGroup: DocTypeGroup;
  vendorName: string | null;
  verb: "Verified" | "Sent back";
  decidedOn: ISODate;
  decidedBy: Dept | null;
}

function isDept(actor: Actor): actor is Dept {
  return actor === "clerk" || actor === "pws" || actor === "hl";
}

/** The checklist's pre-evaluated result, as a compact line: "4 of 4 pass", or "1 fails: ...". */
export function summaryFor(
  c: EventCase,
  task: Task,
): { summary: string; allPass: boolean; failingCount: number; totalCount: number } {
  const preview = buildVerificationPreview(c, task);
  const total = preview.checklist.length;
  const failing = preview.checklist.filter((item) => !item.pass);
  const summary =
    failing.length === 0
      ? `${total} of ${total} pass`
      : `${failing.length} ${failing.length === 1 ? "fails" : "fail"}: ${failing[0].label.toLowerCase()}`;
  return { summary, allPass: failing.length === 0, failingCount: failing.length, totalCount: total };
}

/** Every document waiting on this role's check, across every open, visible case. Oldest waiting first. */
export function buildVerificationQueue(cases: EventCase[], role: Party, today: ISODate): VerificationQueueRow[] {
  const rows: VerificationQueueRow[] = [];
  for (const c of cases) {
    if (!isVisibleToCity(c) || !isOpen(c)) continue;
    for (const task of c.tasks) {
      if (!canActOn(task, role)) continue;
      const due = taskDueDate(task);
      const { summary, allPass, failingCount, totalCount } = summaryFor(c, task);
      rows.push({
        taskId: task.id,
        caseId: c.id,
        caseName: c.name,
        applicantName: applicantNameOf(c),
        catalogId: task.catalogId,
        title: task.title,
        typeGroup: documentTypeGroup(task.catalogId),
        vendorName: task.payload.vendorName ?? null,
        submittedOn: docSubmittedOn(task),
        daysWaiting: docDaysWaiting(task, today),
        dueDate: due,
        overdue: due !== null && due < today,
        summary,
        allPass,
        failingCount,
        totalCount,
      });
    }
  }
  return sortQueueRows(rows);
}

/** Oldest waiting first (the longest-waiting document first), undated last, then by due date. */
function sortQueueRows(rows: VerificationQueueRow[]): VerificationQueueRow[] {
  return [...rows].sort((a, b) => {
    const aw = a.daysWaiting ?? -1;
    const bw = b.daysWaiting ?? -1;
    if (aw !== bw) return bw - aw;
    const ad = a.dueDate ?? "9999-12-31";
    const bd = b.dueDate ?? "9999-12-31";
    if (ad !== bd) return ad < bd ? -1 : 1;
    return a.taskId < b.taskId ? -1 : 1;
  });
}

function decidedInfo(task: Task): { verb: "Verified" | "Sent back"; date: ISODate; actor: Dept | null } | null {
  const target = task.status === "done" ? "done" : task.status === "changes_requested" ? "changes_requested" : null;
  if (!target) return null;
  for (let i = task.history.length - 1; i >= 0; i--) {
    const entry = task.history[i];
    if (entry.status === target) {
      return { verb: target === "done" ? "Verified" : "Sent back", date: dateOf(entry.at), actor: isDept(entry.actor) ? entry.actor : null };
    }
  }
  return null;
}

/** Documents this role has already decided (verified or sent back), newest decision first. */
export function buildDecidedQueue(cases: EventCase[], role: Party): DecidedRow[] {
  const rows: DecidedRow[] = [];
  for (const c of cases) {
    if (!isVisibleToCity(c)) continue;
    for (const task of c.tasks) {
      if (task.reviewer !== role && task.request?.from !== role) continue;
      const decided = decidedInfo(task);
      if (!decided) continue;
      rows.push({
        taskId: task.id,
        caseId: c.id,
        caseName: c.name,
        applicantName: applicantNameOf(c),
        catalogId: task.catalogId,
        title: task.title,
        typeGroup: documentTypeGroup(task.catalogId),
        vendorName: task.payload.vendorName ?? null,
        verb: decided.verb,
        decidedOn: decided.date,
        decidedBy: decided.actor,
      });
    }
  }
  return rows.sort((a, b) => (a.decidedOn < b.decidedOn ? 1 : a.decidedOn > b.decidedOn ? -1 : 0));
}

/* ---------- filters, kept in the URL ---------- */

export type QueueGroupBy = "type" | "event";
export type ResultFilter = "all" | "fail";

export interface VerificationsFilters {
  tab: "queue" | "decided";
  group: QueueGroupBy;
  type: DocTypeGroup | "all";
  result: ResultFilter;
  overdue: boolean;
  q: string;
}

export function parseVerificationsFilters(search: URLSearchParams): VerificationsFilters {
  const typeParam = search.get("type");
  const type = typeParam !== null && (DOC_TYPE_GROUPS as string[]).includes(typeParam) ? (typeParam as DocTypeGroup) : "all";
  return {
    tab: search.get("tab") === "decided" ? "decided" : "queue",
    group: search.get("group") === "event" ? "event" : "type",
    type,
    result: search.get("result") === "fail" ? "fail" : "all",
    overdue: search.get("overdue") === "1",
    q: search.get("q") ?? "",
  };
}

export function verificationsQueryString(filters: VerificationsFilters): string {
  const params = new URLSearchParams();
  if (filters.tab !== "queue") params.set("tab", filters.tab);
  if (filters.group !== "type") params.set("group", filters.group);
  if (filters.type !== "all") params.set("type", filters.type);
  if (filters.result !== "all") params.set("result", filters.result);
  if (filters.overdue) params.set("overdue", "1");
  if (filters.q) params.set("q", filters.q);
  return params.toString();
}

function matchesQueueSearch(row: VerificationQueueRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    row.caseName.toLowerCase().includes(needle) ||
    row.applicantName.toLowerCase().includes(needle) ||
    row.title.toLowerCase().includes(needle) ||
    (row.vendorName?.toLowerCase().includes(needle) ?? false)
  );
}

/** The queue, narrowed by type, result, overdue and search. `oldestWaitingRow` wants the full list, before this. */
export function filterQueueRows(rows: VerificationQueueRow[], filters: VerificationsFilters): VerificationQueueRow[] {
  return rows.filter((row) => {
    if (filters.type !== "all" && row.typeGroup !== filters.type) return false;
    if (filters.result === "fail" && row.allPass) return false;
    if (filters.overdue && !row.overdue) return false;
    if (!matchesQueueSearch(row, filters.q)) return false;
    return true;
  });
}

export function filterDecidedRows(rows: DecidedRow[], filters: VerificationsFilters): DecidedRow[] {
  const needle = filters.q.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.type !== "all" && row.typeGroup !== filters.type) return false;
    if (!needle) return true;
    return (
      row.caseName.toLowerCase().includes(needle) ||
      row.applicantName.toLowerCase().includes(needle) ||
      row.title.toLowerCase().includes(needle) ||
      (row.vendorName?.toLowerCase().includes(needle) ?? false)
    );
  });
}

/* ---------- grouping, for display ---------- */

export interface QueueTypeGroup {
  type: DocTypeGroup;
  rows: VerificationQueueRow[];
}

/** The four type groups, in a fixed order, each only while it has a row. */
export function groupQueueRowsByType(rows: VerificationQueueRow[]): QueueTypeGroup[] {
  return DOC_TYPE_GROUPS.map((type) => ({ type, rows: rows.filter((row) => row.typeGroup === type) })).filter(
    (group) => group.rows.length > 0,
  );
}

export interface QueueEventGroup {
  caseId: string;
  caseName: string;
  rows: VerificationQueueRow[];
}

/** One group per event, in the order its first (oldest-waiting) row appears in the queue. */
export function groupQueueRowsByEvent(rows: VerificationQueueRow[]): QueueEventGroup[] {
  const order: string[] = [];
  const map = new Map<string, QueueEventGroup>();
  for (const row of rows) {
    let group = map.get(row.caseId);
    if (!group) {
      group = { caseId: row.caseId, caseName: row.caseName, rows: [] };
      map.set(row.caseId, group);
      order.push(row.caseId);
    }
    group.rows.push(row);
  }
  return order.map((id) => map.get(id)!);
}

/** "Verify the next one": the oldest-waiting document in the whole queue, filters aside. Null when there is none. */
export function oldestWaitingRow(allRows: VerificationQueueRow[]): VerificationQueueRow | null {
  return allRows.length > 0 ? allRows[0] : null;
}
