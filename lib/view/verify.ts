/**
 * Pure view-model for the verification panel and the Documents tab (workstream 4D): a
 * deterministic mock preview of a submitted card's document, its checklist, and how the
 * Documents tab groups and orders cards. No React, no store: the preview is drawn only from
 * the case, the card and its file, never from randomness, so the same card always previews the
 * same way. Covered by lib/view/verify.test.ts against the real seed.
 */
import { CARD_BY_ID, type CatalogId } from "@/lib/rules/catalog";
import { applicantNameOf } from "@/lib/data/people";
import { addDaysISO, daysBetween, dateOf } from "@/lib/dates";
import { fmtDate, fmtFileSize, fmtMoney, fmtTime } from "@/lib/format";
import { lastSessionDate, sessionDates, taskSubmittedOn } from "@/lib/state";
import type { Dept, EventCase, FileRef, HHmm, ISODate, Party, Task } from "@/lib/types";
import { formRows, type FormRow } from "./cardForms";

/* ---------- types ---------- */

export interface DocFact {
  label: string;
  value: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  pass: boolean;
  /** What the preview shows for this item, e.g. "Coverage ends Jun 17; teardown is 10 pm on Jun 18." */
  evidence: string;
  /** A plain-language fix, used to build the Send back reason when this item fails. */
  fix: string;
}

export type PreviewKind = "certificate" | "permit" | "plan" | "form" | "photo" | "generic" | "unreadable";

export interface VerificationPreview {
  taskId: string;
  catalogId: string;
  title: string;
  reviewer: Dept | null;
  kind: PreviewKind;
  file: { name: string; size: string; type: string } | null;
  /** True when the file's type or presence rules it out before any checklist item runs. */
  looksWrong: boolean;
  unreadableReason: string | null;
  /** The drawn document's own facts, e.g. named insured, coverage dates. Empty for a form card. */
  facts: DocFact[];
  /** The submitted form's answers, read back in words. Empty for a document card with no form. */
  formRows: FormRow[];
  checklist: ChecklistItem[];
  allPass: boolean;
  /** Every failing item's fix, joined into one sentence. Empty when every item passes. */
  defaultReason: string;
}

/* ---------- small helpers ---------- */

function item(id: string, label: string, pass: boolean, evidence: string, fix: string): ChecklistItem {
  return { id, label, pass, evidence, fix };
}

/** A short, stable number from a string: never Math.random, always the same for the same input. */
function stableHash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/** The event's own span: its first session's date to its last, and the day's teardown time. */
function eventSpan(c: EventCase): { from: ISODate | null; through: ISODate | null; teardown: HHmm | null } {
  const dates = sessionDates(c);
  const from = dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : c.schedule?.date ?? null;
  const through = lastSessionDate(c) ?? c.schedule?.date ?? null;
  return { from, through, teardown: c.schedule?.teardownEnd ?? null };
}

function fileKindWord(type: string): string {
  if (type.startsWith("image/")) return "photo";
  if (type === "application/pdf") return "PDF";
  return "file";
}

/* ---------- which file kind each document-kind card expects ---------- */

const EXPECTED_FILE_KIND: Partial<Record<CatalogId, "pdf" | "image">> = {
  insurance_certificate: "pdf",
  vendor_health_permit: "pdf",
  structure_specs: "pdf",
  traffic_control_plan: "pdf",
  security_medical_plan: "pdf",
  emergency_plan: "pdf",
  pyro_drone_license: "pdf",
  // The community notice is a photo of a posted flyer, not a document: an image is correct here.
  community_notification: "image",
};

const DOC_NOUN: Partial<Record<CatalogId, string>> = {
  insurance_certificate: "a certificate of insurance",
  vendor_health_permit: "a health permit",
  structure_specs: "structure specs",
  traffic_control_plan: "a traffic control plan",
  security_medical_plan: "a security and medical plan",
  emergency_plan: "an emergency plan",
  pyro_drone_license: "a pyrotechnics or drone operator license",
  community_notification: "a photo of the posted notice",
};

