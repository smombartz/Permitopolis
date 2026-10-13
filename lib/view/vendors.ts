/**
 * Pure view-model for a case's vendor health permits and per-vendor food permits (workstream
 * 5D, "Vendor permits"): the Documents tab's "Vendors" group, and what "Issue food permits"
 * needs. No React, no store. Tested against the real seed in vendors.test.ts.
 *
 * "Issue food permits" is Health & Legal's own city task (`CITY_TASKS.issue_food_permits`):
 * `issue_permit` creates it for a Special event with food vendors, it opens once every vendor's
 * health permit is verified, and finishing it (`complete_city_task`) opens the applicant's
 * "Download per-vendor food permits" card. Whether the button is live, and why not, is the
 * engine's own answer (`checkCompleteCityTask()`), never a rule of this file's.
 */
import { checkCompleteCityTask } from "@/lib/state";
import { buildVerificationPreview } from "@/lib/view/verify";
import type { EventCase, ISODate, Task } from "@/lib/types";

/** The word shown for a vendor's health permit: not uploaded, waiting for a check, verified, or sent back. */
export type VendorPermitStatus = "not_uploaded" | "waiting_for_you" | "verified" | "sent_back";

export const VENDOR_STATUS_LABEL: Record<VendorPermitStatus, string> = {
  not_uploaded: "Not uploaded",
  waiting_for_you: "Waiting for you",
  verified: "Verified",
  sent_back: "Sent back",
};

export interface VendorPermitRow {
  taskId: string;
  vendorName: string;
  status: VendorPermitStatus;
  /** The permit's own "Valid through" fact, already formatted, from its drawn preview. Null before a file is in. */
  validThrough: string | null;
}

export interface VendorPermitGroup {
  rows: VendorPermitRow[];
  verifiedCount: number;
  total: number;
}

function vendorStatus(task: Task): VendorPermitStatus {
  if (task.status === "done") return "verified";
  if (task.status === "changes_requested") return "sent_back";
  if (task.status === "submitted") return "waiting_for_you";
  return "not_uploaded";
}

function vendorPermitRow(c: EventCase, task: Task): VendorPermitRow {
  const preview = buildVerificationPreview(c, task);
  const validThroughFact = preview.facts.find((fact) => fact.label === "Valid through");
  const validThrough = validThroughFact && validThroughFact.value !== "Not shown on the permit" ? validThroughFact.value : null;
  return { taskId: task.id, vendorName: task.payload.vendorName ?? task.title, status: vendorStatus(task), validThrough };
}

/** The case's vendor health permits, one row per vendor. Null when the case has none. */
export function vendorPermitGroup(c: EventCase): VendorPermitGroup | null {
  const tasks = c.tasks.filter((task) => task.catalogId === "vendor_health_permit");
  if (tasks.length === 0) return null;
  const rows = tasks.map((task) => vendorPermitRow(c, task));
  return { rows, verifiedCount: rows.filter((row) => row.status === "verified").length, total: rows.length };
}

/* ---------- Issue food permits ---------- */

/** Health & Legal's city task that issues the per-vendor food permits (`CITY_TASKS.issue_food_permits`). */
export const ISSUE_FOOD_PERMITS_CATALOG_ID = "issue_food_permits";

/** The case's "Issue food permits" task: there from the day the permit is issued, for a Special event with food vendors. */
export function findIssueFoodPermitsTask(c: EventCase): Task | null {
  return c.tasks.find((task) => task.catalogId === ISSUE_FOOD_PERMITS_CATALOG_ID) ?? null;
}

export interface IssueFoodPermitsStatus {
  /** The engine's task, or null for a case that has no food permits to issue (or no permit yet). */
  task: Task | null;
  /** The day Health & Legal issued them, once it has. */
  issuedOn: ISODate | null;
  verifiedCount: number;
  total: number;
  /** Why the button is disabled, in the engine's words; null once it is enabled, and once the permits are issued. */
  disabledReason: string | null;
}

/** What the Documents tab's "Issue food permits" block shows, and whether its button is live for Health & Legal today. */
export function issueFoodPermitsStatus(c: EventCase, today: ISODate): IssueFoodPermitsStatus {
  const group = vendorPermitGroup(c);
  const task = findIssueFoodPermitsTask(c);
  const issued = task?.status === "done";
  const issuedOn = issued ? ((task!.history.at(-1)?.at.slice(0, 10) as ISODate | undefined) ?? null) : null;
  const check = task && !issued ? checkCompleteCityTask(c, task.id, "hl", today) : null;
  return {
    task,
    issuedOn,
    verifiedCount: group?.verifiedCount ?? 0,
    total: group?.total ?? 0,
    disabledReason: check && !check.ok ? check.reason : null,
  };
}
