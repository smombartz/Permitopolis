import { describe, expect, it, vi } from "vitest";
import { makeCase, makeCtx, makeTask } from "../testSupport";
import { transition } from "../transition";
import { nextMove, waitingOn } from "../waitingOn";

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

  it("parks the asker's own review task until the applicant answers, then gives it back", () => {
    const review = { dept: "hl" as const, sections: ["Vendor list"], status: "pending" as const, dueDate: "2027-05-03", decidedOn: null, clock: { startedOn: "2027-04-19", pausedSince: null, pausedDays: 0, allowedDays: 14 }, internalNote: "", messageToApplicant: "" };
    const pwsReview = { ...review, dept: "pws" as const, sections: ["Sound details"] };
    const card = makeTask({ id: "PMT-27-0118:vendor_health_permit:1", catalogId: "vendor_health_permit", reviewer: "hl" });
    const hlTask = makeTask({ id: "PMT-27-0118:review:hl", catalogId: "review:hl", owner: "hl", kind: "review" });
    const pwsTask = makeTask({ id: "PMT-27-0118:review:pws", catalogId: "review:pws", owner: "pws", kind: "review" });
    const c = makeCase({ id: "PMT-27-0118", state: "in_review", reviews: [pwsReview, review], tasks: [card, hlTask, pwsTask] });

    const asked = transition(c, { type: "request_info", taskId: card.id, message: "Please upload the current health permit", dueDate: "2027-05-05" }, "hl", makeCtx());
    expect(asked.ok).toBe(true);
    if (!asked.ok) return;
    const parked = asked.case.tasks.find((t) => t.id === hlTask.id);
    expect(parked?.status).toBe("locked");
    expect(parked?.payload.awaitingAnswer).toBe(true);
    // Another department's review is not touched.
    expect(asked.case.tasks.find((t) => t.id === pwsTask.id)?.status).toBe("todo");

    const answered = transition(asked.case, { type: "respond_to_request", taskId: card.id, files: [{ name: "permit.pdf", size: 10, type: "application/pdf" }] }, "applicant", makeCtx({ today: "2027-05-04", now: "2027-05-04T09:00" }));
    expect(answered.ok).toBe(true);
    if (!answered.ok) return;
    expect(answered.case.state).toBe("in_review");
    expect(answered.case.tasks.find((t) => t.id === hlTask.id)?.status).toBe("todo");
    // The review it got back is the re-review task: no second task is created for the same answer.
    expect(answered.case.tasks.filter((t) => t.owner === "hl")).toHaveLength(1);
  });

  it("a Clerk's request at intake parks the intake check, and the answer returns the case to Submitted", () => {
    const intake = makeTask({ id: "PMT-27-0001:intake_check", catalogId: "intake_check", owner: "clerk", kind: "review" });
    const c = makeCase({ state: "submitted", tasks: [intake] });
    const asked = transition(c, { type: "request_info", item: "Certificate of insurance", message: "The certificate is missing." }, "clerk", makeCtx());
    expect(asked.ok).toBe(true);
    if (!asked.ok) return;
    expect(asked.case.tasks.find((t) => t.id === intake.id)?.status).toBe("locked");
    const requestCard = asked.case.tasks.find((t) => t.catalogId === "respond_to_request");
    const answered = transition(asked.case, { type: "respond_to_request", taskId: requestCard!.id, message: "Attached." }, "applicant", makeCtx());
    expect(answered.ok).toBe(true);
    if (!answered.ok) return;
    expect(answered.case.state).toBe("submitted");
    expect(answered.case.tasks.find((t) => t.id === intake.id)?.status).toBe("todo");
  });

  it("a second request while the clock is already paused keeps the day the pause began", () => {
    const review = { dept: "hl" as const, sections: ["Vendor list"], status: "pending" as const, dueDate: "2027-05-03", decidedOn: null, clock: { startedOn: "2027-04-19", pausedSince: null, pausedDays: 0, allowedDays: 14 }, internalNote: "", messageToApplicant: "" };
    const c = makeCase({ state: "in_review", reviews: [review] });
    const first = transition(c, { type: "request_info", item: "Health permit", message: "Please upload it." }, "hl", makeCtx({ today: "2027-04-26", now: "2027-04-26T09:00" }));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = transition(first.case, { type: "request_info", item: "Vendor menu", message: "And the menu, please." }, "hl", makeCtx({ today: "2027-04-30", now: "2027-04-30T09:00" }));
    expect(second.ok && second.case.reviews[0].clock.pausedSince).toBe("2027-04-26");
  });

  it("refuses a card that does not exist, or is not the applicant's, instead of throwing", () => {
    const review = { dept: "hl" as const, sections: ["Vendor list"], status: "pending" as const, dueDate: "2027-05-03", decidedOn: null, clock: { startedOn: "2027-04-19", pausedSince: null, pausedDays: 0, allowedDays: 14 }, internalNote: "", messageToApplicant: "" };
    const reviewTask = makeTask({ id: "PMT-27-0001:review:hl", catalogId: "review:hl", owner: "hl", kind: "review" });
    const c = makeCase({ state: "in_review", reviews: [review], tasks: [reviewTask] });
    expect(transition(c, { type: "request_info", taskId: "PMT-27-0001:no_such_card", message: "?" }, "hl", makeCtx())).toEqual({ ok: false, reason: "Card not found." });
    expect(transition(c, { type: "request_info", taskId: reviewTask.id, message: "?" }, "hl", makeCtx())).toEqual({ ok: false, reason: "Card not found." });
  });

  it("refuses a department that has already decided its review", () => {
    const review = { dept: "pws" as const, sections: ["Sound"], status: "approved" as const, dueDate: "2027-05-03", decidedOn: "2027-04-28", clock: { startedOn: "2027-04-19", pausedSince: null, pausedDays: 0, allowedDays: 14 }, internalNote: "", messageToApplicant: "" };
    const c = makeCase({ state: "in_review", reviews: [review] });
    expect(transition(c, { type: "request_info", item: "Sound plan", message: "One more thing." }, "pws", makeCtx())).toEqual({ ok: false, reason: "Review is already approved." });
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

  it("deny finishes the department's review task and hands the Clerk the decision", () => {
    const review = { dept: "hl" as const, sections: ["Insurance"], status: "pending" as const, dueDate: "2027-05-17", decidedOn: null, clock: { startedOn: "2027-04-19", pausedSince: null, pausedDays: 0, allowedDays: 30 }, internalNote: "", messageToApplicant: "" };
    const reviewTask = makeTask({ id: "PMT-27-0001:review:hl", catalogId: "review:hl", owner: "hl", kind: "review" });
    const c = makeCase({ state: "in_review", reviews: [review], tasks: [reviewTask] });
    const result = transition(c, { type: "review_decide", decision: "deny", conditions: [], feeLines: [] }, "hl", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.tasks.find((t) => t.id === reviewTask.id)?.status).toBe("done");
    expect(result.case.tasks.find((t) => t.catalogId === "consolidate")).toMatchObject({ owner: "clerk", status: "todo", title: "Decide: a reviewer denied" });

    const standing = Object.fromEntries(waitingOn(result.case, "2027-05-03").map((p) => [p.party, p.status]));
    expect(standing).toMatchObject({ clerk: "up_now", hl: "done_for_now" });
    expect(nextMove(result.case, "2027-05-03")).toBe("Next: City Clerk acts on a reviewer's denial.");
    expect(transition(result.case, { type: "send_quote", conditions: [], feeLines: [] }, "clerk", makeCtx())).toEqual({ ok: false, reason: "Health & Legal denied its section." });
    expect(transition(result.case, { type: "deny", reason: "Health & Legal could not approve the insurance." }, "clerk", makeCtx()).ok).toBe(true);
  });

  it("fails when the department isn't routed", () => {
    const c = makeCase({ state: "in_review", reviews: [] });
    const result = transition(c, { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }, "pws", makeCtx());
    expect(result.ok).toBe(false);
  });

  it("prices a reviewer's fee lines to the cent", () => {
    const review = { dept: "pws" as const, sections: ["Route"], status: "pending" as const, dueDate: "2027-05-17", decidedOn: null, clock: { startedOn: "2027-04-19", pausedSince: null, pausedDays: 0, allowedDays: 21 }, internalNote: "", messageToApplicant: "" };
    const c = makeCase({ state: "in_review", reviews: [review] });
    const feeLines = [
      { dept: "pws" as const, label: "Route closure", qty: 3.1, unit: "mile", unitPrice: 400 },
      { dept: "pws" as const, label: "Police", qty: 1.1, unit: "officer-hour", unitPrice: 85 },
    ];
    const result = transition(c, { type: "review_decide", decision: "approve", conditions: [], feeLines }, "pws", makeCtx());
    // 3.1 * 400 is 1240.0000000000002 and 1.1 * 85 is 93.50000000000001 in floating point.
    expect(result.ok && result.case.feeLines.map((line) => line.estimate)).toEqual([1240, 93.5]);
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

  it("a meeting can be moved to another day, and the scheduling is done only once", () => {
    const meeting = makeTask({ id: "PMT-27-0001:pre_application_meeting", catalogId: "pre_application_meeting", kind: "meeting", reviewer: "clerk" });
    const scheduler = makeTask({ id: "PMT-27-0001:schedule_pre_application_meeting", catalogId: "schedule_pre_application_meeting", owner: "clerk", kind: "meeting" });
    const first = transition(makeCase({ state: "in_review", tasks: [meeting, scheduler] }), { type: "schedule_meeting", taskId: meeting.id, date: "2027-05-10" }, "clerk", makeCtx());
    const moved = first.ok ? transition(first.case, { type: "schedule_meeting", taskId: meeting.id, date: "2027-05-12" }, "clerk", makeCtx()) : first;
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.case.tasks.find((t) => t.id === meeting.id)?.payload.scheduledFor).toBe("2027-05-12");
    expect(moved.case.tasks.find((t) => t.id === scheduler.id)?.history.filter((h) => h.status === "done")).toHaveLength(1);

    const held = transition(moved.case, { type: "complete_city_task", taskId: meeting.id }, "clerk", makeCtx());
    expect(held.ok && held.case.tasks.find((t) => t.id === meeting.id)?.status).toBe("done");
    expect(held.ok && transition(held.case, { type: "schedule_meeting", taskId: meeting.id, date: "2027-05-14" }, "clerk", makeCtx())).toEqual({ ok: false, reason: "That meeting has already been held." });
  });

  it("holding the pre-application meeting without scheduling it first still clears the Clerk's scheduling task", () => {
    const meeting = makeTask({ id: "PMT-27-0001:pre_application_meeting", catalogId: "pre_application_meeting", kind: "meeting", reviewer: "clerk" });
    const scheduler = makeTask({ id: "PMT-27-0001:schedule_pre_application_meeting", catalogId: "schedule_pre_application_meeting", owner: "clerk", kind: "meeting" });
    const held = transition(makeCase({ state: "in_review", tasks: [meeting, scheduler] }), { type: "complete_city_task", taskId: meeting.id }, "clerk", makeCtx());
    expect(held.ok).toBe(true);
    if (!held.ok) return;
    // A meeting that was held no longer needs a date: nothing is left in the Clerk's queue.
    expect(held.case.tasks.map((t) => [t.catalogId, t.status])).toEqual([
      ["pre_application_meeting", "done"],
      ["schedule_pre_application_meeting", "done"],
    ]);
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

  it("prices actuals and extra lines to the cent", () => {
    const c = makeCase({
      id: "PMT-27-0200",
      state: "closeout",
      feeLines: [{ id: "f1", dept: "clerk", label: "Route closure", qty: 3, unit: "mile", unitPrice: 400, estimate: 1200, actual: null, kind: "fee" }],
    });
    const result = transition(
      c,
      { type: "log_closeout", cleanup: "pass", actuals: [{ feeLineId: "f1", qty: 3.1 }], extraLines: [{ dept: "pws", label: "Overtime police", qty: 1.1, unit: "officer-hour", unitPrice: 85 }] },
      "pws",
      makeCtx(),
    );
    expect(result.ok && result.case.feeLines.map((line) => line.actual)).toEqual([1240, 93.5]);
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