function fileLooksWrong(catalogId: string, file: FileRef | undefined): boolean {
  const expected = EXPECTED_FILE_KIND[catalogId as CatalogId];
  if (!expected) return false;
  if (!file) return true;
  return expected === "pdf" ? file.type !== "application/pdf" : !file.type.startsWith("image/");
}

/* ---------- insurance certificate ---------- */

/**
 * A stable rule on the file name, not randomness: the sum of its character codes, mod 13,
 * singles out a handful of background cases (PMT-27-0008, PMT-27-0030; see
 * lib/view/verify.test.ts) whose coverage is drawn to end a day before the event, so the
 * checklist has something real to catch. Every other certificate's dates cover the event in full.
 */
function insuranceCoverageIsShort(fileName: string): boolean {
  let sum = 0;
  for (let i = 0; i < fileName.length; i++) sum += fileName.charCodeAt(i);
  return sum % 13 === 12;
}

function buildInsurance(c: EventCase, file: FileRef): { kind: PreviewKind; facts: DocFact[]; checklist: ChecklistItem[] } {
  const span = eventSpan(c);
  const short = insuranceCoverageIsShort(file.name);
  const coverageFrom = span.from;
  const coverageThrough = short && span.through ? addDaysISO(span.through, -1) : span.through;
  const namedInsured = applicantNameOf(c);
  const limit = 1_000_000;
  const insurer = "Permitopolis Mutual Insurance Group";

  const datesText =
    coverageFrom && coverageThrough ? `${fmtDate(coverageFrom)} to ${fmtDate(coverageThrough)}` : "Not shown on the certificate";
  const facts: DocFact[] = [
    { label: "Named insured", value: namedInsured },
    { label: "Additional insured", value: "City of Permitopolis" },
    { label: "Per-occurrence limit", value: fmtMoney(limit) },
    { label: "Coverage dates", value: datesText },
    { label: "Insurer", value: insurer },
  ];

  const datesPass = coverageThrough !== null && span.through !== null && coverageThrough >= span.through;
  const datesEvidence = datesPass
    ? `Coverage runs ${datesText}, through teardown.`
    : `Coverage ends ${coverageThrough ? fmtDate(coverageThrough) : "unknown"}; the event runs through${
        span.teardown ? ` ${fmtTime(span.teardown)} on` : ""
      } ${span.through ? fmtDate(span.through) : "unknown"}.`;

  const checklist: ChecklistItem[] = [
    item(
      "named_insured",
      "Named insured matches the applicant",
      true,
      `Named insured: ${namedInsured}.`,
      `Name the policy to ${namedInsured}.`,
    ),
    item(
      "additional_insured",
      "The City of Permitopolis is an additional insured",
      true,
      "City of Permitopolis is listed as an additional insured.",
      "Add the City of Permitopolis as an additional insured.",
    ),
    item(
      "limit",
      "At least $1,000,000 per occurrence",
      true,
      `Per-occurrence limit is ${fmtMoney(limit)}.`,
      "Raise the per-occurrence limit to at least $1,000,000.",
    ),
    item("dates", "Coverage covers setup through teardown", datesPass, datesEvidence, `Extend coverage through ${span.through ? fmtDate(span.through) : "the event"}.`),
  ];

  return { kind: "certificate", facts, checklist };
}

/* ---------- vendor health permit ---------- */

