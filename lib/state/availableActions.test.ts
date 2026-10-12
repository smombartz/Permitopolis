import { describe, expect, it } from "vitest";
import { makeCase, makeCtx, makeTask } from "./testSupport";
import { availableActions } from "./availableActions";

describe("availableActions: Clerk in Quote sent (S5)", () => {
  it("shows issue_permit (primary), pay, remind and add_note", () => {
    const c = makeCase({ state: "quote_sent" });
    const items = availableActions(c, "clerk", makeCtx());
    expect(items.map((i) => i.type)).toEqual(["issue_permit", "pay", "remind", "add_note"]);
    expect(items.find((i) => i.type === "issue_permit")?.primary).toBe(true);
  });

  it("issue_permit is disabled with both reasons, then enabled", () => {
    const acceptSign = makeTask({ id: "PMT-27-0097:accept_and_sign", catalogId: "accept_and_sign", kind: "sign_off", status: "done" });
    const insurance = makeTask({ id: "PMT-27-0097:insurance_certificate", catalogId: "insurance_certificate", status: "done" });
    let c = makeCase({
      id: "PMT-27-0097",
      state: "quote_sent",
      tasks: [acceptSign, insurance],
      feeLines: [{ id: "f1", dept: "clerk", label: "Fee", qty: 1, unit: "flat", unitPrice: 6530, estimate: 6530, actual: null, kind: "fee" }],
    });
    let items = availableActions(c, "clerk", makeCtx());
    expect(items.find((i) => i.type === "issue_permit")).toMatchObject({ enabled: false, reason: "Needs: signature (applicant), payment (applicant)" });

    c = { ...c, flags: { ...c.flags, signed: true } };
    items = availableActions(c, "clerk", makeCtx());
    expect(items.find((i) => i.type === "issue_permit")).toMatchObject({ enabled: false, reason: "Needs: payment (applicant)" });

    c = { ...c, payments: [{ id: "p1", at: "2027-05-03T09:00", amount: 6530, method: "card", kind: "quote" }] };
    items = availableActions(c, "clerk", makeCtx());
    expect(items.find((i) => i.type === "issue_permit")).toMatchObject({ enabled: true });
  });
});

describe("availableActions: Clerk in Submitted", () => {
  it("offers accept_complete before acceptance, confirm_routing after", () => {
    const before = availableActions(makeCase({ state: "submitted" }), "clerk", makeCtx());
    expect(before.map((i) => i.type)).toContain("accept_complete");

    const after = availableActions(makeCase({ state: "submitted", flags: { sentToCommission: false, lateFee: false, signed: false, acceptedComplete: true, amendmentPending: false } }), "clerk", makeCtx());
    expect(after.map((i) => i.type)).toContain("confirm_routing");
  });
});

describe("availableActions: reviewer", () => {
  it("review_decide is primary only while the review is pending", () => {
    const pending = makeCase({
      state: "in_review",
      reviews: [{ dept: "hl", sections: [], status: "pending", dueDate: null, decidedOn: null, clock: { startedOn: "2027-04-19", pausedSince: null, pausedDays: 0, allowedDays: 14 }, internalNote: "", messageToApplicant: "" }],
    });
    const items = availableActions(pending, "hl", makeCtx());
    expect(items.find((i) => i.type === "review_decide")).toMatchObject({ enabled: true, primary: true });
  });

  it("log_closeout is only offered in Closeout or on/after Event day for an Instant event", () => {
    const notYet = availableActions(makeCase({ state: "permitted", tier: "reviewed" }), "pws", makeCtx());
    expect(notYet.map((i) => i.type)).not.toContain("log_closeout");

    const instantEventDay = availableActions(makeCase({ state: "event_day", tier: "instant" }), "pws", makeCtx());
    expect(instantEventDay.map((i) => i.type)).toContain("log_closeout");
  });
});
