import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeCase, makeCtx, makeTask } from "../testSupport";
import { transition } from "../transition";

vi.mock("@/lib/rules", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rules")>("@/lib/rules");
  return {
    ...actual,
    availability: vi.fn(() => ({ status: "open" })),
    dueDate: vi.fn((base: string, days: number) => base.slice(0, 8) + String(Number(base.slice(8, 10)) + days).padStart(2, "0")),
    closeoutCards: vi.fn(() => []),
  };
});

import { availability } from "@/lib/rules";

beforeEach(() => {
  vi.mocked(availability).mockReturnValue({ status: "open" });
});

describe("accept_complete (S4)", () => {
  it("fails until all 12 of 12 neighbors sign off", () => {
    const signoff = makeTask({ id: "PMT-27-0097:neighbor_signoff", catalogId: "neighbor_signoff", payload: { progress: { done: 9, total: 12 } } });
    const c = makeCase({ id: "PMT-27-0097", state: "submitted", tasks: [signoff] });
    const result = transition(c, { type: "accept_complete" }, "clerk", makeCtx());
    expect(result).toEqual({ ok: false, reason: "Waiting on 3 neighbor sign-offs" });
  });

  it("then holds the date, creates confirm_routing and routes once signed off", () => {
    const signoff = makeTask({ id: "PMT-27-0097:neighbor_signoff", catalogId: "neighbor_signoff", status: "done", payload: { progress: { done: 12, total: 12 } } });
    const intake = makeTask({ id: "PMT-27-0097:intake_check", catalogId: "intake_check", owner: "clerk", kind: "review" });
    const c = makeCase({ id: "PMT-27-0097", state: "submitted", tasks: [signoff, intake] });
    const accepted = transition(c, { type: "accept_complete" }, "clerk", makeCtx());
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.case.dateHold.status).toBe("held");
    expect(accepted.case.flags.acceptedComplete).toBe(true);
    expect(accepted.case.tasks.find((t) => t.catalogId === "confirm_routing")).toBeDefined();

    const routed = transition(accepted.case, { type: "confirm_routing", reviewers: [{ dept: "pws", sections: ["Closure"], dueDate: "2027-05-17" }, { dept: "hl", sections: ["Insurance"], dueDate: "2027-05-17" }] }, "clerk", makeCtx());
    expect(routed.ok).toBe(true);
    if (!routed.ok) return;
    expect(routed.case.state).toBe("in_review");
    expect(routed.case.reviews).toHaveLength(2);
    expect(routed.case.tasks.find((t) => t.catalogId === "review:pws")?.owner).toBe("pws");
  });

  it("fails when another case holds the space and date first", () => {
    vi.mocked(availability).mockReturnValue({ status: "booked", reason: "Riverside Farmers Market holds this space and date and was complete first" });
    const c = makeCase({ state: "submitted", location: { mode: "area", inventoryIds: [], segmentIds: [], label: "Great Lawn" }, schedule: { date: "2027-06-12", start: "19:00", end: "22:30", occurrences: [{ date: "2027-06-12", availability: { status: "open" }, billing: "upcoming" }] } });
    const result = transition(c, { type: "accept_complete" }, "clerk", makeCtx());
    expect(result).toEqual({ ok: false, reason: "Riverside Farmers Market holds this space and date and was complete first" });
  });

  it("checks the slot from setup start to teardown end", () => {
    const location = { mode: "area" as const, inventoryIds: [], areaId: "great-lawn" as const, segmentIds: [], label: "Great Lawn" };
    const c = makeCase({ state: "submitted", location, schedule: { date: "2027-06-12", start: "19:00", end: "22:30", setupStart: "17:00", occurrences: [{ date: "2027-06-12", availability: { status: "open" }, billing: "upcoming" }] } });
    transition(c, { type: "accept_complete" }, "clerk", makeCtx());
    expect(vi.mocked(availability)).toHaveBeenCalledWith(location, { date: "2027-06-12", start: "17:00", end: "22:30" }, expect.anything(), "PMT-27-0001");
  });

  it("fails when an intake request is still open", () => {
    const card = makeTask({ id: "PMT-27-0001:x", catalogId: "vendor_list", request: { from: "clerk", message: "Missing a detail.", at: "2027-04-20T09:00", dueDate: "2027-04-25", resolved: false } });
    const c = makeCase({ state: "submitted", tasks: [card] });
    const result = transition(c, { type: "accept_complete" }, "clerk", makeCtx());
    expect(result).toEqual({ ok: false, reason: "Waiting on the applicant's response to your request" });
  });
});