function buildHealthPermit(c: EventCase, task: Task): { kind: PreviewKind; facts: DocFact[]; checklist: ChecklistItem[] } {
  // The card names its vendor (`requirements()` writes it); the title is only how it reads.
  const vendor = task.payload.vendorName ?? task.title;
  const vendorNames = c.addOns.foodVending?.vendorNames ?? [];
  const onList = vendorNames.includes(vendor);
  const permitNumber = `HP-2027-${String(10_000 + (stableHash(task.id) % 90_000)).padStart(5, "0")}`;
  const authority = "Permitopolis Department of Health & Legal";
  const span = eventSpan(c);
  const eventDay = span.through;
  const validThrough = eventDay ? addDaysISO(eventDay, 180) : null;

  const facts: DocFact[] = [
    { label: "Vendor", value: vendor },
    { label: "Permit number", value: permitNumber },
    { label: "Issuing authority", value: authority },
    { label: "Valid through", value: validThrough ? fmtDate(validThrough) : "Not shown on the permit" },
  ];

  const validPass = validThrough !== null && eventDay !== null && validThrough >= eventDay;
  const checklist: ChecklistItem[] = [
    item(
      "vendor_matches",
      "Vendor name matches the vendor list",
      onList,
      onList ? `${vendor} is on the vendor list.` : `"${vendor}" is not on the vendor list.`,
      `List ${vendor} on the vendor list, or correct the permit's vendor name.`,
    ),
    item("permit_number", "Permit number given", true, `Permit number ${permitNumber}.`, "Upload a permit that shows a permit number."),
    item(
      "valid_past_event",
      "Valid past the event date",
      validPass,
      validThrough && eventDay ? `Valid through ${fmtDate(validThrough)}; the event is ${fmtDate(eventDay)}.` : "No event date on file.",
      "Upload a health permit that is still valid on the event date.",
    ),
  ];

  return { kind: "permit", facts, checklist };
}

/* ---------- accessibility plan (a form laid out as a document) ---------- */

function buildAccessibilityPlan(task: Task): { kind: PreviewKind; facts: DocFact[]; checklist: ChecklistItem[] } {
  const form = task.payload.form ?? {};
  const route = form.accessibleRoute === true;
  const restrooms = typeof form.restrooms === "number" ? form.restrooms : 0;
  const viewingArea = typeof form.viewingArea === "string" ? form.viewingArea : "";

  const facts: DocFact[] = [
    { label: "Accessible route", value: route ? "Yes" : "No" },
    { label: "Accessible restrooms", value: String(restrooms) },
    { label: "Accessible viewing area", value: viewingArea || "Not noted" },
  ];

  const checklist: ChecklistItem[] = [
    item(
      "route",
      "An accessible route to every viewing area",
      route,
      route ? "An accessible route is marked." : "No accessible route is marked.",
      "Add an accessible route to every viewing area.",
    ),
    item(
      "restrooms",
      "Accessible restrooms",
      restrooms > 0,
      restrooms > 0 ? `${restrooms} accessible restrooms.` : "No accessible restrooms given.",
      "Add at least one accessible restroom.",
    ),
    item(
      "viewing_area",
      "Accessible viewing area named",
      viewingArea.length > 0,
      viewingArea ? `Viewing area: ${viewingArea}.` : "No accessible viewing area named.",
      "Name an accessible viewing area.",
    ),
  ];

  return { kind: "form", facts, checklist };
}

/* ---------- the other plan documents: a short, sensible checklist per catalogue id ---------- */

const PLAN_CHECK_ITEMS: Partial<Record<CatalogId, { label: string; fix: string }[]>> = {
  structure_specs: [
    { label: "Layout matches the space booked", fix: "Match the layout to the space booked." },
    { label: "Capacity is within the space's limit", fix: "Reduce the layout to fit the space's capacity." },
  ],
  traffic_control_plan: [
    { label: "Names the streets being closed", fix: "List every street segment being closed." },
    { label: "Shows detours for through traffic", fix: "Add detour routes for through traffic." },
  ],
  security_medical_plan: [
    { label: "Staffing is scaled to the attendance", fix: "Scale security and medical staffing to the attendance." },
    { label: "Names a medical station", fix: "Add a medical station to the plan." },
  ],
  emergency_plan: [
    { label: "Names an evacuation route", fix: "Add an evacuation route." },
    { label: "Names an assembly point", fix: "Add an assembly point." },
  ],
  pyro_drone_license: [
    { label: "Names a licensed operator", fix: "Name the licensed operator on the license." },
    { label: "Valid past the event date", fix: "Upload a license that is valid past the event date." },
  ],
};

