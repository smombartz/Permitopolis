import { describe, expect, it } from "vitest";
import { addDaysISO } from "@/lib/dates";
import { DEFAULT_CONFIG, DEFAULT_DEMO_TODAY, dueDate } from "@/lib/rules";
import { buildSeed, closeoutSettlement, transition } from "@/lib/state";
import { makeCase } from "@/lib/state/testSupport";
import type { EventCase } from "@/lib/types";
import {
  addConditionRow,
  addQuoteLineRow,
  computeQuoteTotals,
  conditionIdsInConflict,
  conditionRowsFromCase,
  conditionRowsToDrafts,
  defaultReviewDueDate,
  depositAmountFor,
  detectConditionConflicts,
  issuePermitChecklist,
  leadTimeLeftAfterRouting,
  moveConditionRow,
  overdueSessionDates,
  paymentRows,
  quoteLineAmount,
  quoteLineRowsFromCase,
  quoteLineRowsToDrafts,
  reconciliationLines,
  removeConditionRow,
  removeQuoteLineRow,
  requestableCardGroups,
  updateConditionRow,
  updateQuoteLineRow,
} from "./clerkTools";

const TODAY = DEFAULT_DEMO_TODAY;
const CFG = DEFAULT_CONFIG;

function ctxFor(cases: EventCase[]) {
  return { today: TODAY, cases, cfg: CFG };
}

function caseById(cases: EventCase[], id: string): EventCase {
  const found = cases.find((c) => c.id === id);
  if (!found) throw new Error(`No seeded case ${id}`);
  return found;
}

/* ---------------------------------------------------------------------------------------- */
/* Conflict detection                                                                        */
/* ---------------------------------------------------------------------------------------- */

