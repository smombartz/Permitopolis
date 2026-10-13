import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, DEFAULT_DEMO_TODAY } from "@/lib/rules";
import { buildSeed, transition } from "@/lib/state";
import type { EventCase } from "@/lib/types";
import {
  dueRows,
  dueTotal,
  filterReceivedRows,
  groupReceivedRows,
  matchesPaymentsQuery,
  paymentsSummary,
  receivedRows,
  receivedTotal,
  refundsIssuedRows,
  refundsIssuedTotal,
  refundsOwedRows,
  seriesProgressSummary,
} from "./payments";

const TODAY = DEFAULT_DEMO_TODAY;
const CFG = DEFAULT_CONFIG;

function caseById(cases: EventCase[], id: string): EventCase {
  const found = cases.find((c) => c.id === id);
  if (!found) throw new Error(`No seeded case ${id}`);
  return found;
}

describe("dueRows", () => {
  const cases = buildSeed();

  it("lists the Oak Avenue block party, due by the hold's own expiry", () => {
    const rows = dueRows(cases, TODAY, CFG);
    const oakAve = caseById(cases, "PMT-27-0080");
    const row = rows.find((r) => r.caseId === "PMT-27-0080");
    expect(row).toBeDefined();
    expect(row!.kind).toBe("quote");
    expect(row!.eventName).toBe("Oak Avenue block party");
    expect(row!.dueDate).toBe("2027-05-06");
    expect(row!.amount).toBeGreaterThan(0);
    expect(row!.holdExpiresOn).toBe(oakAve.dateHold.expiresOn);
  });

  it("lists the Riverfront Summer 5K's $6,530 quote, due Fri, May 14", () => {
    const rows = dueRows(cases, TODAY, CFG);
    const row = rows.find((r) => r.caseId === "PMT-27-0097");
    expect(row).toMatchObject({ kind: "quote", amount: 6530, dueDate: "2027-05-14" });
  });

  it("is sorted oldest due first", () => {
    const rows = dueRows(cases, TODAY, CFG);
    const dated = rows.filter((r) => r.dueDate !== null);
    for (let i = 1; i < dated.length; i++) {
      expect(dated[i - 1].dueDate! <= dated[i].dueDate!).toBe(true);
    }
  });

  it("leaves out an ended case: nothing is owed once a case has an ending", () => {
    const rows = dueRows(cases, TODAY, CFG);
    for (const row of rows) {
      expect(caseById(cases, row.caseId).ending).toBeNull();
    }
  });
});

describe("receivedRows", () => {
  const cases = buildSeed();

  it("lists S6's $9,645, paid by card", () => {
    const rows = receivedRows(cases);
    const row = rows.find((r) => r.caseId === "PMT-27-0031");
    expect(row).toMatchObject({ amount: 9645, method: "card", kind: "quote" });
  });

  it("never includes a refund: that is the Refunds tab's own", () => {
    const rows = receivedRows(cases);
    expect(rows.every((r) => r.kind !== "refund")).toBe(true);
    expect(rows.every((r) => r.amount > 0)).toBe(true);
  });

  it("is newest first", () => {
    const rows = receivedRows(cases);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].at >= rows[i].at).toBe(true);
    }
  });

  it("S2's first session, right after booking", () => {
    const booked = transition(caseById(cases, "PMT-27-0142"), { type: "book_and_pay", method: "card" }, "applicant", {
      today: TODAY,
      cases,
      cfg: CFG,
    });
    if (!booked.ok) throw new Error(booked.reason);
    const rows = receivedRows([booked.case]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amount: 20, kind: "booking", method: "card" });
    expect(seriesProgressSummary(booked.case)).toBe("13 sessions: 1 paid, 12 upcoming");
  });
});