function buildPlanDocument(catalogId: CatalogId, c: EventCase): { kind: PreviewKind; facts: DocFact[]; checklist: ChecklistItem[] } {
  const spec = CARD_BY_ID[catalogId];
  const items = PLAN_CHECK_ITEMS[catalogId] ?? [];
  const facts: DocFact[] = [
    { label: "Document", value: spec.title },
    { label: "Prepared for", value: c.name },
    { label: "Location", value: c.location?.label ?? "Not shown" },
  ];
  const checklist = items.map((it, i) => item(`${catalogId}_${i}`, it.label, true, `${it.label}.`, it.fix));
  return { kind: "plan", facts, checklist };
}

/* ---------- forms reviewed in place (their own FormAnswers already shows the raw answers) ---------- */

function buildSoundDetails(task: Task): { kind: PreviewKind; facts: DocFact[]; checklist: ChecklistItem[] } {
  const form = task.payload.form ?? {};
  const equipment = typeof form.equipment === "string" ? form.equipment : "";
  const soundCheckTime = typeof form.soundCheckTime === "string" ? form.soundCheckTime : "";
  const checklist: ChecklistItem[] = [
    item("equipment", "Sound equipment listed", equipment.length > 0, equipment ? `Equipment: ${equipment}.` : "No equipment listed.", "List the sound equipment being used."),
    item(
      "check_time",
      "Sound check time given",
      soundCheckTime.length > 0,
      soundCheckTime ? `Sound check at ${fmtTime(soundCheckTime as HHmm)}.` : "No sound check time given.",
      "Give a sound check time.",
    ),
  ];
  return { kind: "form", facts: [], checklist };
}

function buildAlcoholDetails(task: Task): { kind: PreviewKind; facts: DocFact[]; checklist: ChecklistItem[] } {
  const form = task.payload.form ?? {};
  const servers = typeof form.servers === "number" ? form.servers : 0;
  const carrier = typeof form.liquorLiabilityCarrier === "string" ? form.liquorLiabilityCarrier : "";
  const checklist: ChecklistItem[] = [
    item("servers", "Trained servers on site", servers > 0, servers > 0 ? `${servers} trained servers.` : "No trained servers given.", "Add trained servers to the alcohol details."),
    item(
      "carrier",
      "Liquor liability carrier named",
      carrier.length > 0,
      carrier ? `Carrier: ${carrier}.` : "No liquor liability carrier named.",
      "Name the liquor liability carrier.",
    ),
  ];
  return { kind: "form", facts: [], checklist };
}

function buildVendorList(c: EventCase, task: Task): { kind: PreviewKind; facts: DocFact[]; checklist: ChecklistItem[] } {
  const form = task.payload.form ?? {};
  const vendors = Array.isArray(form.vendors) ? (form.vendors as unknown[]) : [];
  const planned = c.addOns.foodVending?.vendors ?? 0;
  const checklist: ChecklistItem[] = [
    item("has_vendors", "Every vendor named", vendors.length > 0, vendors.length > 0 ? `${vendors.length} vendors listed.` : "No vendors listed.", "List every food vendor."),
    item(
      "count_matches",
      "Vendor count matches the plan",
      planned === 0 || vendors.length === planned,
      `${vendors.length} listed; the plan asked for ${planned}.`,
      "Match the vendor list to the number of vendors in the plan.",
    ),
  ];
  return { kind: "form", facts: [], checklist };
}

function buildCookingGeneratorSafety(task: Task): { kind: PreviewKind; facts: DocFact[]; checklist: ChecklistItem[] } {
  const form = task.payload.form ?? {};
  const perTruck = typeof form.fireExtinguishersPerTruck === "number" ? form.fireExtinguishersPerTruck : 0;
  const checklist: ChecklistItem[] = [
    item(
      "extinguishers",
      "At least one fire extinguisher per food truck",
      perTruck >= 1,
      perTruck >= 1 ? `${perTruck} fire extinguishers per truck.` : "No fire extinguishers given.",
      "Provide at least one fire extinguisher per food truck.",
    ),
  ];
  return { kind: "form", facts: [], checklist };
}

