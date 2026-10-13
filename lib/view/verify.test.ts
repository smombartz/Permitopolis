import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, DEFAULT_DEMO_TODAY } from "@/lib/rules/config";
import { buildSeed, transition } from "@/lib/state";
import type { EventCase, Task } from "@/lib/types";
import {
  buildVerificationPreview,
  canActOn,
  daysWaiting,
  decidedOn,
  groupDocumentsForDisplay,
  orderGroupsForViewer,
  sortDocumentRowsForViewer,
  submittedOn,
} from "./verify";

const TODAY = DEFAULT_DEMO_TODAY;
const cases = buildSeed();
const ctx = { today: TODAY, cases, cfg: DEFAULT_CONFIG };

function caseById(id: string): EventCase {
  const found = cases.find((c) => c.id === id);
  if (!found) throw new Error(`No seeded case ${id}`);
  return found;
}

function taskById(c: EventCase, id: string): Task {
  const found = c.tasks.find((t) => t.id === id);
  if (!found) throw new Error(`No task ${id} on ${c.id}`);
  return found;
}

describe("buildVerificationPreview: S3's health permit, after the applicant answers the request", () => {
  const s3 = caseById("PMT-27-0118"); // Jazz in the Plaza
  const taskId = `${s3.id}:vendor_health_permit:1`;

  it("previews the vendor's name, a permit number and a valid-through date, every item passing", () => {
    const answered = transition(
      s3,
      { type: "respond_to_request", taskId, files: [{ name: "health-permit.pdf", size: 120_000, type: "application/pdf" }] },
      "applicant",
      ctx,
    );
    if (!answered.ok) throw new Error(answered.reason);

    const preview = buildVerificationPreview(answered.case, taskById(answered.case, taskId));
    expect(preview.kind).toBe("permit");
    expect(preview.looksWrong).toBe(false);
    expect(preview.facts.find((f) => f.label === "Vendor")?.value).toBe("Rolling Dumpling Co.");
    expect(preview.checklist.map((i) => i.id)).toEqual(["vendor_matches", "permit_number", "valid_past_event"]);
    expect(preview.checklist.every((i) => i.pass)).toBe(true);
    expect(preview.allPass).toBe(true);
    expect(preview.defaultReason).toBe("");
  });

  it("fails the vendor-match item when the name on the permit is not on the vendor list", () => {
    const answered = transition(
      s3,
      { type: "respond_to_request", taskId, files: [{ name: "health-permit.pdf", size: 120_000, type: "application/pdf" }] },
      "applicant",
      ctx,
    );
    if (!answered.ok) throw new Error(answered.reason);
    const task = { ...taskById(answered.case, taskId), title: "Health permit: Some Other Vendor" };

    const preview = buildVerificationPreview(answered.case, task);
    const vendorItem = preview.checklist.find((i) => i.id === "vendor_matches")!;
    expect(vendorItem.pass).toBe(false);
    expect(vendorItem.evidence).toMatch(/is not on the vendor list/);
    expect(preview.allPass).toBe(false);
    expect(preview.defaultReason).toMatch(/Some Other Vendor/);
  });
});

describe("buildVerificationPreview: S5's insurance certificate", () => {
  const s5 = caseById("PMT-27-0097"); // Riverfront Summer 5K
  const task = taskById(s5, `${s5.id}:insurance_certificate`);

  it("passes all four PRD checklist items: named insured, additional insured, the limit, and the dates", () => {
    expect(task.payload.files?.[0]?.name).toBe("race-day-insurance-certificate.pdf");

    const preview = buildVerificationPreview(s5, task);
    expect(preview.kind).toBe("certificate");
    expect(preview.looksWrong).toBe(false);
    expect(preview.checklist.map((i) => i.id)).toEqual(["named_insured", "additional_insured", "limit", "dates"]);
    expect(preview.checklist.every((i) => i.pass)).toBe(true);
    expect(preview.allPass).toBe(true);
    expect(preview.facts.find((f) => f.label === "Named insured")?.value).toBe("Riverfront Running Club");
  });
});

