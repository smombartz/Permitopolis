import { describe, expect, it } from "vitest";
import { makeCase, makeCtx, makeTask } from "./testSupport";
import { availableActions } from "./availableActions";
import { actorsFor } from "./checks";
import { buildSeed } from "./seed";
import { transition } from "./transition";

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
    // Decided: nothing left to decide or ask. The Reviews tab shows the decision.
    expect(types("approved")).toEqual(["remind", "add_note"]);
  });

  it("a decided review never puts a dead \"Decide your review\" above the department's real action (S6 in Closeout)", () => {
    const closeout = makeCase({ state: "closeout", tier: "special", reviews: [review("pws", "approved")] });
    expect(availableActions(closeout, "pws", makeCtx()).map((i) => [i.type, i.enabled, i.primary ?? false])).toEqual([
      ["log_closeout", true, true],
      ["remind", true, false],
      ["add_note", true, false],
    ]);
  });

  it("the Clerk in Needs info on a routed case: the quote says whose answer it waits for", () => {
    const card = makeTask({ id: "PMT-27-0001:vendor_health_permit:1", catalogId: "vendor_health_permit", reviewer: "hl", request: { from: "hl", message: "Send the permit.", at: "2027-04-30T09:00", dueDate: "2027-05-05", resolved: false } });
    const c = makeCase({ state: "needs_info", flags: { sentToCommission: false, lateFee: false, signed: false, acceptedComplete: true, amendmentPending: false }, reviews: [review("pws", "approved"), review("hl", "needs_info")], tasks: [card] });
    const items = availableActions(c, "clerk", makeCtx());
    expect(items.find((i) => i.type === "send_quote")).toMatchObject({ enabled: false, primary: true, reason: "Waiting on the applicant's response to Health & Legal's request." });
    expect(items.map((i) => i.type)).toEqual(["send_quote", "send_to_commission", "deny", "remind", "add_note"]);
  });

  it("the Clerk in Needs info at intake (asked before accepting): the intake set, not the quote or the commission", () => {
    const card = makeTask({ id: "PMT-27-0001:respond_to_request:1", catalogId: "respond_to_request", kind: "action", reviewer: "clerk", request: { from: "clerk", message: "Which entrance?", at: "2027-04-30T09:00", dueDate: "2027-05-05", resolved: false } });
    const c = makeCase({ state: "needs_info", tier: "reviewed", tasks: [card] });
    expect(availableActions(c, "clerk", makeCtx()).map((i) => [i.type, i.enabled, i.reason])).toEqual([
      ["accept_complete", false, "Waiting on the applicant's response to your request"],
      ["request_info", true, undefined],
      ["deny", true, undefined],
      ["remind", true, undefined],
      ["add_note", true, undefined],
    ]);
  });

  it("Send to commission is offered once: after it is sent, the row says so", () => {
    const flags = { sentToCommission: true, lateFee: false, signed: false, acceptedComplete: true, amendmentPending: false };
    const c = makeCase({ state: "in_review", flags, reviews: [review("pws", "pending")] });
    expect(availableActions(c, "clerk", makeCtx()).find((i) => i.type === "send_to_commission")).toMatchObject({ enabled: false, reason: "Already sent to commission." });
    expect(transition(c, { type: "send_to_commission" }, "clerk", makeCtx())).toEqual({ ok: false, reason: "Already sent to commission." });
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

  it("log_closeout is taken once: after the hours are in, the row is disabled and says who has the case", () => {
    const logged = makeCase({ state: "closeout", tier: "special", closeout: { cleanup: "pass", notes: "", hoursLoggedOn: "2027-05-03", balance: null, refund: null, feedback: null } });
    expect(availableActions(logged, "pws", makeCtx()).find((i) => i.type === "log_closeout")).toMatchObject({
      enabled: false,
      reason: "Hours were logged on Mon, May 3, 2027; the City Clerk is reconciling.",
    });
    expect(transition(logged, { type: "log_closeout", cleanup: "pass", actuals: [], extraLines: [] }, "pws", makeCtx())).toEqual({
      ok: false,
      reason: "Hours were logged on Mon, May 3, 2027; the City Clerk is reconciling.",
    });
  });
});