function buildCityServicesRequest(task: Task): { kind: PreviewKind; facts: DocFact[]; checklist: ChecklistItem[] } {
  const form = task.payload.form ?? {};
  const requested = Object.values(form).some((v) => v === true || (typeof v === "number" && v > 0));
  const checklist: ChecklistItem[] = [
    item("requested", "Matches the services asked for in the plan", requested, requested ? "Services requested match the plan." : "Nothing was requested.", "List the city services the event needs."),
  ];
  return { kind: "form", facts: [], checklist };
}

function buildSitePlan(task: Task): { kind: PreviewKind; facts: DocFact[]; checklist: ChecklistItem[] } {
  const form = task.payload.form ?? {};
  const drawnOn = typeof form.drawnOn === "string" ? form.drawnOn : "";
  const notes = typeof form.notes === "string" ? form.notes : "";
  const checklist: ChecklistItem[] = [
    item("drawn", "Drawn on the step 2 map", drawnOn.length > 0, drawnOn ? `Drawn on ${drawnOn}.` : "No map drawing on file.", "Draw the site plan on the step 2 map."),
    item("notes", "Notes describe the layout", notes.length > 0, notes ? `Notes: ${notes}.` : "No layout notes given.", "Add notes describing the layout."),
  ];
  return { kind: "form", facts: [], checklist };
}

function buildCleanupPlan(task: Task): { kind: PreviewKind; facts: DocFact[]; checklist: ChecklistItem[] } {
  const form = task.payload.form ?? {};
  const crew = typeof form.crew === "number" ? form.crew : 0;
  const sweepStartsAt = typeof form.sweepStartsAt === "string" ? form.sweepStartsAt : "";
  const checklist: ChecklistItem[] = [
    item("crew", "Cleanup crew assigned", crew > 0, crew > 0 ? `${crew} on the cleanup crew.` : "No cleanup crew given.", "Assign a cleanup crew."),
    item(
      "sweep",
      "Sweep start time set",
      sweepStartsAt.length > 0,
      sweepStartsAt ? `Sweep starts at ${fmtTime(sweepStartsAt as HHmm)}.` : "No sweep start time given.",
      "Set a sweep start time.",
    ),
  ];
  return { kind: "form", facts: [], checklist };
}

function buildCommunityNotification(file: FileRef): { kind: PreviewKind; facts: DocFact[]; checklist: ChecklistItem[] } {
  const checklist: ChecklistItem[] = [
    item("photo", "Photo of the posted notice attached", true, `${file.name} (${fmtFileSize(file.size)}).`, "Attach a photo of the posted notice."),
  ];
  return { kind: "photo", facts: [], checklist };
}

function buildGenericFallback(task: Task): { kind: PreviewKind; facts: DocFact[]; checklist: ChecklistItem[] } {
  const hasFiles = (task.payload.files?.length ?? 0) > 0;
  const hasForm = !!task.payload.form && Object.keys(task.payload.form).length > 0;
  const checklist: ChecklistItem[] = [
    item("provided", "A file or answer was provided", hasFiles || hasForm, hasFiles || hasForm ? "Something was submitted." : "Nothing was submitted.", "Ask the applicant to submit this card again."),
  ];
  return { kind: "generic", facts: [], checklist };
}