describe("detectConditionConflicts", () => {
  it("flags two departments setting different times for the same thing", () => {
    const conditions = [
      { id: "c1", dept: "pws" as const, text: "Sound ends at 9 pm", mergedByClerk: false, acceptedByApplicant: false },
      { id: "c2", dept: "hl" as const, text: "Sound ends at 10 pm", mergedByClerk: false, acceptedByApplicant: false },
    ];
    const conflicts = detectConditionConflicts(conditions);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe("value");
    expect(conflicts[0].conditions.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("flags different numeric limits for the same thing", () => {
    const conditions = [
      { id: "c1", dept: "pws" as const, text: "No more than 85 dB at 50 feet", mergedByClerk: false, acceptedByApplicant: false },
      { id: "c2", dept: "hl" as const, text: "No more than 90 dB at 60 feet", mergedByClerk: false, acceptedByApplicant: false },
    ];
    expect(detectConditionConflicts(conditions)).toHaveLength(1);
  });

  it("flags an exact duplicate, even from the same department", () => {
    const text = "A copy of the permit is on site at all times";
    const conditions = [
      { id: "c1", dept: "clerk" as const, text, mergedByClerk: false, acceptedByApplicant: false },
      { id: "c2", dept: "clerk" as const, text, mergedByClerk: false, acceptedByApplicant: false },
    ];
    const conflicts = detectConditionConflicts(conditions);
    expect(conflicts).toEqual([{ key: expect.any(String), kind: "duplicate", conditions }]);
  });

  it("does not conflict when the conditions are about different things", () => {
    const conditions = [
      { id: "c1", dept: "pws" as const, text: "8 officers on the route", mergedByClerk: false, acceptedByApplicant: false },
      { id: "c2", dept: "hl" as const, text: "One accessible restroom per 300 attendees", mergedByClerk: false, acceptedByApplicant: false },
    ];
    expect(detectConditionConflicts(conditions)).toEqual([]);
  });

  it("does not flag the same numeric shape from the same department alone as a value conflict", () => {
    const conditions = [
      { id: "c1", dept: "pws" as const, text: "40 barricades", mergedByClerk: false, acceptedByApplicant: false },
      { id: "c2", dept: "pws" as const, text: "20 barricades", mergedByClerk: false, acceptedByApplicant: false },
    ];
    // Same department, different numbers: not flagged as a cross-department conflict.
    expect(detectConditionConflicts(conditions)).toEqual([]);
  });

  it("S3's three Public Works & Safety conditions, with nothing from another department yet, do not conflict", () => {
    const cases = buildSeed();
    const s3 = caseById(cases, "PMT-27-0118");
    expect(detectConditionConflicts(s3.conditions)).toEqual([]);
  });

  it("conditionIdsInConflict collects every id named by a conflict", () => {
    const conditions = [
      { id: "c1", dept: "pws" as const, text: "Sound ends at 9 pm", mergedByClerk: false, acceptedByApplicant: false },
      { id: "c2", dept: "hl" as const, text: "Sound ends at 10 pm", mergedByClerk: false, acceptedByApplicant: false },
      { id: "c3", dept: "clerk" as const, text: "Unrelated condition", mergedByClerk: false, acceptedByApplicant: false },
    ];
    expect(conditionIdsInConflict(detectConditionConflicts(conditions))).toEqual(new Set(["c1", "c2"]));
  });
});

/* ---------------------------------------------------------------------------------------- */
/* Merged conditions list                                                                    */
/* ---------------------------------------------------------------------------------------- */

describe("the merged conditions list", () => {
  it("starts from the case's conditions, in order", () => {
    const cases = buildSeed();
    const s3 = caseById(cases, "PMT-27-0118");
    const rows = conditionRowsFromCase(s3);
    expect(rows).toEqual(s3.conditions.map((c) => ({ id: c.id, dept: c.dept, text: c.text })));
  });

  it("adds, edits, removes and reorders rows", () => {
    let rows = conditionRowsFromCase(makeCase());
    rows = addConditionRow(rows, { id: "a", dept: "pws", text: "First" });
    rows = addConditionRow(rows, { id: "b", dept: "hl", text: "Second" });
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);

    rows = updateConditionRow(rows, "a", { text: "First, edited" });
    expect(rows.find((r) => r.id === "a")?.text).toBe("First, edited");

    rows = moveConditionRow(rows, "b", -1);
    expect(rows.map((r) => r.id)).toEqual(["b", "a"]);
    // A move past either end is a no-op.
    expect(moveConditionRow(rows, "b", -1)).toEqual(rows);

    rows = removeConditionRow(rows, "a");
    expect(rows.map((r) => r.id)).toEqual(["b"]);
  });

  it("drops blank rows and trims text when building the draft send_quote takes", () => {
    const rows = [
      { id: "a", dept: "pws" as const, text: "  Sound ends at 9 pm  " },
      { id: "b", dept: "hl" as const, text: "   " },
    ];
    expect(conditionRowsToDrafts(rows)).toEqual([{ dept: "pws", text: "Sound ends at 9 pm" }]);
  });
});

/* ---------------------------------------------------------------------------------------- */
/* The quote's fee lines and totals                                                          */
/* ---------------------------------------------------------------------------------------- */

describe("the quote's fee-line rows and totals", () => {
  it("S3: $715 from the seed's lines, deposit kept out of the editable rows", () => {
    const cases = buildSeed();
    const s3 = caseById(cases, "PMT-27-0118");
    const rows = quoteLineRowsFromCase(s3);
    expect(rows.some((r) => r.kind === "deposit")).toBe(false);
    const deposit = depositAmountFor(s3);
    expect(deposit).toBe(250);
    const totals = computeQuoteTotals(rows, deposit, s3, CFG, TODAY);
    expect(totals).toMatchObject({ feesSubtotal: 465, deposit: 250, total: 715, dueNow: 715 });
    expect(totals.holdExpiresOn).toBe(addDaysISO(TODAY, CFG.hold.daysAfterQuote));
  });

  it("editing a line's quantity or price changes the total and what toDrafts sends", () => {
    const cases = buildSeed();
    const s3 = caseById(cases, "PMT-27-0118");
    let rows = quoteLineRowsFromCase(s3);
    const soundLine = rows.find((r) => r.label === "Amplified sound")!;
    rows = updateQuoteLineRow(rows, soundLine.id, { unitPrice: 80 });
    expect(quoteLineAmount(rows.find((r) => r.id === soundLine.id)!)).toBe(80);
    const totals = computeQuoteTotals(rows, depositAmountFor(s3), s3, CFG, TODAY);
    expect(totals.total).toBe(755); // 715 + (80 - 40)
    expect(quoteLineRowsToDrafts(rows).find((d) => d.label === "Amplified sound")).toMatchObject({ unitPrice: 80 });
  });

  it("adding and removing rows changes the total", () => {
    const cases = buildSeed();
    const s3 = caseById(cases, "PMT-27-0118");
    let rows = quoteLineRowsFromCase(s3);
    const before = computeQuoteTotals(rows, depositAmountFor(s3), s3, CFG, TODAY).total;
    rows = addQuoteLineRow(rows, { id: "new", dept: "pws", label: "Extra barricade", qty: 2, unit: "each", unitPrice: 15, kind: "fee" });
    const afterAdd = computeQuoteTotals(rows, depositAmountFor(s3), s3, CFG, TODAY).total;
    expect(afterAdd).toBe(before + 30);
    rows = removeQuoteLineRow(rows, "new");
    expect(computeQuoteTotals(rows, depositAmountFor(s3), s3, CFG, TODAY).total).toBe(before);
  });

  it("a series' quote is due now only for its one-off lines and first session (dueAtQuote's own math)", () => {
    const cases = buildSeed();
    // S2, Sunrise Yoga Club: a 13-session Instant series. Build it to In review-shaped fee lines
    // for the math alone; dueNow should equal total minus 12 later sessions at $20 each.
    const s2 = caseById(cases, "PMT-27-0142");
    const rows = quoteLineRowsFromCase({ ...s2, feeLines: [{ id: "f1", dept: "clerk", label: "Field reservation", qty: 13, unit: "hour", unitPrice: 20, estimate: 260, actual: null, kind: "fee" }] });
    const totals = computeQuoteTotals(rows, 0, s2, CFG, TODAY);
    expect(totals.total).toBe(260);
    expect(totals.dueNow).toBe(20);
  });
});

/* ---------------------------------------------------------------------------------------- */
/* Confirm routing defaults                                                                  */
/* ---------------------------------------------------------------------------------------- */

describe("routing defaults", () => {
  it("S4 (Reviewed): today plus the tier's review days, never a weekend", () => {
    const cases = buildSeed();
    const s4 = caseById(cases, "PMT-27-0126");
    const due = defaultReviewDueDate(s4, CFG, TODAY);
    expect(due).toBe(dueDate(TODAY, CFG.sla.reviewDays.reviewed, CFG));
    expect(due).toBe("2027-05-17");
  });

  it("leadTimeLeftAfterRouting: days left between the latest due date and the event", () => {
    const cases = buildSeed();
    const s4 = caseById(cases, "PMT-27-0126"); // event day 2027-06-26
    expect(leadTimeLeftAfterRouting(s4, "2027-05-17")).toBe(40);
    expect(leadTimeLeftAfterRouting(s4, "2027-06-26")).toBe(0);
  });

  it("is null when the case has no date yet", () => {
    expect(leadTimeLeftAfterRouting(makeCase({ schedule: null }), "2027-05-17")).toBeNull();
  });
});

/* ---------------------------------------------------------------------------------------- */
/* Request information: cards grouped by status                                             */
/* ---------------------------------------------------------------------------------------- */

describe("requestableCardGroups", () => {
  it("S3: groups the applicant's cards by status, covering every applicant card exactly once", () => {
    const cases = buildSeed();
    const s3 = caseById(cases, "PMT-27-0118");
    const groups = requestableCardGroups(s3);
    const statuses = groups.map((g) => g.status);
    expect(new Set(statuses).size).toBe(statuses.length); // each status appears once
    for (const group of groups) {
      expect(group.cards.every((t) => t.status === group.status)).toBe(true);
      expect(group.cards.every((t) => t.owner === "applicant")).toBe(true);
    }
    const applicantCards = s3.tasks.filter((t) => t.owner === "applicant");
    expect(groups.reduce((sum, g) => sum + g.cards.length, 0)).toBe(applicantCards.length);
    // The pinned request sits on the health permit card, still "todo" with the request attached.
    const pinned = groups.find((g) => g.status === "todo")?.cards.find((t) => t.id === `${s3.id}:vendor_health_permit:1`);
    expect(pinned?.request?.resolved).toBe(false);
  });
});

/* ---------------------------------------------------------------------------------------- */
/* Issue permit checklist                                                                    */
/* ---------------------------------------------------------------------------------------- */

describe("issuePermitChecklist (S5)", () => {
  it("before anything: all three unmet", () => {
    const cases = buildSeed();
    const s5 = caseById(cases, "PMT-27-0097");
    const items = issuePermitChecklist(s5);
    expect(items.map((i) => i.key)).toEqual(["signature", "payment", "insurance"]);
    expect(items.map((i) => i.done)).toEqual([false, false, false]);
  });

  it("once Health & Legal verifies, the applicant signs and pays: all three met", () => {
    const cases = buildSeed();
    let s5 = caseById(cases, "PMT-27-0097");
    const verify = transition(s5, { type: "verify_document", taskId: `${s5.id}:insurance_certificate` }, "hl", ctxFor(cases));
    if (!verify.ok) throw new Error(verify.reason);
    s5 = verify.case;
    expect(issuePermitChecklist(s5).find((i) => i.key === "insurance")?.done).toBe(true);

    const signed = transition(s5, { type: "accept_and_sign", signature: "Simone Dubois" }, "applicant", ctxFor(cases));
    if (!signed.ok) throw new Error(signed.reason);
    s5 = signed.case;
    expect(issuePermitChecklist(s5).find((i) => i.key === "signature")?.done).toBe(true);
    expect(issuePermitChecklist(s5).find((i) => i.key === "payment")?.done).toBe(false);

    const paid = transition(s5, { type: "pay", amount: 6530, method: "card", kind: "quote" }, "applicant", ctxFor(cases));
    if (!paid.ok) throw new Error(paid.reason);
    s5 = paid.case;
    const final = issuePermitChecklist(s5);
    expect(final.every((i) => i.done)).toBe(true);
    // Every item has a "since" date once it has something to show.
    expect(final.every((i) => i.sinceDate !== null)).toBe(true);
  });
});

/* ---------------------------------------------------------------------------------------- */
/* Closeout reconciliation                                                                   */
/* ---------------------------------------------------------------------------------------- */

describe("reconciliationLines (S6)", () => {
  it("$750 over in total, from the Police and Cleanup crew lines, and closeoutSettlement reads a $250 refund", () => {
    const cases = buildSeed();
    const s6 = caseById(cases, "PMT-27-0031");
    const police = s6.feeLines.find((l) => l.label === "Police")!;
    const logged = transition(
      s6,
      {
        type: "log_closeout",
        cleanup: "pass",
        notes: "Street swept and reopened by 11 pm.",
        actuals: [{ feeLineId: police.id, qty: 72 }],
        extraLines: [{ dept: "pws", label: "Cleanup crew", qty: 4, unit: "worker-hour", unitPrice: CFG.fees.cleanupCrewPerWorkerHour }],
      },
      "pws",
      ctxFor(cases),
    );
    if (!logged.ok) throw new Error(logged.reason);

    const lines = reconciliationLines(logged.case);
    expect(lines.find((l) => l.label === "Police")).toMatchObject({ estimate: 5610, actual: 6120, difference: 510 });
    expect(lines.find((l) => l.label === "Cleanup crew")).toMatchObject({ estimate: 0, actual: 240, difference: 240 });
    const total = lines.reduce((sum, l) => sum + (l.difference ?? 0), 0);
    expect(total).toBe(750);

    const settlement = closeoutSettlement(logged.case);
    expect(settlement).toMatchObject({ over: 750, deposit: 1000, fromDeposit: 750, refund: 250, bill: null });
  });

  it("a line never logged keeps its estimate, with no difference shown", () => {
    const cases = buildSeed();
    const s6 = caseById(cases, "PMT-27-0031");
    const police = s6.feeLines.find((l) => l.label === "Police")!;
    const logged = transition(s6, { type: "log_closeout", cleanup: "pass", actuals: [{ feeLineId: police.id, qty: 72 }], extraLines: [] }, "pws", ctxFor(cases));
    if (!logged.ok) throw new Error(logged.reason);
    const application = reconciliationLines(logged.case).find((l) => l.label === "Application fee")!;
    expect(application.actual).toBe(application.estimate);
    expect(application.difference).toBe(0);
  });
});

/* ---------------------------------------------------------------------------------------- */
/* Payments, for the Conditions and fees tab                                                 */
/* ---------------------------------------------------------------------------------------- */

describe("overdueSessionDates", () => {
  it("S2 (a 13-session Draft, nothing paid yet) has no series on the schedule to be overdue on", () => {
    const cases = buildSeed();
    const s2 = caseById(cases, "PMT-27-0142");
    expect(overdueSessionDates(s2)).toEqual([]);
  });

  it("lists every session marked due, earliest first", () => {
    const c = makeCase({
      schedule: {
        date: "2027-06-06",
        start: "08:00",
        end: "09:00",
        recurrence: { frequency: "weekly", weekday: 0, until: "2027-06-20" },
        occurrences: [
          { date: "2027-06-06", availability: { status: "open" }, billing: "due" },
          { date: "2027-06-13", availability: { status: "open" }, billing: "upcoming" },
          { date: "2027-06-20", availability: { status: "open" }, billing: "due" },
        ],
      },
    });
    expect(overdueSessionDates(c)).toEqual(["2027-06-06", "2027-06-20"]);
  });
});

describe("paymentRows", () => {
  it("newest first, with a plain-language label for each kind", () => {
    const c = makeCase({
      payments: [
        { id: "p1", at: "2027-04-01T09:00", amount: 100, method: "card", kind: "quote" },
        { id: "p2", at: "2027-04-02T09:00", amount: -20, method: "in_person", kind: "refund" },
      ],
    });
    const rows = paymentRows(c);
    expect(rows.map((r) => r.id)).toEqual(["p2", "p1"]);
    expect(rows[0]).toMatchObject({ amount: -20, method: "in_person", label: "Refund" });
    expect(rows[1]).toMatchObject({ amount: 100, method: "card", label: "Quote payment" });
  });

  it("names the session date for a session payment", () => {
    const c = makeCase({ payments: [{ id: "p1", at: "2027-06-08T09:00", amount: 20, method: "card", kind: "session", occurrenceDate: "2027-06-08" }] });
    expect(paymentRows(c)[0].label).toBe("Session payment: 2027-06-08");
  });
});
