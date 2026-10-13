import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Classification, FeeEstimate } from "@/lib/rules/types";
import type { EventCase } from "@/lib/types";
import { makeCase, makeCtx, makeTask } from "../testSupport";
import { transition } from "../transition";
import { waitingOn } from "../waitingOn";

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
    const freshCard = makeTask({ id: "PMT-27-0001:insurance_certificate", catalogId: "insurance_certificate", status: "todo", history: [] });
    vi.mocked(requirements).mockReturnValue([freshCard]);
    const files = [{ name: "coi.pdf", size: 100, type: "application/pdf" }];
    const existing = makeTask({ id: freshCard.id, catalogId: "insurance_certificate", status: "submitted", payload: { files }, history: [{ at: "2027-05-03T09:00", actor: "applicant", status: "submitted" }] });
    const c = makeCase({ state: "draft", tasks: [existing] });
    const result = transition(c, { type: "create_board" }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.tasks[0].status).toBe("submitted");
    expect(result.case.tasks[0].payload).toEqual({ files });
    expect(result.case.tasks[0].history).toHaveLength(1);
  });

  it("rebuilding takes the payment card from the new plan: its amount and its lock are the plan's", () => {
    const fresh = makeTask({ id: "PMT-27-0001:pay_fees", catalogId: "pay_fees", kind: "payment", status: "locked", unlocksOn: "quote_sent", payload: { amount: 465 }, history: [] });
    vi.mocked(requirements).mockReturnValue([fresh]);
    const existing = makeTask({ id: fresh.id, catalogId: "pay_fees", kind: "payment", title: "Pay and book", status: "todo", payload: { amount: 125 } });
    const result = transition(makeCase({ state: "draft", tasks: [existing] }), { type: "create_board" }, "applicant", makeCtx());
    expect(result.ok && result.case.tasks[0]).toMatchObject({ status: "locked", unlocksOn: "quote_sent", payload: { amount: 465 } });
  });

  it("rebuilding keeps what is on a card (the sign-offs so far) and takes only a per-vendor card's vendor from the new plan", () => {
    const freshSignoff = makeTask({ id: "PMT-27-0001:neighbor_signoff", catalogId: "neighbor_signoff", kind: "action", payload: { progress: { done: 0, total: 12 } }, history: [] });
    const freshPermit = makeTask({ id: "PMT-27-0001:vendor_health_permit:1", catalogId: "vendor_health_permit", title: "Health permit: New Name", payload: { vendorName: "New Name" }, history: [] });
    vi.mocked(requirements).mockReturnValue([freshSignoff, freshPermit]);
    const signoff = makeTask({ id: freshSignoff.id, catalogId: "neighbor_signoff", kind: "action", payload: { progress: { done: 9, total: 12 } } });
    const file = { name: "permit.pdf", size: 1000, type: "application/pdf" };
    const permit = makeTask({ id: freshPermit.id, catalogId: "vendor_health_permit", title: "Health permit: Old Name", status: "submitted", payload: { vendorName: "Old Name", files: [file] } });
    const result = transition(makeCase({ state: "draft", tasks: [signoff, permit] }), { type: "create_board" }, "applicant", makeCtx());
    expect(result.ok && result.case.tasks[0].payload).toEqual({ progress: { done: 9, total: 12 } });
    expect(result.ok && result.case.tasks[1]).toMatchObject({ title: "Health permit: New Name", status: "submitted", payload: { vendorName: "New Name", files: [file] } });
  });

  it("fails outside Draft", () => {
    const c = makeCase({ state: "submitted" });
    const result = transition(c, { type: "create_board" }, "applicant", makeCtx());
    expect(result.ok).toBe(false);
  });

  it("lists the sessions from the rules engine, so a blackout session is skipped whoever built the schedule", () => {
    // Mondays at Field 3 across Memorial Day (all parks closed), built with every session "open".
    const c = makeCase({
      state: "draft",
      location: { mode: "inventory", inventoryIds: ["field-3"], segmentIds: [], label: "Field 3" },
      schedule: {
        date: "2027-05-24",
        start: "07:00",
        end: "08:00",
        recurrence: { frequency: "weekly", weekday: 1, until: "2027-06-07" },
        occurrences: [
          { date: "2027-05-24", availability: { status: "open" }, billing: "upcoming" },
          { date: "2027-05-31", availability: { status: "open" }, billing: "upcoming" },
          { date: "2027-06-07", availability: { status: "open" }, billing: "upcoming" },
        ],
      },
    });
    const result = transition(c, { type: "create_board" }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.schedule?.occurrences.map((o) => [o.date, o.availability.status, o.billing])).toEqual([
      ["2027-05-24", "open", "upcoming"],
      ["2027-05-31", "blackout", "skipped"],
      ["2027-06-07", "open", "upcoming"],
    ]);
    // Fees are estimated from the case with its sessions already listed.
    expect(vi.mocked(estimateFees).mock.calls.at(-1)?.[0].schedule?.occurrences[1].billing).toBe("skipped");
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
      date: "2027-06-06",
      recurrence: { frequency: "weekly" as const, weekday: 0, until: "2027-06-13" },
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

  it("fails inside the 10 days an Instant booking needs, unless the applicant took the late fee", () => {
    // May 22 is 19 days from May 3 and 9 days from May 13.
    const c = makeCase({ state: "draft", tier: "instant", location, schedule });
    const late = makeCtx({ today: "2027-05-13", now: "2027-05-13T09:00" });
    expect(transition(c, { type: "book_and_pay", method: "card" }, "applicant", late)).toEqual({
      ok: false,
      reason: "Needs 10 days of notice; pick a later date or add the late fee.",
    });
    expect(transition(c, { type: "book_and_pay", method: "card" }, "applicant", makeCtx({ today: "2027-05-12", now: "2027-05-12T09:00" })).ok).toBe(true);

    const withFee = { ...c, flags: { ...c.flags, lateFee: true } };
    expect(transition(withFee, { type: "book_and_pay", method: "card" }, "applicant", late).ok).toBe(true);
    expect(vi.mocked(estimateFees).mock.calls.at(-1)?.[3]).toMatchObject({ lateFee: true });
  });

  it("always rebuilds the board from the answers, whatever cards the Draft already had", () => {
    const payFees = makeTask({ id: "PMT-27-0001:pay_fees", catalogId: "pay_fees", kind: "payment", history: [] });
    vi.mocked(requirements).mockReturnValue([payFees]);
    vi.mocked(estimateFees).mockReturnValue({ lines: [{ id: "f1", dept: "clerk", label: "Shelter reservation", qty: 5, unit: "hour", unitPrice: 25, estimate: 125, actual: null, kind: "fee" }], fees: 125, deposit: 0, total: 125 } as FeeEstimate);
    const stale = makeTask({ id: "PMT-27-0001:insurance_certificate", catalogId: "insurance_certificate", reviewer: "hl" });
    const deposit = { id: "old", dept: "clerk" as const, label: "Refundable cleanup deposit", qty: 1, unit: "deposit", unitPrice: 250, estimate: 250, actual: null, kind: "deposit" as const };
    const c = makeCase({ state: "draft", tier: "instant", location, schedule, tasks: [stale], feeLines: [deposit] });
    const result = transition(c, { type: "book_and_pay", method: "card" }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.tasks.map((t) => t.catalogId)).toEqual(["pay_fees"]);
    expect(result.case.feeLines.map((line) => line.label)).toEqual(["Shelter reservation"]);
  });

  it("asks availability() about the window the event occupies: setup start to teardown end", () => {
    const withSetup = { ...schedule, setupStart: "09:30", teardownEnd: "17:00" };
    const c = makeCase({ state: "draft", tier: "instant", location, schedule: withSetup, tasks: [makeTask({ id: "PMT-27-0001:pay_fees", catalogId: "pay_fees" })] });
    transition(c, { type: "book_and_pay", method: "card" }, "applicant", makeCtx());
    expect(vi.mocked(availability)).toHaveBeenCalledWith(location, { date: "2027-05-22", start: "09:30", end: "17:00" }, expect.anything(), "PMT-27-0001");
  });

  it("a series fails when any session it would hold is booked, and says which", () => {
    vi.mocked(availability).mockImplementation((_location, window) =>
      window.date === "2027-06-13" ? { status: "booked", reason: "Little League practice has this date held" } : { status: "open" },
    );
    const series = {
      date: "2027-06-06",
      start: "08:00",
      end: "09:00",
      recurrence: { frequency: "weekly" as const, weekday: 0, until: "2027-06-13" },
      occurrences: [
        { date: "2027-06-06", availability: { status: "open" as const }, billing: "upcoming" as const },
        { date: "2027-06-13", availability: { status: "open" as const }, billing: "upcoming" as const },
      ],
    };
    const c = makeCase({ state: "draft", tier: "instant", location, schedule: series, tasks: [makeTask({ id: "PMT-27-0001:pay_fees", catalogId: "pay_fees" })] });
    const result = transition(c, { type: "book_and_pay", method: "card" }, "applicant", makeCtx());
    expect(result).toEqual({ ok: false, reason: "Sun, Jun 13, 2027: Little League practice has this date held" });
  });

  it("checks every session the schedule has now, even when the list stored on the Draft is out of date", () => {
    vi.mocked(availability).mockImplementation((_location, window) =>
      window.date === "2027-06-20" ? { status: "booked", reason: "Little League practice has this date held" } : { status: "open" },
    );
    // The series was extended to Jun 20 after its sessions were last listed.
    const series = {
      date: "2027-06-06",
      start: "08:00",
      end: "09:00",
      recurrence: { frequency: "weekly" as const, weekday: 0, until: "2027-06-20" },
      occurrences: [{ date: "2027-06-06", availability: { status: "open" as const }, billing: "upcoming" as const }],
    };
    const c = makeCase({ state: "draft", tier: "instant", location, schedule: series });
    const result = transition(c, { type: "book_and_pay", method: "card" }, "applicant", makeCtx());
    expect(result).toEqual({ ok: false, reason: "Sun, Jun 20, 2027: Little League practice has this date held" });
  });

  it("a blackout stops a single event but not a series, which skips that session and pays the next", () => {
    vi.mocked(availability).mockImplementation((_location, window) =>
      window.date === "2027-05-31" ? { status: "blackout", reason: "Memorial Day: all parks are closed to bookings" } : { status: "open" },
    );
    vi.mocked(estimateFees).mockReturnValue({ lines: [], fees: 40, deposit: 0, total: 40, dueNow: 20 } as FeeEstimate);
    const payFees = () => makeTask({ id: "PMT-27-0001:pay_fees", catalogId: "pay_fees" });

    const single = { date: "2027-05-31", start: "08:00", end: "09:00", occurrences: [{ date: "2027-05-31", availability: { status: "open" as const }, billing: "upcoming" as const }] };
    const blocked = transition(makeCase({ state: "draft", tier: "instant", location, schedule: single, tasks: [payFees()] }), { type: "book_and_pay", method: "card" }, "applicant", makeCtx());
    expect(blocked).toEqual({ ok: false, reason: "Memorial Day: all parks are closed to bookings" });

    const series = {
      date: "2027-05-31",
      start: "08:00",
      end: "09:00",
      recurrence: { frequency: "weekly" as const, weekday: 1, until: "2027-06-14" },
      occurrences: [
        { date: "2027-05-31", availability: { status: "blackout" as const }, billing: "skipped" as const },
        { date: "2027-06-07", availability: { status: "open" as const }, billing: "upcoming" as const },
        { date: "2027-06-14", availability: { status: "open" as const }, billing: "upcoming" as const },
      ],
    };
    const booked = transition(makeCase({ state: "draft", tier: "instant", location, schedule: series, tasks: [payFees()] }), { type: "book_and_pay", method: "card" }, "applicant", makeCtx());
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;
    expect(booked.case.schedule?.occurrences.map((o) => o.billing)).toEqual(["skipped", "paid", "upcoming"]);
    expect(booked.case.activity.at(-1)?.text).toContain("Paid $20");
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
    const task = makeTask({ id: "PMT-27-0001:vendor_food_permits", catalogId: "vendor_food_permits", kind: "action" });
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

  it("creates no verify task while the department's own review is open: the review covers the card", () => {
    const card = makeTask({ id: "PMT-27-0001:vendor_list", catalogId: "vendor_list", reviewer: "hl" });
    const review = makeTask({ id: "PMT-27-0001:review:hl", catalogId: "review:hl", owner: "hl", kind: "review" });
    const c = makeCase({ state: "in_review", tasks: [card, review] });
    const result = transition(c, { type: "complete_task", taskId: card.id }, "applicant", makeCtx());
    expect(result.ok && result.case.tasks.filter((t) => t.kind === "review")).toHaveLength(1);
  });

  it("another card's verify task does not stand in for this card's: each one gets its own", () => {
    const card1 = makeTask({ id: "PMT-27-0001:vendor_health_permit:1", catalogId: "vendor_health_permit", reviewer: "hl", status: "submitted" });
    const card2 = makeTask({ id: "PMT-27-0001:vendor_health_permit:2", catalogId: "vendor_health_permit", reviewer: "hl" });
    const verify1 = makeTask({ id: "PMT-27-0001:verify:vendor_health_permit:1", catalogId: "verify:vendor_health_permit:1", owner: "hl", kind: "review" });
    const c = makeCase({ state: "in_review", tasks: [card1, card2, verify1] });
    const result = transition(c, { type: "complete_task", taskId: card2.id }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.tasks.filter((t) => t.kind === "review").map((t) => t.catalogId)).toEqual(["verify:vendor_health_permit:1", "verify:vendor_health_permit:2"]);
  });

  it("a card uploaded after the permit is issued still gets a verify task", () => {
    const card = makeTask({ id: "PMT-27-0001:vendor_health_permit:1", catalogId: "vendor_health_permit", reviewer: "hl" });
    for (const state of ["permitted", "event_day"] as const) {
      const result = transition(makeCase({ state, tasks: [card] }), { type: "complete_task", taskId: card.id }, "applicant", makeCtx());
      expect(result.ok && result.case.tasks.find((t) => t.catalogId === "verify:vendor_health_permit:1")).toMatchObject({ owner: "hl", status: "todo" });
    }
  });

  it("a second upload reopens the card's verify task instead of adding another", () => {
    const card = makeTask({ id: "PMT-27-0001:insurance_certificate", catalogId: "insurance_certificate", reviewer: "hl", status: "changes_requested" });
    const finished = makeTask({ id: "PMT-27-0001:verify:insurance_certificate", catalogId: "verify:insurance_certificate", owner: "hl", kind: "review", status: "done" });
    const c = makeCase({ state: "quote_sent", tasks: [card, finished] });
    const result = transition(c, { type: "complete_task", taskId: card.id }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const verifyTasks = result.case.tasks.filter((t) => t.catalogId === "verify:insurance_certificate");
    expect(verifyTasks).toHaveLength(1);
    expect(verifyTasks[0].status).toBe("todo");
  });

  it("re-uploading verified insurance takes Issue permit back out of the Clerk's queue until it is checked again", () => {
    const insurance = makeTask({ id: "PMT-27-0001:insurance_certificate", catalogId: "insurance_certificate", reviewer: "hl", status: "done" });
    const issue = makeTask({ id: "PMT-27-0001:issue_permit", catalogId: "issue_permit", owner: "clerk", kind: "action", status: "todo" });
    const c = makeCase({ state: "quote_sent", flags: { sentToCommission: false, lateFee: false, signed: true, acceptedComplete: true, amendmentPending: false }, tasks: [insurance, issue] });
    const uploaded = transition(c, { type: "complete_task", taskId: insurance.id, files: [{ name: "coi-v2.pdf", size: 100, type: "application/pdf" }] }, "applicant", makeCtx());
    expect(uploaded.ok).toBe(true);
    if (!uploaded.ok) return;
    expect(uploaded.case.tasks.find((t) => t.id === issue.id)?.status).toBe("locked");

    const verified = transition(uploaded.case, { type: "verify_document", taskId: insurance.id }, "hl", makeCtx());
    expect(verified.ok && verified.case.tasks.find((t) => t.id === issue.id)?.status).toBe("todo");
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

describe("complete_task refuses a card that is finished some other way, and says how", () => {
  // Marking one of these done by hand would skip the payment, the signature, the sign-offs or
  // the submission itself, and leave a case that reads further along than it is.
  const refused = (state: EventCase["state"], card: Parameters<typeof makeTask>[0], overrides: Partial<EventCase> = {}) => {
    const c = makeCase({ state, tier: "reviewed", tasks: [makeTask(card)], ...overrides });
    return { c, result: transition(c, { type: "complete_task", taskId: card.id }, "applicant", makeCtx()) };
  };

  it("Pay fees and deposit: paid with `pay`, never ticked off with $0 paid", () => {
    const { result } = refused("quote_sent", { id: "PMT-27-0001:pay_fees", catalogId: "pay_fees", kind: "payment", payload: { amount: 6530 } });
    expect(result).toEqual({ ok: false, reason: "Pay the fees and deposit to finish this card." });
  });

  it("Pay and book, on an Instant draft: booked with `book_and_pay`", () => {
    const { result } = refused("draft", { id: "PMT-27-0001:pay_fees", catalogId: "pay_fees", kind: "payment", title: "Pay and book" }, { tier: "instant" });
    expect(result).toEqual({ ok: false, reason: "Pay and book to finish this card." });
  });

  it("Final bill or refund: paid with `pay`, never done with the bill still due", () => {
    const { result } = refused("closed", { id: "PMT-27-0001:final_bill_or_refund", catalogId: "final_bill_or_refund", kind: "payment", payload: { amount: 50 } });
    expect(result).toEqual({ ok: false, reason: "Pay the final bill to finish this card." });
  });

  it("Accept conditions and sign: signed with `accept_and_sign`, never done unsigned", () => {
    const { result } = refused("quote_sent", { id: "PMT-27-0001:accept_and_sign", catalogId: "accept_and_sign", kind: "sign_off" });
    expect(result).toEqual({ ok: false, reason: "Accept the conditions and sign to finish this card." });
  });

  it("Neighbor sign-off: finished by the last sign-off, never at 9 of 12", () => {
    const { result } = refused("submitted", { id: "PMT-27-0001:neighbor_signoff", catalogId: "neighbor_signoff", kind: "sign_off", payload: { progress: { done: 9, total: 12 } } });
    expect(result).toEqual({ ok: false, reason: "Collect the neighbor sign-offs to finish this card." });
  });

  it("Submit application: finished by `submit`", () => {
    const { result } = refused("draft", { id: "PMT-27-0001:submit_application", catalogId: "submit_application", kind: "action" });
    expect(result).toEqual({ ok: false, reason: "Submit the application to finish this card." });
  });

  it("Tell us how it went: finished by `submit_feedback`", () => {
    const { result } = refused("closed", { id: "PMT-27-0001:feedback", catalogId: "feedback", kind: "form" });
    expect(result).toEqual({ ok: false, reason: "Send your feedback to finish this card." });
  });

  it("Book again next year: finished by `book_again`", () => {
    const { result } = refused("closed", { id: "PMT-27-0001:book_again", catalogId: "book_again", kind: "action" });
    expect(result).toEqual({ ok: false, reason: "Book again to finish this card." });
  });

  it("Carry your permit: finished by the clock once the day has passed", () => {
    const { result } = refused("event_day", { id: "PMT-27-0001:carry_permit", catalogId: "carry_permit", kind: "action" });
    expect(result).toEqual({ ok: false, reason: "This card is finished for you once the event day has passed." });
  });

  it.each(["pre_application_meeting", "coordination_meeting", "site_walkthrough"])("%s: a meeting is closed by the city once it has been held", (catalogId) => {
    const { result } = refused("permitted", { id: `PMT-27-0001:${catalogId}`, catalogId, kind: "meeting", reviewer: "clerk" });
    expect(result).toEqual({ ok: false, reason: "The city closes this card once the meeting has been held." });
  });

  it("a card with a reviewer's request open on it is answered with `respond_to_request`", () => {
    const request = { from: "hl" as const, message: "Please upload the permit", at: "2027-04-30T09:05", dueDate: "2027-05-05", resolved: false };
    const { result } = refused("needs_info", { id: "PMT-27-0001:vendor_health_permit:1", catalogId: "vendor_health_permit", reviewer: "hl", request });
    expect(result).toEqual({ ok: false, reason: "Respond to the request to finish this card." });
  });

  it("a city task is not the applicant's to complete", () => {
    const { result } = refused("in_review", { id: "PMT-27-0001:review:pws", catalogId: "review:pws", owner: "pws", kind: "review" });
    expect(result).toEqual({ ok: false, reason: "That task belongs to Public Works & Safety." });
  });

  it("a locked card still says what unlocks it, and a finished one that it is done", () => {
    expect(refused("in_review", { id: "PMT-27-0001:pay_fees", catalogId: "pay_fees", kind: "payment", status: "locked" }).result).toEqual({ ok: false, reason: "Unlocks when your quote is ready" });
    expect(refused("permitted", { id: "PMT-27-0001:accept_and_sign", catalogId: "accept_and_sign", kind: "sign_off", status: "done" }).result).toEqual({ ok: false, reason: "This card is already done." });
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

  it("the last sign-off after submitting gives the Clerk its intake check, due from that day", () => {
    const signoff = makeTask({ id: "PMT-27-0001:neighbor_signoff", catalogId: "neighbor_signoff", kind: "sign_off", payload: { progress: { done: 11, total: 12 } } });
    const intake = makeTask({ id: "PMT-27-0001:intake_check", catalogId: "intake_check", owner: "clerk", kind: "review", status: "locked", payload: { awaitingSignoffs: true } });
    const c = makeCase({ state: "submitted", tasks: [signoff, intake] });
    const result = transition(c, { type: "simulate_signoff" }, "neighbor", makeCtx());
    expect(result.ok && result.case.tasks.find((t) => t.id === intake.id)).toMatchObject({ status: "todo", dueDate: "2027-05-06", payload: { awaitingSignoffs: false } });
  });

  it("...unless the Clerk is itself waiting on an answer, when the check stays parked", () => {
    const signoff = makeTask({ id: "PMT-27-0001:neighbor_signoff", catalogId: "neighbor_signoff", kind: "sign_off", payload: { progress: { done: 11, total: 12 } } });
    const intake = makeTask({ id: "PMT-27-0001:intake_check", catalogId: "intake_check", owner: "clerk", kind: "review", status: "locked", payload: { awaitingSignoffs: true } });
    const asked = makeTask({ id: "PMT-27-0001:respond_to_request:1", catalogId: "respond_to_request", kind: "action", reviewer: "clerk", request: { from: "clerk", message: "Which households?", at: "2027-05-01T09:00", dueDate: "2027-05-06", resolved: false } });
    const c = makeCase({ state: "needs_info", tasks: [signoff, intake, asked] });
    const result = transition(c, { type: "simulate_signoff" }, "neighbor", makeCtx());
    expect(result.ok && result.case.tasks.find((t) => t.id === intake.id)).toMatchObject({ status: "locked", payload: { awaitingAnswer: true } });
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

  it("checks the cards themselves, not only the Submit card's lock", () => {
    const submitApp = makeTask({ id: "PMT-27-0001:submit_application", catalogId: "submit_application", status: "todo" });
    const alcohol = makeTask({ id: "PMT-27-0001:alcohol_details", catalogId: "alcohol_details", kind: "form", reviewer: "clerk", status: "todo" });
    const c = makeCase({ state: "draft", tier: "reviewed", tasks: [alcohol, submitApp] });
    expect(transition(c, { type: "submit" }, "applicant", makeCtx())).toEqual({ ok: false, reason: "Unlocks when every card before submitting is done" });
  });

  it("fails inside the tier's lead time, unless the applicant took the late fee", () => {
    const submitApp = makeTask({ id: "PMT-27-0001:submit_application", catalogId: "submit_application", status: "todo" });
    // May 22 is 19 days from May 3; a Reviewed event needs 30.
    const schedule = { date: "2027-05-22", start: "11:00", end: "16:00", occurrences: [{ date: "2027-05-22", availability: { status: "open" as const }, billing: "upcoming" as const }] };
    const c = makeCase({ state: "draft", tier: "reviewed", schedule, tasks: [submitApp] });
    expect(transition(c, { type: "submit" }, "applicant", makeCtx())).toEqual({ ok: false, reason: "Needs 30 days of notice; pick a later date or add the late fee." });
    expect(transition(c, { type: "submit" }, "applicant", makeCtx({ today: "2027-04-22", now: "2027-04-22T09:00" })).ok).toBe(true);
    expect(transition({ ...c, flags: { ...c.flags, lateFee: true } }, { type: "submit" }, "applicant", makeCtx()).ok).toBe(true);
  });

  it("with neighbor sign-offs still out, the intake check waits: locked, with no due date yet", () => {
    const submitApp = makeTask({ id: "PMT-27-0001:submit_application", catalogId: "submit_application", status: "todo" });
    const signoff = makeTask({ id: "PMT-27-0001:neighbor_signoff", catalogId: "neighbor_signoff", kind: "sign_off", payload: { progress: { done: 9, total: 12 } } });
    const c = makeCase({ state: "draft", tier: "reviewed", tasks: [signoff, submitApp] });
    const result = transition(c, { type: "submit" }, "applicant", makeCtx());
    expect(result.ok && result.case.tasks.find((t) => t.catalogId === "intake_check")).toMatchObject({ status: "locked", dueDate: null, payload: { awaitingSignoffs: true } });
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

  it("withdraw after paying the quote refunds everything paid: no fees are owed or kept", () => {
    const c = makeCase({
      state: "quote_sent",
      dateHold: { status: "held", placedOn: "2027-04-19", expiresOn: "2027-05-14" },
      feeLines: [{ id: "f1", dept: "clerk", label: "Application fee", qty: 1, unit: "application", unitPrice: 400, estimate: 400, actual: null, kind: "fee" }],
      payments: [{ id: "p1", at: "2027-04-11T09:05", amount: 400, method: "card", kind: "quote" }],
    });
    const result = transition(c, { type: "withdraw" }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.ending).toBe("withdrawn");
    expect(result.case.payments.at(-1)).toMatchObject({ kind: "refund", amount: -400 });
    expect(result.case.activity.at(-1)?.text).toBe("Withdrew the application. Refunded $400.");
  });

  it("withdraw fails once a permit exists", () => {
    const c = makeCase({ state: "permitted", permit: { issuedOn: "2027-05-01", signature: null } });
    const result = transition(c, { type: "withdraw" }, "applicant", makeCtx());
    expect(result.ok).toBe(false);
  });

  it("cancel on S1's own day refunds $62.50", () => {
    vi.mocked(cancellationRefund).mockReturnValue({ refund: 62.5, kept: 62.5, rule: "10 to 29 days before: 50% of space and permit fees; the application fee is kept" });
    const c = makeCase({
      state: "permitted",
      permit: { issuedOn: "2027-04-20", signature: null },
      dateHold: { status: "held", placedOn: "2027-04-20", expiresOn: null },
      schedule: { date: "2027-05-22", start: "11:00", end: "16:00", occurrences: [{ date: "2027-05-22", availability: { status: "open" }, billing: "paid" }] },
      feeLines: [{ id: "f1", dept: "clerk", label: "Shelter", qty: 5, unit: "hour", unitPrice: 25, estimate: 125, actual: null, kind: "fee" }],
      payments: [{ id: "p1", at: "2027-04-20T09:00", amount: 125, method: "card", kind: "booking" }],
    });
    const result = transition(c, { type: "cancel" }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.ending).toBe("cancelled");
    expect(result.case.dateHold.status).toBe("released");
    expect(result.case.payments.at(-1)).toMatchObject({ kind: "refund", amount: -62.5 });
    expect(result.case.activity.at(-1)?.text).toContain("Refunded $62.50");
    // The banner's reason is a sentence with the amount, not the bare band of the schedule.
    expect(result.case.endingReason).toBe("Cancelled by the applicant. Refunded $62.50 (10 to 29 days before: 50% of space and permit fees; the application fee is kept).");
  });

  it("cancel never refunds more than was paid (a series pays one session at a time)", () => {
    // The schedule works from the fee lines: 13 sessions, $260. Only the first $20 was paid.
    vi.mocked(cancellationRefund).mockReturnValue({ refund: 250, kept: 10, rule: "30 or more days before: full refund minus a $10 processing fee" });
    const c = makeCase({
      state: "permitted",
      permit: { issuedOn: "2027-05-03", signature: null },
      schedule: { date: "2027-06-06", start: "08:00", end: "09:00", occurrences: [{ date: "2027-06-06", availability: { status: "open" }, billing: "paid" }] },
      feeLines: [{ id: "f1", dept: "clerk", label: "Field reservation", qty: 13, unit: "hour", unitPrice: 20, estimate: 260, actual: null, kind: "fee" }],
      payments: [{ id: "p1", at: "2027-05-03T09:00", amount: 20, method: "card", kind: "booking" }],
    });
    const result = transition(c, { type: "cancel" }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.payments.at(-1)).toMatchObject({ kind: "refund", amount: -20 });
  });

  it("cancel with nothing to refund records no payment", () => {
    vi.mocked(cancellationRefund).mockReturnValue({ refund: 0, kept: 125, rule: "Under 10 days: no refund of fees" });
    const c = makeCase({
      state: "permitted",
      permit: { issuedOn: "2027-04-20", signature: null },
      schedule: { date: "2027-05-08", start: "11:00", end: "16:00", occurrences: [{ date: "2027-05-08", availability: { status: "open" }, billing: "paid" }] },
      payments: [{ id: "p1", at: "2027-04-20T09:00", amount: 125, method: "card", kind: "booking" }],
    });
    const result = transition(c, { type: "cancel" }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.payments).toHaveLength(1);
    expect(result.case.activity.at(-1)?.text).toContain("Nothing to refund");
    expect(result.case.endingReason).toBe("Cancelled by the applicant. Nothing refunded (Under 10 days: no refund of fees).");
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

    // Feedback is given once: a second form does not overwrite the first.
    const again = transition(result.case, { type: "submit_feedback", rating: 1, comment: "Changed my mind." }, "applicant", makeCtx());
    expect(again).toEqual({ ok: false, reason: "Feedback is already in. Thank you." });
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

describe("amend: the cards it adds", () => {
  it("are dated from the amendment, so they have been the applicant's since then and not since the booking", () => {
    const reviewedCls: Classification = { ...instantCls, tier: "reviewed", leadTimeDays: 30, summary: "This is a Reviewed event" };
    vi.mocked(classify).mockReturnValue(reviewedCls);
    vi.mocked(requirements).mockReturnValue([makeTask({ id: "PMT-27-0001:sound_details", catalogId: "sound_details", kind: "form", history: [] })]);
    const schedule = { date: "2027-07-22", start: "11:00", end: "16:00", occurrences: [{ date: "2027-07-22", availability: { status: "open" as const }, billing: "paid" as const }] };
    const location = { mode: "inventory" as const, inventoryIds: ["shelter-3"], segmentIds: [], label: "Shelter 3" };
    const c = makeCase({ state: "permitted", createdAt: "2027-04-26T09:00", permit: { issuedOn: "2027-04-26", signature: null }, schedule, location });
    const answers = { eventType: c.eventType, name: c.name, location, schedule, attendance: c.attendance, addOns: { ...c.addOns, amplifiedSound: true } };
    const result = transition(c, { type: "amend", answers }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.tasks).toMatchObject([{ catalogId: "sound_details", tags: ["amendment"], history: [{ at: "2027-05-03T09:00", actor: "applicant", status: "todo" }] }]);
    expect(waitingOn(result.case, "2027-05-03").find((p) => p.party === "applicant")).toMatchObject({ status: "up_now", daysHolding: 0 });
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

  it("applies at once, with no pending flag, when nothing new is required (a smaller crowd, the same tier)", () => {
    vi.mocked(classify).mockReturnValue(instantCls);
    vi.mocked(requirements).mockReturnValue([]);
    const c = makeCase({ state: "permitted", attendance: 40, permit: { issuedOn: "2027-05-01", signature: null } });
    const result = transition(c, { type: "amend", answers: { ...c, attendance: 20 } }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case).toMatchObject({ attendance: 20, flags: { amendmentPending: false } });
  });

  it("applies at once when the amendment lowers the tier (nothing new is required of a reviewer)", () => {
    vi.mocked(classify).mockReturnValue(instantCls);
    vi.mocked(requirements).mockReturnValue([]);
    const c = makeCase({ state: "permitted", tier: "reviewed", permit: { issuedOn: "2027-05-01", signature: null } });
    const result = transition(c, { type: "amend", answers: { ...c, addOns: { ...c.addOns, amplifiedSound: false } } }, "applicant", makeCtx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.case.tier).toBe("instant");
    expect(result.case.flags.amendmentPending).toBe(false);
  });

  it("refuses a second amendment while one is already pending", () => {
    vi.mocked(classify).mockReturnValue({ ...instantCls, tier: "reviewed", summary: "This is a Reviewed event" });
    vi.mocked(requirements).mockReturnValue([makeTask({ id: "PMT-27-0001:sound_details", catalogId: "sound_details", kind: "form", reviewer: "pws" })]);
    const c = makeCase({ state: "permitted", permit: { issuedOn: "2027-05-01", signature: null }, flags: { sentToCommission: false, lateFee: false, signed: false, acceptedComplete: false, amendmentPending: true } });
    const result = transition(c, { type: "amend", answers: c }, "applicant", makeCtx());
    expect(result).toEqual({ ok: false, reason: "An amendment is already pending; wait for the City Clerk's decision." });
  });
});

describe("amend: completing and deciding it", () => {
  function materialCaseAndAnswers() {
    vi.mocked(classify).mockReturnValue({ ...instantCls, tier: "reviewed", summary: "This is a Reviewed event" });
    const soundCard = makeTask({ id: "PMT-27-0001:sound_details", catalogId: "sound_details", kind: "form", reviewer: "pws", history: [] });
    const submitCard = makeTask({ id: "PMT-27-0001:submit_application", catalogId: "submit_application", kind: "action", reviewer: "clerk", status: "locked", unlocksOn: "presubmit_done", history: [] });
    vi.mocked(requirements).mockReturnValue([soundCard, submitCard]);
    vi.mocked(estimateFees).mockReturnValue({
      lines: [
        { id: "f1", dept: "pws", label: "Amplified sound", qty: 1, unit: "event", unitPrice: 40, estimate: 40, actual: null, kind: "fee" },
        { id: "f2", dept: "clerk", label: "Refundable cleanup deposit", qty: 1, unit: "event", unitPrice: 125, estimate: 125, actual: null, kind: "deposit" },
      ],
      fees: 40,
      deposit: 125,
      total: 165,
    } as FeeEstimate);
    const payFees = makeTask({ id: "PMT-27-0001:pay_fees", catalogId: "pay_fees", kind: "payment", status: "done", payload: { amount: 125 } });
    const c = makeCase({
      state: "permitted",
      tier: "instant",
      permit: { issuedOn: "2027-05-01", signature: null },
      schedule: { date: "2027-06-26", start: "14:00", end: "20:00", occurrences: [{ date: "2027-06-26", availability: { status: "open" }, billing: "paid" }] },
      tasks: [payFees],
      payments: [{ id: "PMT-27-0001:pay:1", at: "2027-04-20T09:00", amount: 125, method: "card", kind: "booking" }],
    });
    const answers = { ...c, addOns: { ...c.addOns, amplifiedSound: true } };
    return { c, answers };
  }

  it("locks the resubmit card until the amendment's own cards are in, then the applicant can submit it", () => {
    const { c, answers } = materialCaseAndAnswers();
    const amended = transition(c, { type: "amend", answers }, "applicant", makeCtx());
    expect(amended.ok).toBe(true);
    if (!amended.ok) return;
    expect(amended.case.flags.amendmentPending).toBe(true);
    expect(amended.case.tasks.find((t) => t.catalogId === "submit_application")).toMatchObject({ status: "locked", tags: ["amendment"] });
    expect(transition(amended.case, { type: "submit" }, "applicant", makeCtx())).toMatchObject({ ok: false });

    const withCard = transition(amended.case, { type: "complete_task", taskId: "PMT-27-0001:sound_details", form: { equipment: "One DJ booth" } }, "applicant", makeCtx());
    expect(withCard.ok).toBe(true);
    if (!withCard.ok) return;
    expect(withCard.case.tasks.find((t) => t.catalogId === "submit_application")).toMatchObject({ status: "todo" });

    const submitted = transition(withCard.case, { type: "submit" }, "applicant", makeCtx());
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    expect(submitted.case.tasks.find((t) => t.catalogId === "submit_application")).toMatchObject({ status: "done", tags: ["amendment"] });
    expect(submitted.case.flags.amendmentPending).toBe(true);
    // Submitting a second time, or as the wrong role, goes through the same checks a Draft's does.
    expect(transition(submitted.case, { type: "submit" }, "applicant", makeCtx())).toEqual({ ok: false, reason: "The amendment is already submitted." });
  });

  it("the City Clerk approves a submitted amendment: the pending flag clears and the fee difference reopens 'Pay fees and deposit'", () => {
    const { c, answers } = materialCaseAndAnswers();
    const amended = transition(c, { type: "amend", answers }, "applicant", makeCtx());
    if (!amended.ok) throw new Error("setup");
    const withCard = transition(amended.case, { type: "complete_task", taskId: "PMT-27-0001:sound_details", form: {} }, "applicant", makeCtx());
    if (!withCard.ok) throw new Error("setup");
    const submitted = transition(withCard.case, { type: "submit" }, "applicant", makeCtx());
    if (!submitted.ok) throw new Error("setup");

    // Before it is submitted, the Clerk cannot decide it.
    expect(transition(amended.case, { type: "amend", answers }, "clerk", makeCtx())).toEqual({ ok: false, reason: "The applicant has not submitted the amendment yet." });

    const decided = transition(submitted.case, { type: "amend", answers: submitted.case }, "clerk", makeCtx());
    expect(decided.ok).toBe(true);
    if (!decided.ok) return;
    expect(decided.case.flags.amendmentPending).toBe(false);
    // $165 is now owed and $125 was already paid: the $40 difference is charged through the
    // existing payment card.
    expect(decided.case.tasks.find((t) => t.catalogId === "pay_fees")).toMatchObject({ status: "done", payload: { amount: 165 } });
    expect(decided.case.payments.at(-1)).toMatchObject({ amount: 40, kind: "quote" });
    expect(decided.case.tier).toBe("reviewed");
  });

  it("the City Clerk declines a submitted amendment: the original plan and fees come back, and the amendment's cards are gone", () => {
    const { c, answers } = materialCaseAndAnswers();
    const amended = transition(c, { type: "amend", answers }, "applicant", makeCtx());
    if (!amended.ok) throw new Error("setup");
    const withCard = transition(amended.case, { type: "complete_task", taskId: "PMT-27-0001:sound_details", form: {} }, "applicant", makeCtx());
    if (!withCard.ok) throw new Error("setup");
    const submitted = transition(withCard.case, { type: "submit" }, "applicant", makeCtx());
    if (!submitted.ok) throw new Error("setup");

    const declined = transition(submitted.case, { type: "amend", answers: c }, "clerk", makeCtx());
    expect(declined.ok).toBe(true);
    if (!declined.ok) return;
    expect(declined.case.flags.amendmentPending).toBe(false);
    expect(declined.case.addOns.amplifiedSound).toBe(false);
    expect(declined.case.tasks.map((t) => t.catalogId)).toEqual(["pay_fees"]);
    expect(declined.case.permit).toEqual({ issuedOn: "2027-05-01", signature: null });
  });

  it("refuses the Clerk's decision when the answers match neither the pending plan nor the original one", () => {
    const { c, answers } = materialCaseAndAnswers();
    const amended = transition(c, { type: "amend", answers }, "applicant", makeCtx());
    if (!amended.ok) throw new Error("setup");
    const withCard = transition(amended.case, { type: "complete_task", taskId: "PMT-27-0001:sound_details", form: {} }, "applicant", makeCtx());
    if (!withCard.ok) throw new Error("setup");
    const submitted = transition(withCard.case, { type: "submit" }, "applicant", makeCtx());
    if (!submitted.ok) throw new Error("setup");

    const result = transition(submitted.case, { type: "amend", answers: { ...c, attendance: 999 } }, "clerk", makeCtx());
    expect(result).toEqual({ ok: false, reason: "Approve the amendment as it stands, or decline it back to the original plan." });
  });
});