function buildFactsAndChecklist(c: EventCase, task: Task, file: FileRef | undefined): { kind: PreviewKind; facts: DocFact[]; checklist: ChecklistItem[] } {
  switch (task.catalogId as CatalogId) {
    case "insurance_certificate":
      return buildInsurance(c, file!);
    case "vendor_health_permit":
      return buildHealthPermit(c, task);
    case "accessibility_plan":
      return buildAccessibilityPlan(task);
    case "structure_specs":
    case "traffic_control_plan":
    case "security_medical_plan":
    case "emergency_plan":
    case "pyro_drone_license":
      return buildPlanDocument(task.catalogId as CatalogId, c);
    case "sound_details":
      return buildSoundDetails(task);
    case "alcohol_details":
      return buildAlcoholDetails(task);
    case "vendor_list":
      return buildVendorList(c, task);
    case "cooking_generator_safety":
      return buildCookingGeneratorSafety(task);
    case "city_services_request":
      return buildCityServicesRequest(task);
    case "site_plan":
      return buildSitePlan(task);
    case "cleanup_plan":
      return buildCleanupPlan(task);
    case "community_notification":
      return buildCommunityNotification(file!);
    default:
      return buildGenericFallback(task);
  }
}

/* ---------- the preview, put together ---------- */

/**
 * The mock preview and checklist for one submitted card: drawn only from the case, the card
 * and its file, so the same card always previews the same way. Wrong where the seed says the
 * upload is wrong (an image where a document belongs, or a file whose name does not look like
 * the one it claims to be): the facts are left out and the one checklist item that can run
 * (whether it looks like the right document) fails.
 */
export function buildVerificationPreview(c: EventCase, task: Task): VerificationPreview {
  const catalogId = task.catalogId;
  const file = task.payload.files?.[0];
  const wrong = fileLooksWrong(catalogId, file);

  let kind: PreviewKind;
  let facts: DocFact[];
  let checklist: ChecklistItem[];

  if (wrong) {
    kind = "unreadable";
    facts = [];
    const noun = DOC_NOUN[catalogId as CatalogId] ?? "the right document";
    checklist = [
      item(
        "looks_right",
        "Looks like the right kind of document",
        false,
        file ? `"${file.name}" is a ${fileKindWord(file.type)}, not ${noun}.` : "Nothing was uploaded.",
        `Upload ${noun}.`,
      ),
    ];
  } else {
    const built = buildFactsAndChecklist(c, task, file);
    kind = built.kind;
    facts = built.facts;
    checklist = built.checklist;
  }

  const allPass = checklist.length > 0 && checklist.every((i) => i.pass);
  const failing = checklist.filter((i) => !i.pass);
  const defaultReason = failing.map((i) => i.fix).join(" ");

  return {
    taskId: task.id,
    catalogId,
    title: task.title,
    reviewer: task.reviewer,
    kind,
    file: file ? { name: file.name, size: fmtFileSize(file.size), type: file.type } : null,
    looksWrong: wrong,
    unreadableReason: wrong ? `This does not look like ${DOC_NOUN[catalogId as CatalogId] ?? "the right document"}.` : null,
    facts,
    formRows: formRows(task),
    checklist,
    allPass,
    defaultReason,
  };
}

/* ---------- the Documents tab: grouping, progress and ordering ---------- */

export type DocumentRow =
  | { kind: "single"; task: Task }
  | { kind: "vendor_group"; catalogId: string; title: string; tasks: Task[]; verifiedCount: number; total: number };

const GROUP_TITLE: Partial<Record<CatalogId, string>> = {
  vendor_health_permit: "Vendor health permits",
};

/** Whether the viewing role can act on this card right now: it is submitted and theirs to check. */
export function canActOn(task: Task, role: Party): boolean {
  return task.status === "submitted" && (task.reviewer === role || task.request?.from === role);
}

/**
 * One row per card, except a per-vendor catalogue id (vendor health permits): those collapse
 * into one row with "N of M verified" progress, in the position of the first vendor card. A
 * lone vendor's permit stays its own row: a group of one would only hide the card (and, on S3,
 * the request pinned to it) behind a click.
 */