describe("send_quote and issue_permit (S5)", () => {
  function routedCase() {
    const reviewPws = { dept: "pws" as const, sections: ["Route"], status: "approved" as const, dueDate: "2027-06-01", decidedOn: "2027-05-20", clock: { startedOn: "2027-05-01", pausedSince: null, pausedDays: 0, allowedDays: 60 }, internalNote: "", messageToApplicant: "" };
    const reviewHl = { dept: "hl" as const, sections: ["Insurance"], status: "approved_with_conditions" as const, dueDate: "2027-06-01", decidedOn: "2027-05-20", clock: { startedOn: "2027-05-01", pausedSince: null, pausedDays: 0, allowedDays: 60 }, internalNote: "", messageToApplicant: "" };
    const consolidate = makeTask({ id: "PMT-27-0097:consolidate", catalogId: "consolidate", owner: "clerk", kind: "action" });
    const payFees = makeTask({ id: "PMT-27-0097:pay_fees", catalogId: "pay_fees", kind: "payment", status: "locked", unlocksOn: "quote_sent" });
    const acceptSign = makeTask({ id: "PMT-27-0097:accept_and_sign", catalogId: "accept_and_sign", kind: "sign_off", status: "locked", unlocksOn: "quote_sent" });
    return makeCase({
      id: "PMT-27-0097",
      state: "in_review",
      reviews: [reviewPws, reviewHl],
      tasks: [consolidate, payFees, acceptSign],
      feeLines: [{ id: "f0", dept: "clerk", label: "Application fee", qty: 1, unit: "flat", unitPrice: 6530, estimate: 6530, actual: null, kind: "fee" }],
      dateHold: { status: "held", placedOn: "2027-04-19", expiresOn: null },
    });
  }

  it("send_quote fails while a review is still pending", () => {
    const c = makeCase({ state: "in_review", reviews: [{ dept: "pws", sections: [], status: "pending", dueDate: null, decidedOn: null, clock: { startedOn: "2027-05-01", pausedSince: null, pausedDays: 0, allowedDays: 30 }, internalNote: "", messageToApplicant: "" }] });
    const result = transition(c, { type: "send_quote", conditions: [], feeLines: [] }, "clerk", makeCtx());
    expect(result.ok).toBe(false);
  });

  it("sends the quote, sets hold expiry and unlocks sign/pay, locks issue_permit", () => {
    const c = routedCase();
    const result = transition(c, { type: "send_quote", conditions: [], feeLines: [] }, "clerk", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.state).toBe("quote_sent");
    expect(result.case.dateHold.expiresOn).toBe("2027-05-17");
    expect(result.case.tasks.find((t) => t.catalogId === "accept_and_sign")?.status).toBe("todo");
    expect(result.case.tasks.find((t) => t.catalogId === "pay_fees")?.dueDate).toBe("2027-05-17");
    expect(result.case.tasks.find((t) => t.catalogId === "issue_permit")?.status).toBe("locked");
  });

  it("issue_permit is disabled naming both missing items, then enabled (S5)", () => {
    const quoteSent = transition(routedCase(), { type: "send_quote", conditions: [], feeLines: [] }, "clerk", makeCtx());
    expect(quoteSent.ok).toBe(true);
    if (!quoteSent.ok) return;
    let c = quoteSent.case;
    const insurance = makeTask({ id: `${c.id}:insurance_certificate`, catalogId: "insurance_certificate", status: "submitted" });
    c = { ...c, tasks: [...c.tasks, insurance] };

    const disabled = transition(c, { type: "issue_permit" }, "clerk", makeCtx());
    expect(disabled).toEqual({ ok: false, reason: "Needs: signature (applicant), payment (applicant), insurance (Health & Legal)" });

    const signed = transition(c, { type: "accept_and_sign", signature: "Riverfront Running Club" }, "applicant", makeCtx());
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    const paid = transition(signed.case, { type: "pay", amount: 6530, method: "card", kind: "quote" }, "applicant", makeCtx());
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;

    const stillWaitingOnInsurance = transition(paid.case, { type: "issue_permit" }, "clerk", makeCtx());
    expect(stillWaitingOnInsurance).toEqual({ ok: false, reason: "Needs: insurance (Health & Legal)" });
    expect(paid.case.tasks.find((t) => t.catalogId === "issue_permit")?.status).toBe("locked");

    const verified = transition(paid.case, { type: "verify_document", taskId: insurance.id }, "hl", makeCtx());
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    // Insurance was the last thing missing, so verifying it puts Issue permit in the Clerk's queue.
    expect(verified.case.tasks.find((t) => t.catalogId === "issue_permit")?.status).toBe("todo");

    const issued = transition(verified.case, { type: "issue_permit" }, "clerk", makeCtx());
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    expect(issued.case.state).toBe("permitted");
    expect(issued.case.permit?.issuedOn).toBe("2027-05-03");
    // ...and issuing it takes the task back out.
    expect(issued.case.tasks.find((t) => t.catalogId === "issue_permit")?.status).toBe("done");
    // The pay-by deadline is gone: the date is held, with no expiry left to show.
    expect(verified.case.dateHold.expiresOn).not.toBeNull();
    expect(issued.case.dateHold).toMatchObject({ status: "held", expiresOn: null });
  });
});