describe("buildVerificationPreview: the Plaza wedding photos insurance (a JPEG, not a certificate)", () => {
  it("previews as unreadable, with the facts missing and one failing item", () => {
    // Found by its known-bad file rather than a hardcoded id, in case the seed's id ever moves.
    const wedding = cases.find((c) => c.tasks.some((t) => t.payload.files?.some((f) => f.name === "wedding-photographer-contract.jpg")))!;
    expect(wedding).toBeDefined();
    const task = wedding.tasks.find((t) => t.payload.files?.some((f) => f.name === "wedding-photographer-contract.jpg"))!;

    const preview = buildVerificationPreview(wedding, task);
    expect(preview.kind).toBe("unreadable");
    expect(preview.looksWrong).toBe(true);
    expect(preview.facts).toEqual([]);
    expect(preview.unreadableReason).toBe("This does not look like a certificate of insurance.");
    expect(preview.checklist).toHaveLength(1);
    expect(preview.checklist[0].pass).toBe(false);
    expect(preview.checklist[0].evidence).toMatch(/wedding-photographer-contract\.jpg.*photo.*not a certificate of insurance/);
    expect(preview.allPass).toBe(false);
    expect(preview.defaultReason).toMatch(/Upload a certificate of insurance/);
  });
});

describe("buildVerificationPreview: the two background documents with a deliberate, stable defect", () => {
  // The stable rule (sum of the file name's character codes, mod 13, equals 12) singles out
  // PMT-27-0008, PMT-27-0030 and PMT-27-0046 among the background cases; see notesForIntegrator.
  const defective = ["PMT-27-0008", "PMT-27-0030", "PMT-27-0046"];

  it.each(defective)("%s's insurance coverage previews as ending a day before the event, every other item passing", (id) => {
    const c = caseById(id);
    const task = taskById(c, `${id}:insurance_certificate`);
    const preview = buildVerificationPreview(c, task);

    expect(preview.looksWrong).toBe(false);
    const datesItem = preview.checklist.find((i) => i.id === "dates")!;
    expect(datesItem.pass).toBe(false);
    expect(datesItem.evidence).toMatch(/^Coverage ends/);
    expect(preview.checklist.filter((i) => i.id !== "dates").every((i) => i.pass)).toBe(true);
    expect(preview.allPass).toBe(false);
    expect(preview.defaultReason).toMatch(/Extend coverage through/);
  });

  it("a certificate outside the rule (S5's) is not flagged", () => {
    const s5 = caseById("PMT-27-0097");
    const task = taskById(s5, `${s5.id}:insurance_certificate`);
    const datesItem = buildVerificationPreview(s5, task).checklist.find((i) => i.id === "dates")!;
    expect(datesItem.pass).toBe(true);
  });
});

describe("the reason built from failing items", () => {
  it("joins every failing item's fix into one plain-language sentence, in checklist order", () => {
    const c = caseById("PMT-27-0008");
    const task = taskById(c, `${c.id}:insurance_certificate`);
    const preview = buildVerificationPreview(c, task);
    const failing = preview.checklist.filter((i) => !i.pass);
    expect(preview.defaultReason).toBe(failing.map((i) => i.fix).join(" "));
  });
});

