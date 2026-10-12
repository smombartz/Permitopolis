import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Classification, FeeEstimate } from "@/lib/rules/types";
import type { EventCase } from "@/lib/types";
import { makeCase, makeCtx, makeTask } from "../testSupport";
import { transition } from "../transition";

vi.mock("@/lib/rules", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rules")>("@/lib/rules");
  return {
    ...actual,
    classify: vi.fn(),
    requirements: vi.fn(),
    estimateFees: vi.fn(),
    availability: vi.fn(),
    cancellationRefund: vi.fn(),
    closeoutCards: vi.fn(() => []),
    dueDate: vi.fn((base: string, days: number) => base.slice(0, 8) + String(Number(base.slice(8, 10)) + days).padStart(2, "0")),
  };
});

import { availability, cancellationRefund, classify, estimateFees, requirements } from "@/lib/rules";

const instantCls: Classification = {
  tier: "instant",
  triggers: [],
  blockPartyException: false,
  leadTimeDays: 10,
  reviewers: [],
  components: [],
  summary: "This is an Instant event: book today, $125 estimated",
};

beforeEach(() => {
  vi.mocked(classify).mockReturnValue(instantCls);
  vi.mocked(requirements).mockReturnValue([]);
  vi.mocked(estimateFees).mockReturnValue({ lines: [], fees: 0, deposit: 0, total: 125 } as FeeEstimate);
  vi.mocked(availability).mockReturnValue({ status: "open" });
});

describe("create_board", () => {
  it("Draft to Draft: stores tier, triggers and builds cards from requirements()", () => {
    const card = makeTask({ id: "PMT-27-0001:pay_fees", catalogId: "pay_fees" });
    vi.mocked(requirements).mockReturnValue([card]);
    const c = makeCase({ state: "draft" });
    const result = transition(c, { type: "create_board" }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.tier).toBe("instant");
    expect(result.case.tasks).toHaveLength(1);
    expect(result.case.activity).toHaveLength(1);
  });

  it("rebuilding keeps the status, payload and history of cards that still apply", () => {
    const freshCard = makeTask({ id: "PMT-27-0001:pay_fees", catalogId: "pay_fees", status: "todo" });
    vi.mocked(requirements).mockReturnValue([freshCard]);
    const existing = makeTask({ id: "PMT-27-0001:pay_fees", catalogId: "pay_fees", status: "done", payload: { amount: 125 }, history: [{ at: "2027-05-03T09:00", actor: "applicant", status: "done" }] });
    const c = makeCase({ state: "draft", tasks: [existing] });
    const result = transition(c, { type: "create_board" }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.tasks[0].status).toBe("done");
    expect(result.case.tasks[0].payload).toEqual({ amount: 125 });
  });

  it("fails outside Draft", () => {
    const c = makeCase({ state: "submitted" });
    const result = transition(c, { type: "create_board" }, "applicant", makeCtx());
    expect(result.ok).toBe(false);
  });
});

