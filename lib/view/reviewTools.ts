/**
 * Pure view-model for the reviewer tools (workstream 4C): what a department's review panel
 * shows (the submitted material behind each routed section, the triggers that routed it), the
 * fee-line presets the fee schedule gives each department, the closeout's actual-vs-estimate
 * rows and running total, meeting-date validation, and a work order's plain-language detail.
 * No React, no store: the generic panels and the Reviews tab read store state and pass it in.
 * Covered by lib/view/reviewTools.test.ts against the real seed.
 */
import { classify, routing } from "@/lib/rules";
import type { RulesConfig } from "@/lib/rules/types";
import { eventDate, lastSessionDate } from "@/lib/state";
import type { FeeLineDraft } from "@/lib/state/actions";
import { BLACKOUTS } from "@/lib/data/calendar";
import { fmtDate, plural } from "@/lib/format";
import type { Dept, EventCase, FeeLine, FileRef, ISODate, Task } from "@/lib/types";
import { formRows, type FormRow } from "@/lib/view/cardForms";

/** Round to the cent; avoids float noise like 62.49999999999999. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ---------- submitted material behind a routed section ---------- */

export interface SubmittedCard {
  task: Task;
  rows: FormRow[];
  files: FileRef[];
}

export interface ReviewSectionMaterial {
  section: string;
  cards: SubmittedCard[];
}

function cardsFor(c: EventCase, section: string): Task[] {
  const direct = c.tasks.filter((t) => t.owner === "applicant" && t.title === section);
  if (direct.length > 0) return direct;
  // The generic "Vendor health permits" section (confirm_routing's own wording) and the
  // unsubstituted catalogue title both stand for every per-vendor health-permit card; a seed
  // script may route by vendor name instead ("Health permit: Rolling Dumpling Co."), which the
  // direct match above already covers.
  if (section === "Vendor health permits" || section.startsWith("Health permit:")) {
    return c.tasks.filter((t) => t.catalogId === "vendor_health_permit");
  }
  return [];
}

/**
 * One entry per section this department is routed to review, each with the applicant's own
 * cards for it (its form answers in words, its files), in routing order. A section with no
 * matching card ("Application completeness") carries none: the reviewer checks the whole
 * application for it, not one card.
 */
export function reviewMaterial(c: EventCase, dept: Dept): ReviewSectionMaterial[] {
  const review = c.reviews.find((r) => r.dept === dept);
  const sections = review?.sections ?? [];
  return sections.map((section) => ({
    section,
    cards: cardsFor(c, section).map((task) => ({ task, rows: formRows(task), files: task.payload.files ?? [] })),
  }));
}

/** The triggers that routed this department to the case, in the same words as My queue. */
export function routingReasons(c: EventCase, dept: Dept, cfg: RulesConfig): string[] {
  const cls = classify(c, cfg);
  return routing(c, cls, cfg).find((r) => r.dept === dept)?.reasons ?? [];
}

/* ---------- fee-line presets, built from the fee schedule ---------- */

/**
 * One preset per department, from the fee schedule: Public Works & Safety's officer-hours,
 * barricades, street closure and fire inspection; Health & Legal's vendor permits; the Clerk's
 * alcohol license. Quantities default from the applicant's own request (city services, the
 * street segments drawn, the vendor count, the structures added) so the reviewer starts from
 * what was asked for, not from zero, and can still edit every field before adding the line.
 */
export function feePresetsFor(dept: Dept, c: EventCase, cfg: RulesConfig): FeeLineDraft[] {
  const fees = cfg.fees;
  if (dept === "pws") {
    const svc = c.addOns.cityServices;
    const blocks = c.location?.mode === "streets" ? c.location.segmentIds.length : 0;
    const structures = c.addOns.tentsStages?.count ?? 0;
    return [
      { dept, label: "Police", qty: svc ? round2(svc.policeOfficers * svc.policeHours) : 0, unit: "officer-hour", unitPrice: fees.policePerOfficerHour },
      { dept, label: "Barricades", qty: svc?.barricades ?? 0, unit: "barricade-day", unitPrice: fees.barricadeEachPerDay },
      { dept, label: "Street closure", qty: blocks, unit: "block-day", unitPrice: fees.streetClosurePerBlockPerDay },
      { dept, label: "Structure fire inspection", qty: structures, unit: "structure", unitPrice: fees.structureInspectionEach },
    ];
  }
  if (dept === "hl") {
    return [{ dept, label: "Food or vendor permit", qty: c.addOns.foodVending?.vendors ?? 0, unit: "vendor", unitPrice: fees.vendorPermitEach }];
  }
  return [{ dept, label: "Temporary alcohol license", qty: 1, unit: "day", unitPrice: fees.alcoholLicensePerDay }];
}

/** The lines this department's section of the estimate already carries, so a preset never doubles one up. */
export function existingFeeLines(c: EventCase, dept: Dept): FeeLine[] {
  return c.feeLines.filter((l) => l.dept === dept && l.kind !== "deposit");
}

/* ---------- closeout: actual against estimate, line by line ---------- */