describe("Documents tab: grouping and progress for S6's 25 vendor health permits", () => {
  const s6 = caseById("PMT-27-0031"); // Main Street Food Truck Festival

  it("collapses into one row with every one of the 25 verified by the demo date", () => {
    const cards = s6.tasks.filter((t) => t.owner === "applicant" && (t.kind === "document" || t.kind === "form" || (t.payload.files?.length ?? 0) > 0 || t.payload.form));
    const rows = groupDocumentsForDisplay(cards);
    const vendorRow = rows.find((r) => r.kind === "vendor_group" && r.catalogId === "vendor_health_permit");
    expect(vendorRow).toBeDefined();
    if (vendorRow?.kind !== "vendor_group") throw new Error("expected a vendor group");
    expect(vendorRow.total).toBe(25);
    expect(vendorRow.verifiedCount).toBe(25);
    expect(vendorRow.title).toBe("Vendor health permits");
    // It sits in the first vendor card's position, not appended at the end.
    expect(rows.indexOf(vendorRow)).toBeLessThan(rows.length - 1);
  });

  it("every other document stays its own row", () => {
    const cards = s6.tasks.filter((t) => t.owner === "applicant" && (t.payload.files?.length ?? 0) > 0);
    const rows = groupDocumentsForDisplay(cards);
    const singles = rows.filter((r) => r.kind === "single");
    expect(singles.length).toBeGreaterThan(0);
    for (const row of singles) if (row.kind === "single") expect(row.task.catalogId).not.toBe("vendor_health_permit");
  });
});

describe("canActOn, ordering and waiting", () => {
  const s3 = caseById("PMT-27-0118");

  it("is true only for a submitted card the role reviews, or whose request they sent", () => {
    const insurance = taskById(s3, `${s3.id}:insurance_certificate`); // already done
    expect(canActOn(insurance, "hl")).toBe(false);
  });

  it("sorts the viewer's own actionable rows first, keeping relative order otherwise", () => {
    const vendorList = taskById(s3, `${s3.id}:vendor_list`); // done
    const insurance = taskById(s3, `${s3.id}:insurance_certificate`); // done
    const needsCheck: Task = { ...vendorList, status: "submitted" };
    const rows = sortDocumentRowsForViewer(
      [{ kind: "single", task: insurance }, { kind: "single", task: needsCheck }],
      "hl",
    );
    expect(rows[0].kind === "single" && rows[0].task.id).toBe(needsCheck.id);
  });

  it("orders the viewer's own department's group first", () => {
    const groups = [{ dept: "pws" as const }, { dept: "hl" as const }, { dept: "clerk" as const }];
    expect(orderGroupsForViewer(groups, "hl").map((g) => g.dept)).toEqual(["hl", "pws", "clerk"]);
  });

  it("counts the calendar days a still-submitted card has waited, from its own history", () => {
    const task: Task = {
      id: "x",
      catalogId: "insurance_certificate",
      owner: "applicant",
      kind: "document",
      title: "Certificate of insurance",
      why: "",
      reviewer: "hl",
      dueDate: null,
      status: "submitted",
      unlocksOn: null,
      phase: "before_submitting",
      payload: {},
      history: [
        { at: "2027-04-20T09:00", actor: "applicant", status: "todo" },
        { at: "2027-04-28T09:00", actor: "applicant", status: "submitted" },
      ],
      tags: [],
    };
    expect(submittedOn(task)).toBe("2027-04-28");
    expect(daysWaiting(task, "2027-05-03")).toBe(5);
    expect(decidedOn(task)).toBeNull();
  });

  it("reads a decided card's own verdict and date from its history", () => {
    const base = {
      id: "x",
      catalogId: "insurance_certificate",
      owner: "applicant" as const,
      kind: "document" as const,
      title: "Certificate of insurance",
      why: "",
      reviewer: "hl" as const,
      dueDate: null,
      unlocksOn: null,
      phase: "before_submitting" as const,
      payload: {},
      tags: [],
    };
    const verified: Task = { ...base, status: "done", history: [{ at: "2027-04-21T11:00", actor: "hl", status: "done" }] };
    expect(decidedOn(verified)).toEqual({ verb: "Verified", date: "2027-04-21" });

    const sentBack: Task = { ...base, status: "changes_requested", history: [{ at: "2027-04-22T09:00", actor: "hl", status: "changes_requested" }] };
    expect(decidedOn(sentBack)).toEqual({ verb: "Sent back", date: "2027-04-22" });
  });
});