describe("filterReceivedRows and receivedTotal", () => {
  const cases = buildSeed();
  const rows = receivedRows(cases);

  it("filters by method: every payment in the seed was made by card", () => {
    expect(rows.length).toBeGreaterThan(0);
    expect(filterReceivedRows(rows, { method: "card" })).toHaveLength(rows.length);
    expect(filterReceivedRows(rows, { method: "in_person" })).toHaveLength(0);
  });

  it("filters by date range (the payment's own day)", () => {
    const filtered = filterReceivedRows(rows, { from: "2027-03-13", to: "2027-03-13" });
    expect(filtered.every((r) => r.at.slice(0, 10) === "2027-03-13")).toBe(true);
    expect(filtered.some((r) => r.caseId === "PMT-27-0031")).toBe(true);
  });

  it("totals the filtered set", () => {
    const s6Only = rows.filter((r) => r.caseId === "PMT-27-0031");
    expect(receivedTotal(s6Only)).toBe(9645);
  });
});

describe("groupReceivedRows", () => {
  it("collapses a series to one group with its progress summary", () => {
    const cases = buildSeed();
    const booked = transition(caseById(cases, "PMT-27-0142"), { type: "book_and_pay", method: "card" }, "applicant", {
      today: TODAY,
      cases,
      cfg: CFG,
    });
    if (!booked.ok) throw new Error(booked.reason);
    const groups = groupReceivedRows(receivedRows([booked.case]), [booked.case]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ isSeries: true, seriesSummary: "13 sessions: 1 paid, 12 upcoming" });
    expect(groups[0].rows).toHaveLength(1);
  });

  it("a single event is not a series", () => {
    const cases = buildSeed();
    const groups = groupReceivedRows(receivedRows(cases), cases).filter((g) => g.caseId === "PMT-27-0031");
    expect(groups[0]).toMatchObject({ isSeries: false, seriesSummary: null });
  });
});

describe("refunds", () => {
  const cases = buildSeed();

  it("B24's cancellation refund, with the band that produced it", () => {
    const rows = refundsIssuedRows(cases);
    const row = rows.find((r) => r.caseId === "PMT-27-0050");
    expect(row).toBeDefined();
    expect(row!.amount).toBeGreaterThan(0);
    expect(row!.rule).toMatch(/full refund/i);
  });

  it("every issued refund is a positive amount", () => {
    const rows = refundsIssuedRows(cases);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.amount > 0)).toBe(true);
  });

  it("refundsIssuedTotal sums the positive amounts", () => {
    const rows = refundsIssuedRows(cases);
    const manual = rows.reduce((s, r) => s + r.amount, 0);
    expect(refundsIssuedTotal(rows)).toBeCloseTo(manual, 2);
  });

  it("refundsOwedRows leaves out an ended case and a case still awaiting the cleanup log", () => {
    const rows = refundsOwedRows(cases);
    for (const row of rows) {
      const c = caseById(cases, row.caseId);
      expect(c.ending).toBeNull();
      expect(c.closeout.hoursLoggedOn).not.toBeNull();
    }
  });
});

describe("matchesPaymentsQuery", () => {
  it("matches the event, the applicant or the case id, case-insensitively", () => {
    expect(matchesPaymentsQuery("Oak Avenue block party", "Oak Avenue block captain", "PMT-27-0080", "oak")).toBe(true);
    expect(matchesPaymentsQuery("Oak Avenue block party", "Oak Avenue block captain", "PMT-27-0080", "pmt-27-0080")).toBe(true);
    expect(matchesPaymentsQuery("Oak Avenue block party", "Oak Avenue block captain", "PMT-27-0080", "riverfront")).toBe(false);
  });

  it("an empty query matches everything", () => {
    expect(matchesPaymentsQuery("Anything", "Anyone", "PMT-27-0001", "")).toBe(true);
  });
});

describe("paymentsSummary", () => {
  it("outstanding is dueTotal; collected and refunds issued are scoped to the demo month (May)", () => {
    const cases = buildSeed();
    const summary = paymentsSummary(cases, TODAY, CFG);
    expect(summary.outstanding).toBe(dueTotal(dueRows(cases, TODAY, CFG)));
    // S6's payment was made in March, so it does not count toward "collected this month".
    expect(summary.collectedThisMonth).toBe(
      receivedTotal(receivedRows(cases).filter((r) => r.at.slice(0, 7) === "2027-05")),
    );
    expect(summary.refundsIssuedThisMonth).toBe(
      refundsIssuedTotal(refundsIssuedRows(cases).filter((r) => r.at.slice(0, 7) === "2027-05")),
    );
  });
});
