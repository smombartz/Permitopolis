/**
 * Pure view-model for a case's vendor health permits and per-vendor food permits (workstream
 * 5D, "Vendor permits"): the Documents tab's "Vendors" group, and what "Issue food permits"
 * needs. No React, no store. Tested against the real seed in vendors.test.ts.
 *
 * `issueFoodPermitsStatus()` is built against a contract the engine does not have yet: see the
 * `issue_food_permits` engineRequest in this workstream's hand-off. Until `lib/state` grows that
 * city task, this always finds none and the UI it drives stays disabled with that reason.
 */
import { buildVerificationPreview } from "@/lib/view/verify";
import type { EventCase, Task } from "@/lib/types";

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

/* ---------- Issue food permits (needs the issue_food_permits engineRequest) ---------- */

/** The catalogue id the engineRequest asks for: a Health & Legal city task that completes the per-vendor permits. */
export const ISSUE_FOOD_PERMITS_CATALOG_ID = "issue_food_permits";

/** A Special event with vendors, once its permit is live: the case this action is ever for. */
export function issueFoodPermitsEligible(c: EventCase): boolean {
  return c.tier === "special" && (c.addOns.foodVending?.vendors ?? 0) > 0 && c.state !== "draft" && isPermittedOrLater(c);
}

function isPermittedOrLater(c: EventCase): boolean {
  return c.state === "permitted" || c.state === "event_day" || c.state === "closeout" || c.state === "closed";
}

/** The city task the engineRequest describes, if the engine has grown one. Always null today. */
export function findIssueFoodPermitsTask(c: EventCase): Task | null {
  return c.tasks.find((task) => task.catalogId === ISSUE_FOOD_PERMITS_CATALOG_ID) ?? null;
}

export interface IssueFoodPermitsStatus {
  /** Whether this case ever gets the section at all. */
  eligible: boolean;
  /** The engine's own task, once it exists. */
  task: Task | null;
  verifiedCount: number;
  total: number;
  allVerified: boolean;
  /** Why the button is disabled; null once it is enabled, and null while `task` is already done. */
  disabledReason: string | null;
}

/** What the Documents tab's "Issue food permits" section shows and whether its button is live. */
export function issueFoodPermitsStatus(c: EventCase): IssueFoodPermitsStatus {
  const eligible = issueFoodPermitsEligible(c);
  const group = vendorPermitGroup(c);
  const verifiedCount = group?.verifiedCount ?? 0;
  const total = group?.total ?? 0;
  const allVerified = total > 0 && verifiedCount === total;
  const task = findIssueFoodPermitsTask(c);

  let disabledReason: string | null = null;
  if (eligible) {
    if (!task) {
      disabledReason = "Issuing food permits needs an engine step that does not exist yet.";
    } else if (task.status !== "done" && !allVerified) {
      disabledReason = `Waiting on ${total - verifiedCount} of ${total} vendor health permits to be verified.`;
    }
  }

  return { eligible, task, verifiedCount, total, allVerified, disabledReason };
}
