import { describe, expect, it } from "vitest";
import { cancellationRefund } from "./cancellation";
import { eventCase, inventoryLocation } from "./test-helpers";

describe("cancellationRefund", () => {
  it("S1: cancelling on 2027-05-03 (19 days before May 22) refunds exactly $62.50", () => {
    const s1 = eventCase({
      id: "PMT-27-0001",
      state: "permitted",
      location: inventoryLocation(["shelter-3"]),
      schedule: { date: "2027-05-22", start: "11:00", end: "16:00", occurrences: [{ date: "2027-05-22", availability: { status: "open" }, billing: "upcoming" }] },
      feeLines: [{ id: "f1", dept: "clerk", label: "Shelter reservation", qty: 5, unit: "hour", unitPrice: 25, estimate: 125, actual: null, kind: "fee" }],
    });
    const result = cancellationRefund(s1, "2027-05-03");
    expect(result.refund).toBe(62.5);
  });

  it("30 or more days before: full refund minus the $10 processing fee, application fee included", () => {
    const c = eventCase({
      id: "PMT-27-0002",
      feeLines: [
        { id: "f1", dept: "clerk", label: "Application fee", qty: 1, unit: "application", unitPrice: 50, estimate: 50, actual: null, kind: "fee" },
        { id: "f2", dept: "clerk", label: "City Hall Plaza reservation", qty: 1, unit: "day", unitPrice: 300, estimate: 300, actual: null, kind: "fee" },
        { id: "f3", dept: "clerk", label: "Refundable cleanup deposit", qty: 1, unit: "deposit", unitPrice: 250, estimate: 250, actual: null, kind: "deposit" },
      ],
      schedule: { date: "2027-07-01", start: "10:00", end: "12:00", occurrences: [] },
    });
    const result = cancellationRefund(c, "2027-05-03");
    expect(result.refund).toBe(340); // (50+300) - 10, deposit excluded
  });

  it("under 10 days: no refund of fees", () => {
    const c = eventCase({
      id: "PMT-27-0003",
      feeLines: [{ id: "f1", dept: "clerk", label: "Application fee", qty: 1, unit: "application", unitPrice: 50, estimate: 50, actual: null, kind: "fee" }],
      schedule: { date: "2027-05-05", start: "10:00", end: "12:00", occurrences: [] },
    });
    const result = cancellationRefund(c, "2027-05-03");
    expect(result.refund).toBe(0);
  });

  it("never goes below zero", () => {
    const c = eventCase({
      id: "PMT-27-0004",
      feeLines: [{ id: "f1", dept: "clerk", label: "City Hall Plaza reservation", qty: 1, unit: "day", unitPrice: 5, estimate: 5, actual: null, kind: "fee" }],
      schedule: { date: "2027-05-20", start: "10:00", end: "12:00", occurrences: [] },
    });
    const result = cancellationRefund(c, "2027-05-03");
    expect(result.refund).toBeGreaterThanOrEqual(0);
  });

  it("uses the next upcoming session for a series", () => {
    const c = eventCase({
      id: "PMT-27-0005",
      feeLines: [{ id: "f1", dept: "clerk", label: "Field reservation", qty: 1, unit: "hour", unitPrice: 20, estimate: 20, actual: null, kind: "fee" }],
      schedule: {
        date: "2027-06-06",
        start: "08:00",
        end: "09:00",
        recurrence: { frequency: "weekly", weekday: 0, until: "2027-08-29" },
        occurrences: [
          { date: "2027-06-06", availability: { status: "open" }, billing: "upcoming" },
          { date: "2027-06-13", availability: { status: "open" }, billing: "upcoming" },
        ],
      },
    });
    const result = cancellationRefund(c, "2027-06-10");
    expect(result.rule).toMatch(/Under 10 days/i);
  });

  describe("a series is billed session by session, so the band applies to what was paid", () => {
    // Sunrise Yoga: 13 Sunday sessions at $20, the first one paid at booking.
    const dates = ["2027-06-06", "2027-06-13", "2027-06-20", "2027-06-27", "2027-07-04", "2027-07-11", "2027-07-18", "2027-07-25", "2027-08-01", "2027-08-08", "2027-08-15", "2027-08-22", "2027-08-29"];
    const yoga = (paidSessions: number) =>
      eventCase({
        id: "PMT-27-0007",
        state: "permitted",
        feeLines: [{ id: "f1", dept: "clerk", label: "Field reservation", qty: 13, unit: "session", unitPrice: 20, estimate: 260, actual: null, kind: "fee" }],
        schedule: {
          date: dates[0],
          start: "07:00",
          end: "08:00",
          recurrence: { frequency: "weekly", weekday: 0, until: "2027-08-29" },
          occurrences: dates.map((date, i) => ({ date, availability: { status: "open" as const }, billing: i < paidSessions ? ("paid" as const) : ("upcoming" as const) })),
        },
        payments: Array.from({ length: paidSessions }, (_, i) => ({ id: `p${i + 1}`, at: "2027-05-03T09:00", amount: 20, method: "card" as const, kind: i === 0 ? ("booking" as const) : ("session" as const), occurrenceDate: dates[i] })),
      });

    it("one session paid, 34 days out: the $20 paid minus the $10 processing fee, not $250 of sessions never paid for", () => {
      expect(cancellationRefund(yoga(1), "2027-05-03")).toMatchObject({ refund: 10, kept: 10, rule: "30 or more days before: full refund minus a $10 processing fee" });
    });

    it("never more than the fee lines, and nothing when nothing was paid", () => {
      expect(cancellationRefund(yoga(13), "2027-05-03").refund).toBe(250);
      expect(cancellationRefund(yoga(0), "2027-05-03").refund).toBe(0);
    });

    it("a deposit and a late fee paid with the quote are not fees the band refunds", () => {
      const c = yoga(1);
      const quoted = {
        ...c,
        feeLines: [
          ...c.feeLines,
          { id: "f2", dept: "clerk" as const, label: "Refundable cleanup deposit", qty: 1, unit: "deposit", unitPrice: 250, estimate: 250, actual: null, kind: "deposit" as const },
          { id: "f3", dept: "clerk" as const, label: "Late fee", qty: 1, unit: "fee", unitPrice: 65, estimate: 65, actual: null, kind: "late_fee" as const },
        ],
        payments: [{ id: "p1", at: "2027-05-03T09:00", amount: 335, method: "card" as const, kind: "quote" as const }],
      };
      // $335 paid: the $250 deposit, the $65 late fee and one $20 session.
      expect(cancellationRefund(quoted, "2027-05-03").refund).toBe(10);
    });

    it("a single event is not capped by its payments: the schedule is its fee lines", () => {
      const single = eventCase({
        id: "PMT-27-0008",
        feeLines: [{ id: "f1", dept: "clerk", label: "Shelter reservation", qty: 5, unit: "hour", unitPrice: 25, estimate: 125, actual: null, kind: "fee" }],
        schedule: { date: "2027-07-01", start: "10:00", end: "15:00", occurrences: [] },
      });
      expect(cancellationRefund(single, "2027-05-03").refund).toBe(115);
    });
  });

  it("a session skipped for a blackout is never the next session", () => {
    const c = eventCase({
      id: "PMT-27-0006",
      feeLines: [{ id: "f1", dept: "clerk", label: "Field reservation", qty: 2, unit: "hour", unitPrice: 20, estimate: 40, actual: null, kind: "fee" }],
      schedule: {
        date: "2027-05-24",
        start: "08:00",
        end: "09:00",
        recurrence: { frequency: "weekly", weekday: 1, until: "2027-06-14" },
        occurrences: [
          { date: "2027-05-24", availability: { status: "open" }, billing: "paid" },
          { date: "2027-05-31", availability: { status: "blackout" }, billing: "skipped" },
          { date: "2027-06-14", availability: { status: "open" }, billing: "upcoming" },
        ],
      },
    });
    // On May 26 the next held session is Jun 14 (19 days away), not the skipped May 31 (5 days away).
    expect(cancellationRefund(c, "2027-05-26").rule).toMatch(/10 to 29 days/i);
  });
});
