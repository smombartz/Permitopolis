import { describe, expect, it } from "vitest";
import { makeCase, makeCtx, makeTask } from "../testSupport";
import { transition } from "../transition";

const QUOTE_FEE = { id: "f1", dept: "clerk" as const, label: "Fee", qty: 1, unit: "flat", unitPrice: 715, estimate: 715, actual: null, kind: "fee" as const };

describe("pay", () => {
  it("kind quote finishes pay_fees and records the payment", () => {
    const payFees = makeTask({ id: "PMT-27-0001:pay_fees", catalogId: "pay_fees", kind: "payment" });
    const c = makeCase({ state: "quote_sent", tasks: [payFees], feeLines: [QUOTE_FEE] });
    const result = transition(c, { type: "pay", amount: 715, method: "card", kind: "quote" }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.payments).toHaveLength(1);
    expect(result.case.tasks[0].status).toBe("done");
  });

  it("a quote paid in full takes no further payment, from the applicant or at the counter", () => {
    const paid = makeCase({ state: "quote_sent", feeLines: [QUOTE_FEE], payments: [{ id: "p1", at: "2027-05-03T09:00", amount: 715, method: "card", kind: "quote" }] });
    for (const [actor, method] of [["applicant", "card"], ["clerk", "in_person"]] as const) {
      expect(transition(paid, { type: "pay", amount: 20, method, kind: "quote" }, actor, makeCtx())).toEqual({ ok: false, reason: "The quote is paid in full." });
    }
    // A part payment leaves a balance, and the balance can still be paid.
    const part = { ...paid, payments: [{ ...paid.payments[0], amount: 400 }] };
    expect(transition(part, { type: "pay", amount: 315, method: "in_person", kind: "quote" }, "clerk", makeCtx()).ok).toBe(true);
  });

  it("fails kind quote outside Quote sent", () => {
    const c = makeCase({ state: "in_review" });
    const result = transition(c, { type: "pay", amount: 715, method: "card", kind: "quote" }, "applicant", makeCtx());
    expect(result.ok).toBe(false);
  });

  it("kind session, by the Clerk in person, marks that occurrence paid", () => {
    const c = makeCase({
      state: "permitted",
      schedule: {
        date: "2027-06-06",
        start: "08:00",
        end: "09:00",
        recurrence: { frequency: "weekly", weekday: 0, until: "2027-06-13" },
        occurrences: [{ date: "2027-06-06", availability: { status: "open" }, billing: "paid" }, { date: "2027-06-13", availability: { status: "open" }, billing: "upcoming" }],
      },
    });
    const result = transition(c, { type: "pay", amount: 20, method: "in_person", kind: "session", occurrenceDate: "2027-06-13" }, "clerk", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.schedule?.occurrences.map((o) => o.billing)).toEqual(["paid", "paid"]);
  });

  it("fails kind session for a date with no occurrence", () => {
    const c = makeCase({ state: "permitted", schedule: { date: "2027-06-06", start: "08:00", end: "09:00", recurrence: { frequency: "weekly", weekday: 0, until: "2027-06-06" }, occurrences: [{ date: "2027-06-06", availability: { status: "open" }, billing: "paid" }] } });
    const result = transition(c, { type: "pay", amount: 20, method: "card", kind: "session", occurrenceDate: "2027-07-01" }, "applicant", makeCtx());
    expect(result.ok).toBe(false);
  });

  it("fails kind session for an event that is not a series, and for a session the series skips", () => {
    const single = makeCase({ state: "permitted", schedule: { date: "2027-06-06", start: "08:00", end: "09:00", occurrences: [{ date: "2027-06-06", availability: { status: "open" }, billing: "upcoming" }] } });
    expect(transition(single, { type: "pay", amount: 20, method: "card", kind: "session", occurrenceDate: "2027-06-06" }, "applicant", makeCtx())).toEqual({ ok: false, reason: "Only a series is paid by session." });

    const series = makeCase({
      state: "permitted",
      schedule: {
        date: "2027-05-24",
        start: "07:00",
        end: "08:00",
        recurrence: { frequency: "weekly", weekday: 1, until: "2027-05-31" },
        occurrences: [{ date: "2027-05-24", availability: { status: "open" }, billing: "paid" }, { date: "2027-05-31", availability: { status: "blackout" }, billing: "skipped" }],
      },
    });
    expect(transition(series, { type: "pay", amount: 20, method: "card", kind: "session", occurrenceDate: "2027-05-31" }, "applicant", makeCtx()).ok).toBe(false);
  });

  describe("a quote paid in parts (S3's $715)", () => {
    const line = { id: "f1", dept: "clerk" as const, label: "Fees and deposit", qty: 1, unit: "flat", unitPrice: 715, estimate: 715, actual: null, kind: "fee" as const };
    const quoted = () =>
      makeCase({
        state: "quote_sent",
        flags: { sentToCommission: false, lateFee: false, signed: true, acceptedComplete: true, amendmentPending: false },
        feeLines: [line],
        tasks: [
          makeTask({ id: "PMT-27-0001:pay_fees", catalogId: "pay_fees", kind: "payment", payload: { amount: 715 } }),
          makeTask({ id: "PMT-27-0001:issue_permit", catalogId: "issue_permit", owner: "clerk", kind: "action", status: "locked" }),
        ],
      });

    it("a part payment leaves the card open for the balance, and Issue permit locked", () => {
      const result = transition(quoted(), { type: "pay", amount: 300, method: "in_person", kind: "quote" }, "clerk", makeCtx());
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.case.tasks.find((t) => t.catalogId === "pay_fees")).toMatchObject({ status: "todo", payload: { amount: 415 } });
      expect(result.case.tasks.find((t) => t.catalogId === "issue_permit")?.status).toBe("locked");
    });

    it("the payment that covers the balance finishes the card and unlocks Issue permit", () => {
      const part = transition(quoted(), { type: "pay", amount: 300, method: "in_person", kind: "quote" }, "clerk", makeCtx());
      expect(part.ok).toBe(true);
      if (!part.ok) return;
      const rest = transition(part.case, { type: "pay", amount: 415, method: "card", kind: "quote" }, "applicant", makeCtx());
      expect(rest.ok).toBe(true);
      if (!rest.ok) return;
      expect(rest.case.tasks.find((t) => t.catalogId === "pay_fees")).toMatchObject({ status: "done", payload: { amount: 715 } });
      expect(rest.case.tasks.find((t) => t.catalogId === "issue_permit")?.status).toBe("todo");
    });
  });

  describe("money is compared to the cent", () => {
    // 62.1 + 62.2 + 62.3 is 186.60000000000002 in floating point: a cent-exact payment of
    // $186.60 used to fall short of it, so the permit stayed locked and the hold could expire.
    const lines = [62.1, 62.2, 62.3].map((amount, i) => ({ id: `f${i}`, dept: "clerk" as const, label: `Line ${i}`, qty: 1, unit: "flat", unitPrice: amount, estimate: amount, actual: null, kind: "fee" as const }));
    const quoted = () =>
      makeCase({
        state: "quote_sent",
        flags: { sentToCommission: false, lateFee: false, signed: true, acceptedComplete: true, amendmentPending: false },
        dateHold: { status: "held", placedOn: "2027-04-19", expiresOn: "2027-05-17" },
        feeLines: lines,
        tasks: [
          makeTask({ id: "PMT-27-0001:pay_fees", catalogId: "pay_fees", kind: "payment", payload: { amount: 186.6 } }),
          makeTask({ id: "PMT-27-0001:issue_permit", catalogId: "issue_permit", owner: "clerk", kind: "action", status: "locked" }),
        ],
      });

    it("paying $186.60 against three lines that add up to it is paid in full", () => {
      const result = transition(quoted(), { type: "pay", amount: 186.6, method: "card", kind: "quote" }, "applicant", makeCtx());
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.case.tasks.find((t) => t.catalogId === "pay_fees")).toMatchObject({ status: "done", payload: { amount: 186.6 } });
      expect(result.case.tasks.find((t) => t.catalogId === "issue_permit")?.status).toBe("todo");
    });

    it("so is paying it in two parts", () => {
      const part = transition(quoted(), { type: "pay", amount: 62.1, method: "in_person", kind: "quote" }, "clerk", makeCtx());
      expect(part.ok && part.case.tasks.find((t) => t.catalogId === "pay_fees")?.payload.amount).toBe(124.5);
      const rest = part.ok ? transition(part.case, { type: "pay", amount: 124.5, method: "card", kind: "quote" }, "applicant", makeCtx()) : part;
      expect(rest.ok && rest.case.tasks.find((t) => t.catalogId === "issue_permit")?.status).toBe("todo");
    });
  });

  describe("the hold's expiry is the deadline for paying the quote", () => {
    const line = { id: "f1", dept: "clerk" as const, label: "Fees and deposit", qty: 1, unit: "flat", unitPrice: 400, estimate: 400, actual: null, kind: "fee" as const };
    const quoted = () =>
      makeCase({
        state: "quote_sent",
        dateHold: { status: "held", placedOn: "2027-03-27", expiresOn: "2027-04-24" },
        feeLines: [line],
        tasks: [makeTask({ id: "PMT-27-0001:pay_fees", catalogId: "pay_fees", kind: "payment", payload: { amount: 400 } })],
      });

    it("once the quote is paid in full the date is simply held: no 'held until' a date that no longer applies", () => {
      const result = transition(quoted(), { type: "pay", amount: 400, method: "card", kind: "quote" }, "applicant", makeCtx());
      expect(result.ok && result.case.dateHold).toEqual({ status: "held", placedOn: "2027-03-27", expiresOn: null });
    });

    it("a part payment leaves the deadline in place", () => {
      const result = transition(quoted(), { type: "pay", amount: 100, method: "card", kind: "quote" }, "applicant", makeCtx());
      expect(result.ok && result.case.dateHold.expiresOn).toBe("2027-04-24");
    });
  });

  it("refuses an amount of zero or less", () => {
    const c = makeCase({ state: "quote_sent" });
    for (const amount of [0, -50]) {
      expect(transition(c, { type: "pay", amount, method: "in_person", kind: "quote" }, "clerk", makeCtx())).toEqual({ ok: false, reason: "Enter an amount above $0." });
    }
  });

  it("takes a final-invoice payment only in Closeout or once Closed", () => {
    const pay = { type: "pay", amount: 50, method: "card", kind: "final_invoice" } as const;
    expect(transition(makeCase({ state: "in_review" }), pay, "applicant", makeCtx())).toEqual({ ok: false, reason: "There is no final bill yet." });
    const bill = makeTask({ id: "PMT-27-0001:final_bill_or_refund", catalogId: "final_bill_or_refund", kind: "payment", payload: { amount: 50 } });
    const closed = transition(makeCase({ state: "closed", tasks: [bill] }), pay, "applicant", makeCtx());
    expect(closed.ok && closed.case.tasks[0].status).toBe("done");
  });

  it("does not take a booking or a refund: those are recorded by the actions that cause them", () => {
    const c = makeCase({ state: "permitted" });
    expect(transition(c, { type: "pay", amount: 125, method: "card", kind: "booking" }, "applicant", makeCtx()).ok).toBe(false);
    expect(transition(c, { type: "pay", amount: 125, method: "card", kind: "refund" }, "clerk", makeCtx()).ok).toBe(false);
  });
});