describe("book_and_pay", () => {
  const location = { mode: "inventory" as const, inventoryIds: ["shelter-3"], segmentIds: [], label: "Shelter 3" };
  const schedule = { date: "2027-05-22", start: "11:00", end: "16:00", occurrences: [{ date: "2027-05-22", availability: { status: "open" as const }, billing: "upcoming" as const }] };

  it("Draft to Permitted: holds the date, issues the permit, pays", () => {
    vi.mocked(estimateFees).mockReturnValue({ lines: [], fees: 125, deposit: 0, total: 125 } as FeeEstimate);
    const payFees = makeTask({ id: "PMT-27-0001:pay_fees", catalogId: "pay_fees", owner: "applicant", kind: "payment" });
    vi.mocked(requirements).mockReturnValue([payFees]);
    const c = makeCase({ state: "draft", tier: "instant", location, schedule });
    const result = transition(c, { type: "book_and_pay", method: "card" }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.state).toBe("permitted");
    expect(result.case.dateHold.status).toBe("held");
    expect(result.case.permit).toEqual({ issuedOn: "2027-05-03", signature: null });
    expect(result.case.payments).toHaveLength(1);
    expect(result.case.payments[0].kind).toBe("booking");
    expect(result.case.tasks.find((t) => t.catalogId === "pay_fees")?.status).toBe("done");
  });

  it("marks only the first occurrence paid for a series", () => {
    vi.mocked(estimateFees).mockReturnValue({ lines: [], fees: 260, deposit: 0, total: 260, dueNow: 20 } as FeeEstimate);
    const seriesSchedule = {
      ...schedule,
      occurrences: [
        { date: "2027-06-06", availability: { status: "open" as const }, billing: "upcoming" as const },
        { date: "2027-06-13", availability: { status: "open" as const }, billing: "upcoming" as const },
      ],
    };
    const c = makeCase({ state: "draft", tier: "instant", location, schedule: seriesSchedule, tasks: [makeTask({ id: "PMT-27-0001:pay_fees", catalogId: "pay_fees" })] });
    const result = transition(c, { type: "book_and_pay", method: "card" }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.schedule?.occurrences.map((o) => o.billing)).toEqual(["paid", "upcoming"]);
    expect(result.case.payments[0].amount).toBe(20);
  });

  it("fails when the date is booked", () => {
    vi.mocked(availability).mockReturnValue({ status: "booked", reason: "Shelter 3 is booked by the 40th birthday picnic on May 22." });
    const c = makeCase({ state: "draft", tier: "instant", location, schedule });
    const result = transition(c, { type: "book_and_pay", method: "card" }, "applicant", makeCtx());
    expect(result).toEqual({ ok: false, reason: "Shelter 3 is booked by the 40th birthday picnic on May 22." });
  });

  it("fails for a Reviewed or Special tier", () => {
    const c = makeCase({ state: "draft", tier: "reviewed", location, schedule });
    const result = transition(c, { type: "book_and_pay", method: "card" }, "applicant", makeCtx());
    expect(result.ok).toBe(false);
  });
});

