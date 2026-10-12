import { describe, expect, it } from "vitest";
import { makeCase, makeCtx, makeTask } from "../testSupport";
import { transition } from "../transition";

describe("pay", () => {
  it("kind quote finishes pay_fees and records the payment", () => {
    const payFees = makeTask({ id: "PMT-27-0001:pay_fees", catalogId: "pay_fees", kind: "payment" });
    const c = makeCase({ state: "quote_sent", tasks: [payFees] });
    const result = transition(c, { type: "pay", amount: 715, method: "card", kind: "quote" }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.payments).toHaveLength(1);
    expect(result.case.tasks[0].status).toBe("done");
  });

  it("fails kind quote outside Quote sent", () => {
    const c = makeCase({ state: "in_review" });
    const result = transition(c, { type: "pay", amount: 715, method: "card", kind: "quote" }, "applicant", makeCtx());
    expect(result.ok).toBe(false);
  });

  it("kind session, by the Clerk in person, marks that occurrence paid", () => {
    const c = makeCase({
      state: "permitted",
      schedule: { date: "2027-06-06", start: "08:00", end: "09:00", occurrences: [{ date: "2027-06-06", availability: { status: "open" }, billing: "paid" }, { date: "2027-06-13", availability: { status: "open" }, billing: "upcoming" }] },
    });
    const result = transition(c, { type: "pay", amount: 20, method: "in_person", kind: "session", occurrenceDate: "2027-06-13" }, "clerk", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.schedule?.occurrences.map((o) => o.billing)).toEqual(["paid", "paid"]);
  });

  it("fails kind session for a date with no occurrence", () => {
    const c = makeCase({ state: "permitted", schedule: { date: "2027-06-06", start: "08:00", end: "09:00", occurrences: [{ date: "2027-06-06", availability: { status: "open" }, billing: "paid" }] } });
    const result = transition(c, { type: "pay", amount: 20, method: "card", kind: "session", occurrenceDate: "2027-07-01" }, "applicant", makeCtx());
    expect(result.ok).toBe(false);
  });
});
