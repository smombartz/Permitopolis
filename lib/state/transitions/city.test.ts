import { describe, expect, it, vi } from "vitest";
import { makeCase, makeCtx, makeTask } from "../testSupport";
import { transition } from "../transition";

vi.mock("@/lib/rules", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rules")>("@/lib/rules");
  return {
    ...actual,
    dueDate: vi.fn((base: string, days: number) => base.slice(0, 8) + String(Number(base.slice(8, 10)) + days).padStart(2, "0")),
  };
});

describe("request_info (Jazz in the Plaza style)", () => {
  it("by a routed department pins a request, pauses its clock, moves to Needs info", () => {
    const review = { dept: "pws" as const, sections: ["Sound"], status: "pending" as const, dueDate: "2027-06-04", decidedOn: null, clock: { startedOn: "2027-05-20", pausedSince: null, pausedDays: 0, allowedDays: 14 }, internalNote: "", messageToApplicant: "" };
    const card = makeTask({ id: "PMT-27-0050:sound_details", catalogId: "sound_details", reviewer: "pws", status: "submitted" });
    const c = makeCase({ state: "in_review", reviews: [review], tasks: [card] });
    const result = transition(c, { type: "request_info", taskId: card.id, message: "What hours is sound amplified?" }, "pws", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.state).toBe("needs_info");
    expect(result.case.reviews[0].status).toBe("needs_info");
    expect(result.case.reviews[0].clock.pausedSince).toBe("2027-05-03");
    expect(result.case.tasks.find((t) => t.id === card.id)?.status).toBe("todo");
    expect(result.case.tasks.find((t) => t.id === card.id)?.request?.resolved).toBe(false);
  });

  it("with no taskId creates a respond_to_request card", () => {
    const c = makeCase({ state: "submitted" });
    const result = transition(c, { type: "request_info", item: "Proof of nonprofit status", message: "Please attach your 501(c)(3) letter." }, "clerk", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const created = result.case.tasks.find((t) => t.catalogId === "respond_to_request");
    expect(created?.title).toBe("Proof of nonprofit status");
    expect(result.case.state).toBe("needs_info");
  });
});

describe("verify_document / reject_document", () => {
  it("rejects with a reason, back to changes_requested", () => {
    const card = makeTask({ id: "PMT-27-0001:insurance_certificate", catalogId: "insurance_certificate", status: "submitted", reviewer: "hl" });
    const c = makeCase({ state: "in_review", tasks: [card] });
    const result = transition(c, { type: "reject_document", taskId: card.id, reason: "Coverage is only $500k; $1M is required." }, "hl", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.tasks[0].status).toBe("changes_requested");
    expect(result.case.tasks[0].payload.rejectedReason).toBe("Coverage is only $500k; $1M is required.");
  });

  it("fails on a card that isn't submitted", () => {
    const card = makeTask({ id: "PMT-27-0001:x", catalogId: "insurance_certificate", status: "todo" });
    const c = makeCase({ state: "in_review", tasks: [card] });
    const result = transition(c, { type: "verify_document", taskId: card.id }, "hl", makeCtx());
    expect(result.ok).toBe(false);
  });
});

describe("review_decide", () => {
  it("approve_with_conditions sets conditions, fee lines, finishes the review task, marks submitted cards done, and opens consolidate once all are in", () => {
    const review = { dept: "pws" as const, sections: ["Closure"], status: "pending" as const, dueDate: "2027-05-17", decidedOn: null, clock: { startedOn: "2027-04-19", pausedSince: null, pausedDays: 0, allowedDays: 30 }, internalNote: "", messageToApplicant: "" };
    const otherReview = { dept: "hl" as const, sections: ["Insurance"], status: "approved" as const, dueDate: "2027-05-17", decidedOn: "2027-05-10", clock: { startedOn: "2027-04-19", pausedSince: null, pausedDays: 0, allowedDays: 30 }, internalNote: "", messageToApplicant: "" };
    const reviewTask = makeTask({ id: "PMT-27-0115:review:pws", catalogId: "review:pws", owner: "pws", kind: "review" });
    const card = makeTask({ id: "PMT-27-0115:city_services_request", catalogId: "city_services_request", status: "submitted", reviewer: "pws" });
    const c = makeCase({ id: "PMT-27-0115", state: "in_review", reviews: [review, otherReview], tasks: [reviewTask, card] });
    const result = transition(c, { type: "review_decide", decision: "approve_with_conditions", conditions: ["End amplified sound by 8pm."], feeLines: [{ dept: "pws", label: "Barricades", qty: 4, unit: "each", unitPrice: 15 }] }, "pws", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.reviews.find((r) => r.dept === "pws")?.status).toBe("approved_with_conditions");
    expect(result.case.conditions).toHaveLength(1);
    expect(result.case.feeLines[0]).toMatchObject({ label: "Barricades", estimate: 60 });
    expect(result.case.tasks.find((t) => t.catalogId === "review:pws")?.status).toBe("done");
    expect(result.case.tasks.find((t) => t.id === card.id)?.status).toBe("done");
    expect(result.case.tasks.find((t) => t.catalogId === "consolidate")).toBeDefined();
  });

  it("deny does not end the case", () => {
    const review = { dept: "hl" as const, sections: ["Insurance"], status: "pending" as const, dueDate: "2027-05-17", decidedOn: null, clock: { startedOn: "2027-04-19", pausedSince: null, pausedDays: 0, allowedDays: 30 }, internalNote: "", messageToApplicant: "" };
    const c = makeCase({ state: "in_review", reviews: [review] });
    const result = transition(c, { type: "review_decide", decision: "deny", conditions: [], feeLines: [] }, "hl", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.ending).toBeNull();
    expect(result.case.state).toBe("in_review");
    expect(result.case.reviews[0].status).toBe("denied");
  });

  it("fails when the department isn't routed", () => {
    const c = makeCase({ state: "in_review", reviews: [] });
    const result = transition(c, { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }, "pws", makeCtx());
    expect(result.ok).toBe(false);
  });
});

describe("schedule_meeting and complete_city_task", () => {
  it("schedule_meeting sets scheduledFor and finishes the scheduler task for a pre-application meeting", () => {
    const meeting = makeTask({ id: "PMT-27-0001:pre_application_meeting", catalogId: "pre_application_meeting", kind: "meeting" });
    const scheduler = makeTask({ id: "PMT-27-0001:schedule_pre_application_meeting", catalogId: "schedule_pre_application_meeting", owner: "clerk", kind: "meeting" });
    const c = makeCase({ state: "submitted", tasks: [meeting, scheduler] });
    const result = transition(c, { type: "schedule_meeting", taskId: meeting.id, date: "2027-05-10" }, "clerk", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.tasks.find((t) => t.id === meeting.id)?.payload.scheduledFor).toBe("2027-05-10");
    expect(result.case.tasks.find((t) => t.id === scheduler.id)?.status).toBe("done");
  });

  it("complete_city_task finishes a city-owned task", () => {
    const workOrder = makeTask({ id: "PMT-27-0097:work_order:barricades", catalogId: "work_order:barricades", owner: "pws", kind: "action" });
    const c = makeCase({ state: "permitted", tasks: [workOrder] });
    const result = transition(c, { type: "complete_city_task", taskId: workOrder.id, note: "Delivered." }, "pws", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.tasks[0].status).toBe("done");
  });
});

describe("log_closeout (S6)", () => {
  it("fills actuals for listed lines, keeps estimate for the rest, appends extra lines, raises hours_logged", () => {
    const cleanup = makeTask({ id: "PMT-27-0200:cleanup_inspection", catalogId: "cleanup_inspection", owner: "pws", kind: "inspection" });
    const hours = makeTask({ id: "PMT-27-0200:log_actual_hours", catalogId: "log_actual_hours", owner: "pws", kind: "action" });
    const reconcile = makeTask({ id: "PMT-27-0200:reconcile", catalogId: "reconcile", owner: "clerk", kind: "action", status: "locked", unlocksOn: "hours_logged" });
    const c = makeCase({
      id: "PMT-27-0200",
      state: "closeout",
      feeLines: [
        { id: "f1", dept: "pws", label: "Police", qty: 66, unit: "hour", unitPrice: 85, estimate: 5610, actual: null, kind: "fee" },
        { id: "f2", dept: "clerk", label: "Deposit", qty: 1, unit: "flat", unitPrice: 1000, estimate: 1000, actual: null, kind: "deposit" },
      ],
      tasks: [cleanup, hours, reconcile],
    });
    const result = transition(c, { type: "log_closeout", cleanup: "pass", actuals: [{ feeLineId: "f1", qty: 72 }], extraLines: [{ dept: "pws", label: "Cleanup crew", qty: 4, unit: "hour", unitPrice: 60 }] }, "pws", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.feeLines.find((f) => f.id === "f1")?.actual).toBe(6120);
    expect(result.case.feeLines.find((f) => f.id === "f2")?.actual).toBe(1000);
    expect(result.case.feeLines.find((f) => f.label === "Cleanup crew")).toMatchObject({ estimate: 0, actual: 240 });
    expect(result.case.closeout.hoursLoggedOn).toBe("2027-05-03");
    expect(result.case.tasks.find((t) => t.catalogId === "cleanup_inspection")?.status).toBe("done");
    expect(result.case.tasks.find((t) => t.catalogId === "log_actual_hours")?.status).toBe("done");
    expect(result.case.tasks.find((t) => t.catalogId === "reconcile")?.status).toBe("todo");
  });

  it("fails when there is nothing to close out yet", () => {
    const c = makeCase({ state: "permitted", tier: "reviewed" });
    const result = transition(c, { type: "log_closeout", cleanup: "pass", actuals: [], extraLines: [] }, "pws", makeCtx());
    expect(result.ok).toBe(false);
  });
});

describe("add_note, remind and send_to_commission", () => {
  it("add_note only appends activity", () => {
    const c = makeCase({ state: "in_review" });
    const result = transition(c, { type: "add_note", text: "Called the organizer to confirm start time." }, "clerk", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.activity).toHaveLength(1);
    expect(result.case.tasks).toEqual(c.tasks);
  });

  it("add_note works even on an ended case", () => {
    const c = makeCase({ state: "submitted", ending: "withdrawn", endingReason: "Withdrawn by the applicant." });
    const result = transition(c, { type: "add_note", text: "Follow-up call placed." }, "clerk", makeCtx());
    expect(result.ok).toBe(true);
  });

  it("every other action fails on an ended case", () => {
    const c = makeCase({ state: "submitted", ending: "withdrawn" });
    const result = transition(c, { type: "remind", party: "applicant" }, "clerk", makeCtx());
    expect(result.ok).toBe(false);
  });

  it("send_to_commission sets the flag without changing state", () => {
    const c = makeCase({ state: "in_review" });
    const result = transition(c, { type: "send_to_commission" }, "clerk", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.flags.sentToCommission).toBe(true);
    expect(result.case.state).toBe("in_review");
  });
});
