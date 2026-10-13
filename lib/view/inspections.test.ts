import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, DEFAULT_DEMO_TODAY } from "@/lib/rules/config";
import { buildSeed, transition } from "@/lib/state";
import { makeCase, makeTask } from "@/lib/state/testSupport";
import type { EventCase } from "@/lib/types";
import { boothRowsFor, buildInspectionGroups, formatInspectionNote, groupsByBucket, parseInspectionNote } from "./inspections";

const TODAY = DEFAULT_DEMO_TODAY;

function act(c: EventCase, action: Parameters<typeof transition>[1], actor: Parameters<typeof transition>[2], today = TODAY): EventCase {
  const result = transition(c, action, actor, { today, cases: [c], cfg: DEFAULT_CONFIG });
  if (!result.ok) throw new Error(`refused: ${result.reason}`);
  return result.case;
}

/** S3, Jazz in the Plaza, walked through Path 3 (tests/demo-paths.test.ts) to Permitted. */
function permittedS3(): EventCase {
  const cases = buildSeed();
  let s3 = cases.find((c) => c.id === "PMT-27-0118")!;
  const healthPermit = `${s3.id}:vendor_health_permit:1`;
  s3 = act(s3, { type: "respond_to_request", taskId: healthPermit, files: [{ name: "health-permit.pdf", size: 120_000, type: "application/pdf" }] }, "applicant");
  s3 = act(s3, { type: "verify_document", taskId: healthPermit }, "hl");
  s3 = act(s3, { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }, "hl");
  s3 = act(
    s3,
    {
      type: "send_quote",
      conditions: s3.conditions.map((cond) => ({ dept: cond.dept, text: cond.text })),
      feeLines: s3.feeLines.map((line) => ({ dept: line.dept, label: line.label, qty: line.qty, unit: line.unit, unitPrice: line.unitPrice, kind: line.kind })),
    },
    "clerk",
  );
  s3 = act(s3, { type: "accept_and_sign", signature: "Jordan Alvarez" }, "applicant");
  s3 = act(s3, { type: "pay", amount: 715, method: "card", kind: "quote" }, "applicant");
  s3 = act(s3, { type: "issue_permit" }, "clerk");
  expect(s3.state).toBe("permitted");
  return s3;
}

describe("formatInspectionNote / parseInspectionNote", () => {
  it("round-trips a result with a note", () => {
    const text = formatInspectionNote("Rolling Dumpling Co.", "pass", "Clean prep surfaces, valid permit posted.");
    expect(text).toBe("Food booth inspection: Rolling Dumpling Co.: pass. Clean prep surfaces, valid permit posted.");
    expect(parseInspectionNote(text)).toEqual({ vendorName: "Rolling Dumpling Co.", result: "pass", note: "Clean prep surfaces, valid permit posted." });
  });

  it("round-trips a result with no note", () => {
    const text = formatInspectionNote("Rolling Dumpling Co.", "fail", "");
    expect(text).toBe("Food booth inspection: Rolling Dumpling Co.: fail.");
    expect(parseInspectionNote(text)).toEqual({ vendorName: "Rolling Dumpling Co.", result: "fail", note: "" });
  });

  it("is null for an ordinary activity entry", () => {
    expect(parseInspectionNote("Started a draft.")).toBeNull();
  });
});

describe("boothRowsFor", () => {
  it("S6's 25 vendors each get a booth row, none recorded yet", () => {
    const s6 = buildSeed().find((c) => c.id === "PMT-27-0031")!;
    const rows = boothRowsFor(s6);
    expect(rows).toHaveLength(25);
    expect(rows.every((row) => row.result === null)).toBe(true);
  });

  it("reads back the most recent recorded result for a vendor", () => {
    let s6 = buildSeed().find((c) => c.id === "PMT-27-0031")!;
    const note = formatInspectionNote("Food Truck 1", "fail", "Hand-wash station empty.");
    s6 = act(s6, { type: "add_note", text: note }, "hl");
    const second = formatInspectionNote("Food Truck 1", "re-inspect", "Refilled; recheck tomorrow.");
    s6 = act(s6, { type: "add_note", text: second }, "hl");
    const row = boothRowsFor(s6).find((r) => r.vendorName === "Food Truck 1")!;
    expect(row.result).toBe("re-inspect");
    expect(row.note).toBe("Refilled; recheck tomorrow.");
    // The other 24 vendors are untouched.
    expect(boothRowsFor(s6).filter((r) => r.result !== null)).toHaveLength(1);
  });
});

describe("buildInspectionGroups", () => {
  it("on May 3, only an event with vendors already inside the 14-day window shows up", () => {
    const cases = buildSeed();
    const groups = buildInspectionGroups(cases, TODAY);
    // St. Agnes Parish's festival, May 13, is the one seeded case with food vendors whose day
    // falls in the window; Jazz in the Plaza (Jun 18) and the Food Truck Festival (past) do not.
    expect(groups.map((g) => g.caseId)).toEqual(["PMT-27-0012"]);
    expect(groups[0].bucket).toBe("upcoming");
  });

  it("jumping the demo date to Jun 18, after Jazz in the Plaza is permitted, shows its one booth", () => {
    const s3 = permittedS3();
    const groups = buildInspectionGroups([s3], "2027-06-18");
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ caseId: "PMT-27-0118", caseName: "Jazz in the Plaza", eventDate: "2027-06-18", bucket: "today" });
    expect(groups[0].booths).toHaveLength(1);
    expect(groups[0].booths[0].vendorName).toBe("Rolling Dumpling Co.");
  });

  it("an event within the next 14 days, but not today, is Upcoming", () => {
    const s3 = permittedS3();
    const groups = buildInspectionGroups([s3], "2027-06-10");
    expect(groups[0].bucket).toBe("upcoming");
  });

  it("leaves out an ended case even with vendor cards", () => {
    let s3 = permittedS3();
    s3 = act(s3, { type: "cancel" }, "applicant", "2027-06-01");
    expect(s3.ending).not.toBeNull();
    expect(buildInspectionGroups([s3], "2027-06-18")).toEqual([]);
  });
});

describe("groupsByBucket", () => {
  it("splits today's events from the rest", () => {
    const s3 = permittedS3();
    const groups = buildInspectionGroups([s3], "2027-06-18");
    const split = groupsByBucket(groups);
    expect(split.today).toHaveLength(1);
    expect(split.upcoming).toHaveLength(0);
  });
});

describe("a Draft is never on the inspections list", () => {
  it("an applicant's draft with food vendors next week is the applicant's alone", () => {
    const vendor = makeTask({ id: "PMT-27-0001:vendor_health_permit:1", catalogId: "vendor_health_permit", payload: { vendorName: "Taco Cart" } });
    const schedule = { date: "2027-05-08", start: "11:00", end: "15:00", occurrences: [{ date: "2027-05-08", availability: { status: "open" as const }, billing: "upcoming" as const }] };
    const draft = makeCase({ state: "draft", schedule, tasks: [vendor] });
    expect(buildInspectionGroups([draft], "2027-05-03")).toEqual([]);
    // The same plan once it is with the city is listed, named as every list names an event.
    const submitted = { ...draft, state: "submitted" as const, name: "Spring cookout", applicantId: "maya-chen" };
    expect(buildInspectionGroups([submitted], "2027-05-03")).toMatchObject([{ caseName: "Spring cookout", applicantName: "Maya Chen", tier: "instant", eventDate: "2027-05-08", bucket: "upcoming" }]);
  });
});
