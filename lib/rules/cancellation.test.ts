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
});