describe("availableActions: a case that has ended", () => {
  const fee = { id: "f1", dept: "clerk" as const, label: "Fee", qty: 1, unit: "flat", unitPrice: 480, estimate: 480, actual: null, kind: "fee" as const };

  it("offers nothing that transition() would refuse: no payment, no signature, no reminder", () => {
    // B25: the quote was never paid and the hold expired.
    const expired = makeCase({ state: "quote_sent", ending: "hold_expired", endingReason: "The date hold expired before the quote was paid.", dateHold: { status: "expired", placedOn: "2027-03-03", expiresOn: "2027-04-26" }, feeLines: [fee] });
    expect(availableActions(expired, "applicant", makeCtx())).toEqual([]);
    expect(availableActions(expired, "clerk", makeCtx()).map((i) => [i.type, i.enabled])).toEqual([["add_note", true]]);
    for (const role of ["pws", "hl"] as const) expect(availableActions(expired, role, makeCtx()).map((i) => i.type)).toEqual(["add_note"]);
  });

  it.each(["withdrawn", "denied", "cancelled", "hold_expired"] as const)("%s: every action offered goes through, in every state", (ending) => {
    for (const state of ["draft", "submitted", "in_review", "needs_info", "quote_sent", "permitted", "event_day", "closeout", "closed"] as const) {
      const c = makeCase({ state, ending });
      for (const role of ["applicant", "clerk", "pws", "hl"] as const) {
        for (const item of availableActions(c, role, makeCtx())) {
          expect([state, role, item.type, item.enabled]).toEqual([state, role, "add_note", true]);
        }
      }
    }
  });
});

