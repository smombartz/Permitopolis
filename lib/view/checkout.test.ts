import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, DEFAULT_DEMO_TODAY } from "@/lib/rules";
import { buildSeed } from "@/lib/state";
import type { EventCase } from "@/lib/types";
import {
  afterQuotePaymentMessage,
  allAccepted,
  bookingEstimate,
  checkoutDecision,
  dueNowOf,
  isQuotePaid,
  planSummary,
  quoteDueNow,
  seriesQuoteNote,
  sessionAmount,
} from "./checkout";

const TODAY = DEFAULT_DEMO_TODAY;
const CFG = DEFAULT_CONFIG;

function caseById(cases: EventCase[], id: string): EventCase {
  const found = cases.find((c) => c.id === id);
  if (!found) throw new Error(`No seeded case ${id}`);
  return found;
}

describe("checkoutDecision", () => {
  const cases = buildSeed();

  it("S2 (Instant Draft, mid-wizard) is BOOKING", () => {
    const s2 = caseById(cases, "PMT-27-0142");
    expect(checkoutDecision(s2, {})).toEqual({ mode: "booking" });
  });

  it("S5 (Special event, Quote sent) is QUOTE", () => {
    const s5 = caseById(cases, "PMT-27-0097");
    expect(checkoutDecision(s5, {})).toEqual({ mode: "quote" });
  });

  it("S1 (Permitted, single event) has nothing to pay", () => {
    const s1 = caseById(cases, "PMT-27-0109");
    const decision = checkoutDecision(s1, {});
    expect(decision.mode).toBe("not_ready");
  });

  it("S3 (In review / Needs info, not yet quoted) says the quote is not ready", () => {
    const s3 = caseById(cases, "PMT-27-0118");
    const decision = checkoutDecision(s3, {});
    expect(decision.mode).toBe("not_ready");
    if (decision.mode === "not_ready") {
      expect(decision.info.message).toMatch(/quote isn't ready/i);
    }
  });

  it("a closed case with a bill owed is FINAL when ?pay=final is asked for", () => {
    // B20: Golden Years Senior Center spring carnival, closed with $50 still owed.
    const b20 = caseById(cases, "PMT-27-0042");
    expect(b20.state).toBe("closed");
    const decision = checkoutDecision(b20, { pay: "final" });
    expect(decision).toEqual({ mode: "final" });
  });

  it("a closed case with nothing owed refuses ?pay=final", () => {
    // B19: Summit Ridge Running Club downtown dash, closed with a full refund (nothing owed).
    const b19 = caseById(cases, "PMT-27-0040");
    expect(b19.state).toBe("closed");
    const decision = checkoutDecision(b19, { pay: "final" });
    expect(decision.mode).toBe("not_ready");
  });

  it("a permitted series' due session is SESSION when ?pay=session&date= names it", () => {
    // B16: Riverside Tai Chi Circle, event_day on the demo date with today's Monday session due.
    const b16 = caseById(cases, "PMT-27-0034");
    expect(b16.state).toBe("event_day");
    const decision = checkoutDecision(b16, { pay: "session", date: TODAY });
    expect(decision).toEqual({ mode: "session", occurrenceDate: TODAY });
  });

  it("?pay=session with an already-paid date refuses", () => {
    const b16 = caseById(cases, "PMT-27-0034");
    const decision = checkoutDecision(b16, { pay: "session", date: "2027-03-08" });
    expect(decision.mode).toBe("not_ready");
  });

  it("a Reviewed Draft (before create_board) is not ready, and points at the wizard", () => {
    const draft: EventCase = { ...caseById(cases, "PMT-27-0142"), tier: "reviewed" };
    const decision = checkoutDecision(draft, {});
    expect(decision.mode).toBe("not_ready");
    if (decision.mode === "not_ready") expect(decision.info.href).toContain("/apply");
  });

  it("an ended case has nothing to pay", () => {
    const withdrawn: EventCase = { ...caseById(cases, "PMT-27-0142"), ending: "withdrawn", endingReason: "Withdrawn." };
    const decision = checkoutDecision(withdrawn, {});
    expect(decision.mode).toBe("not_ready");
    if (decision.mode === "not_ready") expect(decision.info.message).toMatch(/withdrawn/i);
  });

  it("a case that already has its permit, with no pay param, links to the permit", () => {
    const s1 = caseById(cases, "PMT-27-0109");
    const decision = checkoutDecision(s1, {});
    expect(decision.mode).toBe("not_ready");
    if (decision.mode === "not_ready") expect(decision.info.href).toBe(`/events/${s1.id}/permit`);
  });
});

describe("planSummary", () => {
  const cases = buildSeed();

  it("describes a single event with its date and time range", () => {
    const s1 = caseById(cases, "PMT-27-0109");
    const plan = planSummary(s1);
    expect(plan.isSeries).toBe(false);
    expect(plan.sessionsCount).toBe(1);
    expect(plan.whenLabel).toContain("11 am to 4 pm");
    expect(plan.placeLabel).toContain("Shelter 3");
  });

  it("describes a series with its weekday, time and session count", () => {
    const s2 = caseById(cases, "PMT-27-0142");
    const plan = planSummary(s2);
    expect(plan.isSeries).toBe(true);
    expect(plan.sessionsCount).toBe(13);
    expect(plan.whenLabel).toContain("Sundays");
    expect(plan.whenLabel).toContain("13 sessions");
  });
});

describe("bookingEstimate / dueNowOf", () => {
  it("S2: 13 sessions at $20 each, $20 due now", () => {
    const cases = buildSeed();
    const s2 = caseById(cases, "PMT-27-0142");
    const ctx = { today: TODAY, cases, cfg: CFG };
    const estimate = bookingEstimate(s2, ctx);
    expect(estimate.sessions).toBe(13);
    expect(estimate.perSession).toBe(20);
    expect(dueNowOf(estimate)).toBe(20);
  });
});

describe("quoteDueNow / isQuotePaid", () => {
  it("S5: $6,530 due now, not yet paid", () => {
    const cases = buildSeed();
    const s5 = caseById(cases, "PMT-27-0097");
    expect(quoteDueNow(s5, CFG)).toBe(6530);
    expect(isQuotePaid(s5, CFG)).toBe(false);
  });
});

describe("seriesQuoteNote / sessionAmount", () => {
  it("is null for a single event and set for a series", () => {
    const cases = buildSeed();
    const s1 = caseById(cases, "PMT-27-0109");
    const s2 = caseById(cases, "PMT-27-0142");
    expect(seriesQuoteNote(s1, CFG)).toBeNull();
    const note = seriesQuoteNote(s2, CFG);
    expect(note).not.toBeNull();
    expect(note?.perSession).toBe(20);
    expect(note?.sessionsRemaining).toBe(12);
    expect(sessionAmount(s2, CFG)).toBe(20);
    expect(sessionAmount(s1, CFG)).toBe(0);
  });
});

describe("allAccepted", () => {
  it("is true only once every condition id is in the accepted list", () => {
    const conditions = [
      { id: "c1", dept: "pws" as const, text: "a", mergedByClerk: false, acceptedByApplicant: false },
      { id: "c2", dept: "hl" as const, text: "b", mergedByClerk: false, acceptedByApplicant: false },
    ];
    expect(allAccepted(conditions, [])).toBe(false);
    expect(allAccepted(conditions, ["c1"])).toBe(false);
    expect(allAccepted(conditions, ["c1", "c2"])).toBe(true);
    expect(allAccepted([], [])).toBe(true);
  });
});

describe("afterQuotePaymentMessage", () => {
  it("S5: insurance re-submitted but not yet verified -> waiting on Health & Legal", () => {
    const cases = buildSeed();
    const s5 = caseById(cases, "PMT-27-0097");
    expect(afterQuotePaymentMessage(s5)).toMatch(/Health & Legal/);
  });

  it("once insurance is done, the message names the Clerk's issue step", () => {
    const cases = buildSeed();
    const s5 = caseById(cases, "PMT-27-0097");
    const insured: EventCase = {
      ...s5,
      tasks: s5.tasks.map((t) => (t.catalogId === "insurance_certificate" ? { ...t, status: "done" } : t)),
    };
    expect(afterQuotePaymentMessage(insured)).toMatch(/City Clerk/);
  });
});