describe("deny", () => {
  it("ends the case; it does not appeal", () => {
    const c = makeCase({ state: "in_review", dateHold: { status: "held", placedOn: "2027-04-19", expiresOn: null } });
    const result = transition(c, { type: "deny", reason: "Conflicting street closure." }, "clerk", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.ending).toBe("denied");
    expect(result.case.endingReason).toBe("Conflicting street closure.");
    expect(result.case.dateHold.status).toBe("released");
  });
});

describe("reconcile_close (S6)", () => {
  it("$750 over estimate refunds $250 of the $1,000 deposit", () => {
    const bill = makeTask({ id: "PMT-27-0200:final_bill_or_refund", catalogId: "final_bill_or_refund", status: "locked", unlocksOn: "invoice_issued" });
    const c = makeCase({
      id: "PMT-27-0200",
      state: "closeout",
      closeout: { cleanup: "pass", notes: "", hoursLoggedOn: "2027-04-25", balance: null, refund: null, feedback: null },
      feeLines: [
        { id: "f1", dept: "pws", label: "Police", qty: 66, unit: "hour", unitPrice: 85, estimate: 5610, actual: 5610, kind: "fee" },
        { id: "f2", dept: "pws", label: "Overtime police", qty: 6, unit: "hour", unitPrice: 85, estimate: 0, actual: 510, kind: "fee" },
        { id: "f3", dept: "pws", label: "Cleanup crew", qty: 4, unit: "hour", unitPrice: 60, estimate: 0, actual: 240, kind: "fee" },
        { id: "f4", dept: "clerk", label: "Deposit", qty: 1, unit: "flat", unitPrice: 1000, estimate: 1000, actual: 1000, kind: "deposit" },
      ],
      tasks: [bill],
    });
    const result = transition(c, { type: "reconcile_close" }, "clerk", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.closeout.balance).toBe(750);
    expect(result.case.closeout.refund).toBe(250);
    expect(result.case.state).toBe("closed");
    expect(result.case.payments.find((p) => p.kind === "refund")?.amount).toBe(-250);
    expect(result.case.tasks.find((t) => t.catalogId === "final_bill_or_refund")?.status).toBe("done");
    expect(result.case.activity.at(-1)?.text).toBe("Closed. Refunded $250 from the deposit.");
  });

  it("closing finishes the Clerk's own reconcile task", () => {
    const reconcile = makeTask({ id: "PMT-27-0200:reconcile", catalogId: "reconcile", owner: "clerk", kind: "action", status: "todo" });
    const c = makeCase({
      id: "PMT-27-0200",
      state: "closeout",
      closeout: { cleanup: "pass", notes: "", hoursLoggedOn: "2027-04-25", balance: null, refund: null, feedback: null },
      tasks: [reconcile],
    });
    const result = transition(c, { type: "reconcile_close" }, "clerk", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.tasks.find((t) => t.catalogId === "reconcile")?.status).toBe("done");
  });

  it("fails before hours are logged", () => {
    const c = makeCase({ state: "closeout", closeout: { cleanup: null, notes: "", hoursLoggedOn: null, balance: null, refund: null, feedback: null } });
    const result = transition(c, { type: "reconcile_close" }, "clerk", makeCtx());
    expect(result.ok).toBe(false);
  });

  it("bills the applicant when costs exceed the deposit", () => {
    const bill = makeTask({ id: "PMT-27-0300:final_bill_or_refund", catalogId: "final_bill_or_refund", status: "locked", unlocksOn: "invoice_issued" });
    const c = makeCase({
      id: "PMT-27-0300",
      state: "closeout",
      closeout: { cleanup: "issues", notes: "", hoursLoggedOn: "2027-04-25", balance: null, refund: null, feedback: null },
      feeLines: [
        { id: "f1", dept: "pws", label: "Police", qty: 10, unit: "hour", unitPrice: 85, estimate: 850, actual: 1700, kind: "fee" },
        { id: "f2", dept: "clerk", label: "Deposit", qty: 1, unit: "flat", unitPrice: 250, estimate: 250, actual: 250, kind: "deposit" },
      ],
      tasks: [bill],
    });
    const result = transition(c, { type: "reconcile_close" }, "clerk", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.closeout.balance).toBe(850);
    expect(result.case.closeout.refund).toBeNull();
    const billTask = result.case.tasks.find((t) => t.catalogId === "final_bill_or_refund");
    expect(billTask?.payload.amount).toBe(600);
    expect(billTask?.status).toBe("todo");
  });
});
