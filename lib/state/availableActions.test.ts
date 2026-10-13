import { describe, expect, it } from "vitest";
import { makeCase, makeCtx, makeTask } from "./testSupport";
import { availableActions } from "./availableActions";
import { actorsFor } from "./checks";

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

describe("availableActions: asking the applicant for something", () => {
  const review = (dept: "clerk" | "pws" | "hl", status: "pending" | "needs_info" | "approved") => ({
    dept,
    sections: [],
    status,
    dueDate: null,
    decidedOn: status === "approved" ? "2027-05-01" : null,
    clock: { startedOn: "2027-04-19", pausedSince: null, pausedDays: 0, allowedDays: 14 },
    internalNote: "",
    messageToApplicant: "",
  });

  it("the Clerk at intake: accept as complete, request information, or deny", () => {
    const items = availableActions(makeCase({ state: "submitted" }), "clerk", makeCtx());
    expect(items.map((i) => [i.type, i.enabled])).toEqual([
      ["accept_complete", true],
      ["request_info", true],
      ["deny", true],
    ]);
  });

  it("a reviewer while its review is open, also when it has already asked once; not after it has decided", () => {
    const types = (status: "pending" | "needs_info" | "approved") =>
      availableActions(makeCase({ state: status === "needs_info" ? "needs_info" : "in_review", reviews: [review("pws", status)] }), "pws", makeCtx()).map((i) => i.type);
    expect(types("pending")).toEqual(["review_decide", "request_info", "remind", "add_note"]);
    expect(types("needs_info")).toEqual(["review_decide", "request_info", "remind", "add_note"]);
    expect(types("approved")).toEqual(["review_decide", "remind", "add_note"]);
  });

  it("a department that is not routed has nothing to decide or ask", () => {
    const items = availableActions(makeCase({ state: "in_review", reviews: [review("hl", "pending")] }), "pws", makeCtx());
    expect(items.map((i) => i.type)).toEqual(["remind", "add_note"]);
  });
});

describe("availableActions: the Clerk's own review (the alcohol license)", () => {
  const clerkReview = (status: "pending" | "approved") => ({
    dept: "clerk" as const,
    sections: ["Alcohol details and liquor liability insurance"],
    status,
    dueDate: "2027-05-17",
    decidedOn: status === "approved" ? "2027-05-01" : null,
    clock: { startedOn: "2027-04-19", pausedSince: null, pausedDays: 0, allowedDays: 14 },
    internalNote: "",
    messageToApplicant: "",
  });

  it("while it is pending, deciding it is the Clerk's primary action, ahead of the quote", () => {
    const items = availableActions(makeCase({ state: "in_review", reviews: [clerkReview("pending")] }), "clerk", makeCtx());
    expect(items.map((i) => i.type)).toEqual(["review_decide", "request_info", "send_quote", "send_to_commission", "deny", "remind", "add_note"]);
    expect(items.find((i) => i.type === "review_decide")).toMatchObject({ label: "Decide your review", enabled: true, primary: true });
    expect(items.find((i) => i.type === "send_quote")).toMatchObject({ enabled: false, primary: false, reason: "Waiting on every reviewer to approve." });
  });

  it("once it is decided, the quote is primary again", () => {
    const items = availableActions(makeCase({ state: "in_review", reviews: [clerkReview("approved")] }), "clerk", makeCtx());
    expect(items.map((i) => i.type)).toEqual(["send_quote", "send_to_commission", "deny", "remind", "add_note"]);
    expect(items.find((i) => i.type === "send_quote")).toMatchObject({ enabled: true, primary: true });
  });

  it("a case the Clerk is not reviewing shows no review to decide", () => {
    const items = availableActions(makeCase({ state: "in_review" }), "clerk", makeCtx());
    expect(items.map((i) => i.type)).toEqual(["send_quote", "send_to_commission", "deny", "remind", "add_note"]);
  });
});

describe("availableActions: every action offered is one the role may raise", () => {
  it("for every role, in every state", () => {
    const states = ["draft", "submitted", "in_review", "needs_info", "quote_sent", "permitted", "event_day", "closeout", "closed"] as const;
    for (const state of states) {
      for (const role of ["applicant", "clerk", "pws", "hl"] as const) {
        for (const item of availableActions(makeCase({ state }), role, makeCtx())) {
          expect(actorsFor(item.type), `${item.type} for ${role} in ${state}`).toContain(role);
        }
      }
    }
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