describe("availableActions: payments", () => {
  const fee = { id: "f1", dept: "clerk" as const, label: "Fee", qty: 1, unit: "flat", unitPrice: 715, estimate: 715, actual: null, kind: "fee" as const };

  it("both pay rows of a quote are built from the check `pay` itself runs", () => {
    const quoted = makeCase({ state: "quote_sent", feeLines: [fee] });
    expect(availableActions(quoted, "applicant", makeCtx()).find((i) => i.type === "pay")).toMatchObject({ label: "Pay fees and deposit", enabled: true });
    expect(availableActions(quoted, "clerk", makeCtx()).find((i) => i.type === "pay")).toMatchObject({ label: "Record an in-person payment", enabled: true });
  });

  it("a quote already paid in full takes no payment: both rows are disabled and say so", () => {
    const paid = makeCase({ state: "quote_sent", feeLines: [fee], payments: [{ id: "p1", at: "2027-05-03T09:00", amount: 715, method: "card", kind: "quote" }] });
    expect(availableActions(paid, "clerk", makeCtx()).find((i) => i.type === "pay")).toMatchObject({ enabled: false, reason: "The quote is paid in full." });
    expect(availableActions(paid, "applicant", makeCtx()).find((i) => i.type === "pay")).toMatchObject({ enabled: false, reason: "The quote is paid in full." });
  });

  it("a closed case that still owes its final bill offers the payment, to the applicant and at the counter (B20)", () => {
    const extra = { id: "f2", dept: "pws" as const, label: "Extra cleanup crew", qty: 5, unit: "worker-hour", unitPrice: 60, estimate: 0, actual: 300, kind: "fee" as const };
    const deposit = { id: "f3", dept: "clerk" as const, label: "Refundable cleanup deposit", qty: 1, unit: "flat", unitPrice: 250, estimate: 250, actual: 250, kind: "deposit" as const };
    const owing = makeCase({
      state: "closed",
      feeLines: [{ ...fee, unitPrice: 130, estimate: 130, actual: 130 }, extra, deposit],
      payments: [{ id: "p1", at: "2027-01-21T09:05", amount: 380, method: "card", kind: "quote" }],
      closeout: { cleanup: "issues", notes: "", hoursLoggedOn: "2027-03-16", balance: 300, refund: null, feedback: null },
    });
    expect(availableActions(owing, "applicant", makeCtx()).map((i) => [i.type, i.label, i.enabled, i.primary])).toEqual([
      ["pay", "Pay the final bill", true, true],
      ["submit_feedback", "Tell us how it went", true, false],
      ["book_again", "Book again next year", true, false],
    ]);
    expect(availableActions(owing, "clerk", makeCtx()).map((i) => [i.type, i.label])).toEqual([["pay", "Record an in-person payment"]]);

    // Paid up: the payment row goes.
    const settled = { ...owing, payments: [...owing.payments, { id: "p2", at: "2027-03-20T09:00", amount: 50, method: "card" as const, kind: "final_invoice" as const }] };
    expect(availableActions(settled, "applicant", makeCtx()).map((i) => i.type)).toEqual(["submit_feedback", "book_again"]);
    expect(availableActions(settled, "clerk", makeCtx())).toEqual([]);
  });

  it("a permitted series offers the next session still to pay; a single event and a paid-up series do not", () => {
    const session = (date: string, billing: "paid" | "due" | "upcoming" | "skipped") => ({ date, availability: { status: "open" as const }, billing });
    const series = makeCase({
      state: "permitted",
      schedule: {
        date: "2027-06-06",
        start: "08:00",
        end: "09:00",
        recurrence: { frequency: "weekly", weekday: 0, until: "2027-06-27" },
        occurrences: [session("2027-06-06", "paid"), session("2027-06-13", "skipped"), session("2027-06-20", "upcoming"), session("2027-06-27", "upcoming")],
      },
    });
    for (const state of ["permitted", "event_day"] as const) {
      expect(availableActions({ ...series, state }, "applicant", makeCtx()).map((i) => [i.type, i.label, i.enabled])).toEqual([
        ["pay", "Pay the next session", true],
        ["cancel", "Cancel", false],
        ["amend", "Amend", true],
      ]);
      expect(availableActions({ ...series, state }, "clerk", makeCtx()).map((i) => [i.type, i.label])).toEqual([
        ["pay", "Record an in-person payment"],
        ["remind", "Send a reminder"],
        ["add_note", "Add a note"],
      ]);
    }
    const paidUp = { ...series, schedule: { ...series.schedule!, occurrences: series.schedule!.occurrences.map((o) => (o.billing === "upcoming" ? { ...o, billing: "paid" as const } : o)) } };
    expect(availableActions(paidUp, "applicant", makeCtx()).map((i) => i.type)).toEqual(["cancel", "amend"]);
    const single = makeCase({ state: "permitted", schedule: { date: "2027-05-22", start: "11:00", end: "16:00", occurrences: [session("2027-05-22", "upcoming")] } });
    expect(availableActions(single, "applicant", makeCtx()).map((i) => i.type)).toEqual(["cancel", "amend"]);
  });

  it("feedback is given once: the row is disabled, with the reason, after it is in", () => {
    const closed = makeCase({ state: "closed" });
    expect(availableActions(closed, "applicant", makeCtx()).find((i) => i.type === "submit_feedback")).toMatchObject({ enabled: true, primary: true });
    const given = { ...closed, closeout: { ...closed.closeout, feedback: { rating: 5, comment: "Smooth process." } } };
    expect(availableActions(given, "applicant", makeCtx()).find((i) => i.type === "submit_feedback")).toMatchObject({ enabled: false, primary: false, reason: "Feedback is already in. Thank you." });
  });
});

describe("availableActions on the seed: a case in Needs info", () => {
  const seed = buildSeed();
  const ctx = makeCtx({ cases: seed });
  const clerkRows = (id: string) => availableActions(seed.find((c) => c.id === id)!, "clerk", ctx);

  it("S3 (routed, Health & Legal asked): Send quote says what it waits for", () => {
    expect(clerkRows("PMT-27-0118").find((i) => i.type === "send_quote")).toMatchObject({
      enabled: false,
      reason: "Waiting on the applicant's response to Health & Legal's request.",
    });
  });

  it("PMT-27-0020 (asked at intake, not accepted): Accept as complete leads, and there is no quote or commission to send", () => {
    const rows = clerkRows("PMT-27-0020");
    expect(rows.map((i) => i.type)).toEqual(["accept_complete", "request_info", "deny", "remind", "add_note"]);
    expect(rows[0]).toMatchObject({ primary: true, enabled: false, reason: "Waiting on the applicant's response to your request" });
  });

  it("no reason shown anywhere on the seed is a raw state name", () => {
    for (const c of seed) {
      for (const role of ["applicant", "clerk", "pws", "hl"] as const) {
        for (const item of availableActions(c, role, ctx)) expect(item.reason ?? "", `${c.id} ${role} ${item.label}`).not.toMatch(/This case is (needs info|in review|quote sent|event day)/);
      }
    }
  });
});