describe("complete_task", () => {
  it("a card needing a check goes to submitted", () => {
    const task = makeTask({ id: "PMT-27-0001:insurance_certificate", catalogId: "insurance_certificate", reviewer: "hl" });
    const c = makeCase({ state: "submitted", tasks: [task] });
    const result = transition(c, { type: "complete_task", taskId: task.id, files: [{ name: "coi.pdf", size: 100, type: "application/pdf" }] }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.tasks[0].status).toBe("submitted");
  });

  it("a card with no check goes straight to done", () => {
    const task = makeTask({ id: "PMT-27-0001:carry_permit", catalogId: "carry_permit", kind: "action" });
    const c = makeCase({ state: "permitted", tasks: [task] });
    const result = transition(c, { type: "complete_task", taskId: task.id }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.tasks[0].status).toBe("done");
  });

  it("creates a verify task for the reviewer once the case is routed", () => {
    const task = makeTask({ id: "PMT-27-0001:insurance_certificate", catalogId: "insurance_certificate", reviewer: "hl" });
    const c = makeCase({ state: "in_review", tasks: [task] });
    const result = transition(c, { type: "complete_task", taskId: task.id }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const verify = result.case.tasks.find((t) => t.catalogId.startsWith("verify:"));
    expect(verify).toBeDefined();
    expect(verify?.owner).toBe("hl");
  });

  it("does not duplicate a verify task when the reviewer already has one open", () => {
    const card1 = makeTask({ id: "PMT-27-0001:a", catalogId: "insurance_certificate", reviewer: "hl" });
    const card2 = makeTask({ id: "PMT-27-0001:b", catalogId: "vendor_list", reviewer: "hl" });
    const existingVerify = makeTask({ id: "PMT-27-0001:verify:a", catalogId: "verify:a", owner: "hl", kind: "review" });
    const c = makeCase({ state: "in_review", tasks: [card1, card2, existingVerify] });
    const result = transition(c, { type: "complete_task", taskId: card2.id }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.tasks.filter((t) => t.kind === "review")).toHaveLength(1);
  });

  it("raises presubmit_done and unlocks submit_application once every preSubmit card is in", () => {
    const sound = makeTask({ id: "PMT-27-0001:sound_details", catalogId: "sound_details", reviewer: "pws" });
    const submitApp = makeTask({ id: "PMT-27-0001:submit_application", catalogId: "submit_application", status: "locked", unlocksOn: "presubmit_done" });
    const c = makeCase({ state: "draft", tier: "reviewed", tasks: [sound, submitApp] });
    const result = transition(c, { type: "complete_task", taskId: sound.id }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.tasks.find((t) => t.catalogId === "submit_application")?.status).toBe("todo");
  });

  it("fails on a locked card", () => {
    const task = makeTask({ id: "PMT-27-0001:x", catalogId: "accept_and_sign", status: "locked" });
    const c = makeCase({ state: "submitted", tasks: [task] });
    const result = transition(c, { type: "complete_task", taskId: task.id }, "applicant", makeCtx());
    expect(result).toEqual({ ok: false, reason: expect.any(String) });
    if (result.ok) return;
    expect(result.reason.length).toBeGreaterThan(0);
  });
});

describe("simulate_signoff", () => {
  it("adds one sign-off and finishes the card at 12 of 12", () => {
    const task = makeTask({ id: "PMT-27-0001:neighbor_signoff", catalogId: "neighbor_signoff", kind: "sign_off", payload: { progress: { done: 11, total: 12 } } });
    const c = makeCase({ state: "submitted", tasks: [task] });
    const result = transition(c, { type: "simulate_signoff" }, "neighbor", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.tasks[0].payload.progress).toEqual({ done: 12, total: 12 });
    expect(result.case.tasks[0].status).toBe("done");
  });

  it("fails once everyone has signed off", () => {
    const task = makeTask({ id: "PMT-27-0001:neighbor_signoff", catalogId: "neighbor_signoff", status: "done", payload: { progress: { done: 12, total: 12 } } });
    const c = makeCase({ state: "submitted", tasks: [task] });
    const result = transition(c, { type: "simulate_signoff" }, "neighbor", makeCtx());
    expect(result.ok).toBe(false);
  });
});

describe("submit", () => {
  it("Draft to Submitted: creates the intake task", () => {
    const submitApp = makeTask({ id: "PMT-27-0001:submit_application", catalogId: "submit_application", status: "todo" });
    const c = makeCase({ state: "draft", tier: "reviewed", tasks: [submitApp] });
    const result = transition(c, { type: "submit" }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.state).toBe("submitted");
    expect(result.case.submittedAt).toBe("2027-05-03T09:00");
    expect(result.case.tasks.find((t) => t.catalogId === "submit_application")?.status).toBe("done");
    expect(result.case.tasks.find((t) => t.catalogId === "intake_check")).toBeDefined();
  });

  it("fails while submit_application is still locked", () => {
    const submitApp = makeTask({ id: "PMT-27-0001:submit_application", catalogId: "submit_application", status: "locked", unlocksOn: "presubmit_done" });
    const c = makeCase({ state: "draft", tier: "reviewed", tasks: [submitApp] });
    const result = transition(c, { type: "submit" }, "applicant", makeCtx());
    expect(result.ok).toBe(false);
  });
});

describe("respond_to_request (S3)", () => {
  it("pins on vendor_health_permit:1, responds, verifies and approves", () => {
    const card = makeTask({
      id: "PMT-27-0118:vendor_health_permit:1",
      catalogId: "vendor_health_permit",
      reviewer: "hl",
      status: "submitted",
      request: { from: "hl", message: "Send the food truck's current health permit.", at: "2027-04-30T09:00", dueDate: "2027-05-05", resolved: false },
    });
    const review = { dept: "hl" as const, sections: ["Food"], status: "needs_info" as const, dueDate: "2027-05-14", decidedOn: null, clock: { startedOn: "2027-04-19", pausedSince: "2027-04-30", pausedDays: 0, allowedDays: 14 } as const, internalNote: "", messageToApplicant: "" };
    const c = makeCase({ id: "PMT-27-0118", state: "needs_info", reviews: [review], tasks: [card] });
    const respond = transition(c, { type: "respond_to_request", taskId: card.id, files: [{ name: "permit.pdf", size: 10, type: "application/pdf" }] }, "applicant", makeCtx());
    expect(respond.ok).toBe(true);
    if (!respond.ok) return;
    expect(respond.case.state).toBe("in_review");
    expect(respond.case.reviews[0].status).toBe("pending");
    expect(respond.case.reviews[0].clock.pausedDays).toBe(3);

    const verify = transition(respond.case, { type: "verify_document", taskId: card.id }, "hl", makeCtx());
    expect(verify.ok).toBe(true);
    if (!verify.ok) return;
    expect(verify.case.tasks.find((t) => t.id === card.id)?.status).toBe("done");

    const decided = transition(verify.case, { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }, "hl", makeCtx());
    expect(decided.ok).toBe(true);
    if (!decided.ok) return;
    expect(decided.case.reviews[0].status).toBe("approved");
  });
});

describe("accept_and_sign and pay", () => {
  function quoteSentCase(): EventCase {
    const acceptSign = makeTask({ id: "PMT-27-0001:accept_and_sign", catalogId: "accept_and_sign", kind: "sign_off" });
    const payFees = makeTask({ id: "PMT-27-0001:pay_fees", catalogId: "pay_fees", kind: "payment" });
    const insurance = makeTask({ id: "PMT-27-0001:insurance_certificate", catalogId: "insurance_certificate", status: "done" });
    const issuePermit = makeTask({ id: "PMT-27-0001:issue_permit", catalogId: "issue_permit", owner: "clerk", kind: "action", status: "locked" });
    return makeCase({ state: "quote_sent", feeLines: [{ id: "f1", dept: "clerk", label: "Application fee", qty: 1, unit: "flat", unitPrice: 50, estimate: 50, actual: null, kind: "fee" }], tasks: [acceptSign, payFees, insurance, issuePermit] });
  }

  it("signing alone does not unlock issue_permit", () => {
    const c = quoteSentCase();
    const result = transition(c, { type: "accept_and_sign", signature: "Maya Chen" }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.flags.signed).toBe(true);
    expect(result.case.tasks.find((t) => t.catalogId === "issue_permit")?.status).toBe("locked");
  });

  it("paying after signing unlocks issue_permit", () => {
    const signed = transition(quoteSentCase(), { type: "accept_and_sign", signature: "Maya Chen" }, "applicant", makeCtx());
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    const paid = transition(signed.case, { type: "pay", amount: 50, method: "card", kind: "quote" }, "applicant", makeCtx());
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    expect(paid.case.tasks.find((t) => t.catalogId === "issue_permit")?.status).toBe("todo");
    expect(paid.case.tasks.find((t) => t.catalogId === "pay_fees")?.status).toBe("done");
  });
});

describe("withdraw and cancel", () => {
  it("withdraw ends the case before a permit exists", () => {
    const c = makeCase({ state: "submitted", dateHold: { status: "held", placedOn: "2027-04-19", expiresOn: null } });
    const result = transition(c, { type: "withdraw" }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.ending).toBe("withdrawn");
    expect(result.case.dateHold.status).toBe("released");
  });

  it("withdraw fails once a permit exists", () => {
    const c = makeCase({ state: "permitted", permit: { issuedOn: "2027-05-01", signature: null } });
    const result = transition(c, { type: "withdraw" }, "applicant", makeCtx());
    expect(result.ok).toBe(false);
  });

  it("cancel on S1's own day refunds $62.50", () => {
    vi.mocked(cancellationRefund).mockReturnValue({ refund: 62.5, kept: 62.5, rule: "Under 10 days: no refund of fees" });
    const c = makeCase({
      state: "permitted",
      permit: { issuedOn: "2027-04-20", signature: null },
      schedule: { date: "2027-05-22", start: "11:00", end: "16:00", occurrences: [{ date: "2027-05-22", availability: { status: "open" }, billing: "paid" }] },
      feeLines: [{ id: "f1", dept: "clerk", label: "Shelter", qty: 5, unit: "hour", unitPrice: 25, estimate: 125, actual: null, kind: "fee" }],
    });
    const result = transition(c, { type: "cancel" }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.ending).toBe("cancelled");
    expect(result.case.payments[0].amount).toBe(-62.5);
  });

  it("cancel fails once the last session has passed", () => {
    const c = makeCase({
      state: "permitted",
      permit: { issuedOn: "2027-04-01", signature: null },
      schedule: { date: "2027-04-20", start: "11:00", end: "16:00", occurrences: [{ date: "2027-04-20", availability: { status: "open" }, billing: "paid" }] },
    });
    const result = transition(c, { type: "cancel" }, "applicant", makeCtx());
    expect(result.ok).toBe(false);
  });
});

describe("submit_feedback and book_again", () => {
  it("submit_feedback stores the rating and finishes the card", () => {
    const card = makeTask({ id: "PMT-27-0001:feedback", catalogId: "feedback", kind: "form" });
    const c = makeCase({ state: "closed", tasks: [card] });
    const result = transition(c, { type: "submit_feedback", rating: 5, comment: "Great." }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.closeout.feedback).toEqual({ rating: 5, comment: "Great." });
    expect(result.case.tasks[0].status).toBe("done");
  });

  it("book_again spawns a Draft dated 364 days later, same weekday", () => {
    const card = makeTask({ id: "PMT-27-0001:book_again", catalogId: "book_again", kind: "action" });
    const c = makeCase({
      id: "PMT-27-0001",
      state: "closed",
      schedule: { date: "2027-04-24", start: "12:00", end: "21:00", occurrences: [{ date: "2027-04-24", availability: { status: "open" }, billing: "paid" }] },
      tasks: [card],
    });
    const result = transition(c, { type: "book_again" }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.tasks[0].status).toBe("done");
    expect(result.spawned).toHaveLength(1);
    const spawned = result.spawned![0];
    expect(spawned.state).toBe("draft");
    expect(spawned.clonedFrom).toBe("PMT-27-0001");
    expect(spawned.schedule?.date).toBe("2028-04-22");
  });
});

describe("amend", () => {
  it("adds new amendment-tagged cards and keeps the permit valid for the original plan", () => {
    vi.mocked(classify).mockReturnValue({ ...instantCls, tier: "reviewed", summary: "This is a Reviewed event" });
    const djCard = makeTask({ id: "PMT-27-0001:sound_details", catalogId: "sound_details", reviewer: "pws" });
    vi.mocked(requirements).mockReturnValue([djCard]);
    const c = makeCase({
      state: "permitted",
      tier: "instant",
      permit: { issuedOn: "2027-05-01", signature: null },
      schedule: { date: "2027-06-26", start: "14:00", end: "20:00", occurrences: [{ date: "2027-06-26", availability: { status: "open" }, billing: "paid" }] },
    });
    const result = transition(c, { type: "amend", answers: { ...c, addOns: { ...c.addOns, amplifiedSound: true } }, lateFee: true }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.tier).toBe("reviewed");
    expect(result.case.flags.amendmentPending).toBe(true);
    expect(result.case.flags.lateFee).toBe(true);
    expect(result.case.tasks.find((t) => t.catalogId === "sound_details")?.tags).toEqual(["amendment"]);
    expect(result.case.permit).toEqual({ issuedOn: "2027-05-01", signature: null });
  });

  it("fails on a Draft", () => {
    const c = makeCase({ state: "draft" });
    const result = transition(c, { type: "amend", answers: c }, "applicant", makeCtx());
    expect(result.ok).toBe(false);
  });
});