export interface CloseoutLineRow {
  id: string;
  label: string;
  unit: string;
  estimateQty: number;
  estimateAmount: number;
  /** Null while the field is left as it is: the engine keeps the line's estimate. */
  actualQty: number | null;
  actualAmount: number;
  difference: number;
}

export interface CloseoutExtraRow extends FeeLineDraft {
  amount: number;
}

export interface CloseoutSummary {
  rows: CloseoutLineRow[];
  extra: CloseoutExtraRow[];
  /** Positive is over the estimate, negative under. Every difference plus every extra line. */
  runningTotal: number;
}

/**
 * The department's own fee lines (never the deposit, never another department's) with the
 * actual quantity entered so far next to the estimate, the difference per line, and a running
 * total over or under, counting any extra lines (cleanup crew hours, a repair charge) in full
 * since they carry no estimate of their own. A line with no entry (undefined or not a finite
 * number) keeps its estimate, matching what `log_closeout` itself does with an empty field.
 */
export function closeoutRows(c: EventCase, dept: Dept, actualQtyByLineId: Record<string, number | null | undefined>, extraLines: FeeLineDraft[] = []): CloseoutSummary {
  const rows: CloseoutLineRow[] = existingFeeLines(c, dept).map((line) => {
    const entered = actualQtyByLineId[line.id];
    const actualQty = entered === null || entered === undefined || !Number.isFinite(entered) ? null : entered;
    const actualAmount = actualQty === null ? line.estimate : round2(actualQty * line.unitPrice);
    return { id: line.id, label: line.label, unit: line.unit, estimateQty: line.qty, estimateAmount: line.estimate, actualQty, actualAmount, difference: round2(actualAmount - line.estimate) };
  });
  const extra: CloseoutExtraRow[] = extraLines.filter((e) => e.qty > 0).map((e) => ({ ...e, amount: round2(e.qty * e.unitPrice) }));
  const runningTotal = round2(rows.reduce((sum, r) => sum + r.difference, 0) + extra.reduce((sum, e) => sum + e.amount, 0));
  return { rows, extra, runningTotal };
}

/* ---------- meeting-date validation ---------- */

/** A citywide blackout date (Memorial Day, the fireworks closures), independent of location. */
export function isBlackoutDate(date: ISODate): boolean {
  return BLACKOUTS.some((b) => b.date === date);
}

export interface DateCheck {
  ok: boolean;
  reason?: string;
}

/** A meeting or walkthrough must fall on or after today, before the event, and not on a blackout. */
export function meetingDateValid(c: EventCase, date: ISODate, today: ISODate): DateCheck {
  if (!date) return { ok: false, reason: "Choose a date." };
  if (date < today) return { ok: false, reason: "Choose today or a later date." };
  const ev = eventDate(c, today);
  if (ev && date >= ev) return { ok: false, reason: `Choose a date before ${fmtDate(ev)}.` };
  if (isBlackoutDate(date)) return { ok: false, reason: "That date is a citywide blackout." };
  return { ok: true };
}

/* ---------- a work order's own detail ---------- */

export interface WorkOrderDetail {
  what: string;
  /** Plain-language quantity ("30 barricades", "6 officers × 4h"), or null when the order has none to show. */
  quantity: string | null;
  eventName: string;
  eventDate: ISODate | null;
  due: ISODate | null;
}

const WORK_ORDER_LABEL: Record<string, string> = {
  barricades: "Deliver barricades",
  police: "Staff police officers",
  closure: "Close the street",
  trash: "Arrange trash service",
  power: "Arrange power",
};

/** What a `work_order:*` task is for, how many, and for which event and date: the detail the generic panel shows above Mark done. */
export function workOrderDetail(c: EventCase, task: Task): WorkOrderDetail {
  const key = task.catalogId.startsWith("work_order:") ? task.catalogId.slice("work_order:".length) : "";
  const svc = c.addOns.cityServices;
  let quantity: string | null = null;
  if (key === "barricades") quantity = svc && svc.barricades > 0 ? plural(svc.barricades, "barricade") : null;
  else if (key === "police") quantity = svc && svc.policeOfficers > 0 ? `${svc.policeOfficers} officers × ${svc.policeHours}h` : null;
  else if (key === "closure") {
    if (c.location?.mode === "streets") quantity = plural(c.location.segmentIds.length, "block");
    else if (c.location?.mode === "route") quantity = c.location.miles ? `${c.location.miles} miles` : null;
  }
  return { what: WORK_ORDER_LABEL[key] ?? task.title, quantity, eventName: c.name, eventDate: lastSessionDate(c) ?? c.schedule?.date ?? null, due: task.dueDate };
}

/* ---------- an Instant event's damage report ---------- */

/** The one extra fee line a damage report adds: the repair charge, labelled from the issue itself (e.g. "Broken picnic table repair"). */
export function damageRepairLine(issue: string, repairCharge: number): FeeLineDraft {
  return { dept: "pws", label: `${issue} repair`, qty: 1, unit: "item", unitPrice: repairCharge };
}

/** Meeting cards this department (or the Clerk, for every department) holds, scheduled or not. */
export function meetingCardsFor(c: EventCase, dept: Dept): Task[] {
  return c.tasks.filter((t) => t.owner === "applicant" && t.kind === "meeting" && (t.reviewer === dept || dept === "clerk"));
}