export function groupDocumentsForDisplay(cards: Task[]): DocumentRow[] {
  const rows: DocumentRow[] = [];
  const vendorRowIndex = new Map<string, number>();
  const vendorTasks = new Map<string, Task[]>();

  for (const task of cards) {
    const spec = CARD_BY_ID[task.catalogId as CatalogId];
    if (spec?.perVendor) {
      let idx = vendorRowIndex.get(task.catalogId);
      if (idx === undefined) {
        idx = rows.length;
        vendorRowIndex.set(task.catalogId, idx);
        vendorTasks.set(task.catalogId, []);
        rows.push({ kind: "vendor_group", catalogId: task.catalogId, title: "", tasks: [], verifiedCount: 0, total: 0 });
      }
      vendorTasks.get(task.catalogId)!.push(task);
    } else {
      rows.push({ kind: "single", task });
    }
  }

  for (const [catalogId, idx] of vendorRowIndex) {
    const tasks = vendorTasks.get(catalogId)!;
    if (tasks.length === 1) {
      rows[idx] = { kind: "single", task: tasks[0] };
      continue;
    }
    const title = GROUP_TITLE[catalogId as CatalogId] ?? CARD_BY_ID[catalogId as CatalogId]?.title.replace(": {vendor}", "s") ?? catalogId;
    rows[idx] = {
      kind: "vendor_group",
      catalogId,
      title,
      tasks,
      verifiedCount: tasks.filter((t) => t.status === "done").length,
      total: tasks.length,
    };
  }

  return rows;
}

/**
 * Whether a vendor group starts expanded: while any permit in it is in flight (a reviewer has
 * asked about it, it is submitted and waiting for its check, or it was sent back). That is the
 * same for every viewer: the Clerk following a request sees it as the department that made it
 * does. A group with nothing in flight (all verified, or nothing uploaded yet) starts closed.
 */
export function groupStartsOpen(row: Extract<DocumentRow, { kind: "vendor_group" }>): boolean {
  return row.tasks.some((t) => t.status === "submitted" || t.status === "changes_requested" || (t.request !== undefined && !t.request.resolved));
}

/** True when the viewer can act on this row (a single card, or any card in a vendor group). */
export function rowNeedsViewerCheck(row: DocumentRow, role: Party): boolean {
  return row.kind === "single" ? canActOn(row.task, role) : row.tasks.some((t) => canActOn(t, role));
}

/** The viewer's own actionable rows first, everything else after, each group kept in order. */
export function sortDocumentRowsForViewer(rows: DocumentRow[], role: Party): DocumentRow[] {
  return [...rows].sort((a, b) => Number(!rowNeedsViewerCheck(a, role)) - Number(!rowNeedsViewerCheck(b, role)));
}

/** The viewer's own department's group first, then every other routed department in order. */
export function orderGroupsForViewer<T extends { dept: Dept }>(groups: T[], role: Party): T[] {
  return [...groups].sort((a, b) => Number(a.dept !== role) - Number(b.dept !== role));
}

/* ---------- how long a card has waited ---------- */

/** When this card was last submitted, from its own history. Null if it never was. The engine's own reading (`taskSubmittedOn`), which the applicant's board counts from too. */
export function submittedOn(task: Task): ISODate | null {
  return taskSubmittedOn(task);
}

/** Calendar days a still-submitted card has waited for its check. Null once it is no longer waiting. */
export function daysWaiting(task: Task, today: ISODate): number | null {
  if (task.status !== "submitted") return null;
  const on = submittedOn(task);
  return on ? daysBetween(on, today) : null;
}

/** What happened to a decided card and when, from its own history: "Verified" or "Sent back". */
export function decidedOn(task: Task): { verb: "Verified" | "Sent back"; date: ISODate } | null {
  if (task.status === "done") {
    for (let i = task.history.length - 1; i >= 0; i--) {
      if (task.history[i].status === "done") return { verb: "Verified", date: dateOf(task.history[i].at) };
    }
  }
  if (task.status === "changes_requested") {
    for (let i = task.history.length - 1; i >= 0; i--) {
      if (task.history[i].status === "changes_requested") return { verb: "Sent back", date: dateOf(task.history[i].at) };
    }
  }
  return null;
}
