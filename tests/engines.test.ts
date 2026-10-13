/**
 * The rules engine and the state machine wired together, with nothing mocked.
 *
 * lib/rules and lib/state were each built and unit-tested against a mock of the other. This
 * file checks the places where one calls into the other: create_board, book_and_pay,
 * accept_complete, cancel, closeout and amend. Its first half borrows the answers of a few seed
 * scripts and runs none of their histories; its second half starts from seeded cases and takes
 * them further. What the seed itself must hold on the demo date is in tests/seed.test.ts, and
 * the PRD's demo script is in tests/demo-paths.test.ts.
 */
import { describe, expect, it } from "vitest";
import { CARD_BY_ID, DEFAULT_CONFIG, availability, classify, routing, type CatalogId, type RulesCtx } from "@/lib/rules";
import {
  advanceClock,
  boardColumn,
  caseTotals,
  closeoutSettlement,
  leadTimeRisk,
  newCase,
  nextMove,
  queueFor,
  reviewClock,
  syncDraft,
  transition,
  waitingOn,
  type Action,
} from "@/lib/state";
import { replayScripts } from "@/lib/state/seed/replay";
import { F5, S1, S2, S3, S6 } from "@/lib/state/seed/scenarios";
import { SEED_SCRIPTS } from "@/lib/state/seed/scripts";
import type { Actor, EventAnswers, EventCase, ISODate } from "@/lib/types";

const FILE = { name: "sample.pdf", size: 240_000, type: "application/pdf" };

function ctx(today: ISODate, cases: EventCase[] = []): RulesCtx {
  return { today, now: `${today}T09:00`, cases, cfg: DEFAULT_CONFIG };
}

/** A Draft as the store's createDraft makes one: sessions listed, tier and triggers set. */
function draft(id: string, answers: EventAnswers, createdOn: ISODate): EventCase {
  return syncDraft(newCase({ id, applicantId: "test", createdAt: `${createdOn}T09:00`, answers }), ctx(createdOn));
}

/** What the store's updateDraft does with an edit to a Draft's answers. */
function edit(c: EventCase, patch: Partial<EventAnswers>, today: ISODate): EventCase {
  return syncDraft({ ...c, ...patch }, ctx(today, [c]));
}

/** Applies one action and fails the test with the engine's own reason when it is refused. */
function run(c: EventCase, action: Action, actor: Actor, today: ISODate, others: EventCase[] = []): EventCase {
  const result = transition(c, action, actor, ctx(today, [c, ...others]));
  if (!result.ok) throw new Error(`${action.type} was refused: ${result.reason}`);
  return result.case;
}

function reasonFor(c: EventCase, action: Action, actor: Actor, today: ISODate, others: EventCase[] = []): string | null {
  const result = transition(c, action, actor, ctx(today, [c, ...others]));
  return result.ok ? null : result.reason;
}

/** Completes every open card that has to be in before Submit application unlocks. */
function completePreSubmitCards(c: EventCase, today: ISODate): EventCase {
  let next = c;
  for (const task of c.tasks) {
    if (task.owner !== "applicant" || task.status !== "todo") continue;
    if (!CARD_BY_ID[task.catalogId as CatalogId]?.preSubmit) continue;
    const input = task.kind === "document" ? { files: [FILE] } : { form: { complete: true } };
    next = run(next, { type: "complete_task", taskId: task.id, ...input }, "applicant", today);
  }
  return next;
}

function submitted(id: string, answers: EventAnswers, today: ISODate): EventCase {
  let c = run(draft(id, answers, today), { type: "create_board" }, "applicant", today);
  c = completePreSubmitCards(c, today);
  return run(c, { type: "submit" }, "applicant", today);
}

const task = (c: EventCase, suffix: string) => c.tasks.find((t) => t.id === `${c.id}:${suffix}`);
const SHELTER_3_WINDOW = { date: "2027-05-22", start: "11:00", end: "16:00" };

describe("create_board and book_and_pay", () => {
  const board = run(draft("PMT-27-0109", S1.answers, "2027-04-26"), { type: "create_board" }, "applicant", "2027-04-26");

  it("S1's board is the Instant plan from requirements() and estimateFees()", () => {
    expect(board.tier).toBe("instant");
    expect(board.tasks.map((t) => [t.catalogId, t.status])).toEqual([
      ["pay_fees", "todo"],
      ["carry_permit", "locked"],
    ]);
    expect(task(board, "pay_fees")?.payload.amount).toBe(125);
    expect(caseTotals(board)).toMatchObject({ total: 125, paid: 0, due: 125 });
  });

  it("paying books the slot, so the next applicant sees Shelter 3 on May 22 as Booked", () => {
    const booked = run(board, { type: "book_and_pay", method: "card" }, "applicant", "2027-04-26");
    expect(booked.state).toBe("permitted");
    expect(booked.dateHold.status).toBe("held");
    expect(booked.payments).toMatchObject([{ kind: "booking", amount: 125 }]);
    expect(task(booked, "pay_fees")?.status).toBe("done");

    const location = S1.answers.location!;
    expect(availability(location, SHELTER_3_WINDOW, ctx("2027-05-03", [booked]))).toMatchObject({
      status: "booked",
      reason: "Maya Chen's 40th birthday picnic has this date held",
    });

    const rival = run(draft("PMT-27-0143", { ...S1.answers, name: "Another picnic" }, "2027-05-03"), { type: "create_board" }, "applicant", "2027-05-03", [booked]);
    expect(rival.schedule?.occurrences[0].availability.status).toBe("booked");
    expect(reasonFor(rival, { type: "book_and_pay", method: "card" }, "applicant", "2027-05-03", [booked])).toBe(
      "Maya Chen's 40th birthday picnic has this date held",
    );
  });

  it("S2: 13 Sundays at $20, the Jul 11 session Impacted, and the booking pays the first one", () => {
    const series = run(draft("PMT-27-0142", S2.answers, "2027-05-03"), { type: "create_board" }, "applicant", "2027-05-03");
    const sessions = series.schedule!.occurrences;
    expect(sessions).toHaveLength(13);
    expect(sessions.find((o) => o.date === "2027-07-11")?.availability.status).toBe("impacted");
    expect(sessions.every((o) => o.billing === "upcoming")).toBe(true);
    expect(caseTotals(series).total).toBe(260);
    expect(task(series, "pay_fees")?.payload.amount).toBe(20);

    const booked = run(series, { type: "book_and_pay", method: "card" }, "applicant", "2027-05-03");
    expect(booked.payments).toMatchObject([{ kind: "booking", amount: 20 }]);
    expect(booked.schedule!.occurrences.map((o) => o.billing)).toEqual(["paid", ...Array(12).fill("upcoming")]);
  });

  it("a series skips a blackout session: not billed, not held, not an event day", () => {
    // Mondays at Field 3 across Memorial Day, when every park is closed. The schedule arrives
    // with all three sessions "open", as a seed script or the wizard might build it.
    const answers: EventAnswers = {
      ...S2.answers,
      name: "Monday tai chi",
      location: { mode: "inventory", inventoryIds: ["field-3"], segmentIds: [], label: "Field 3, Riverside Park" },
      schedule: {
        date: "2027-05-24",
        start: "07:00",
        end: "08:00",
        recurrence: { frequency: "weekly", weekday: 1, until: "2027-06-07" },
        occurrences: ["2027-05-24", "2027-05-31", "2027-06-07"].map((date) => ({ date, availability: { status: "open" }, billing: "upcoming" })),
      },
    };
    let c = run(draft("PMT-27-0200", answers, "2027-05-03"), { type: "create_board" }, "applicant", "2027-05-03");
    expect(c.schedule!.occurrences.map((o) => o.billing)).toEqual(["upcoming", "skipped", "upcoming"]);
    expect(caseTotals(c).total).toBe(40);

    c = run(c, { type: "book_and_pay", method: "card" }, "applicant", "2027-05-03");
    expect(c.schedule!.occurrences.map((o) => o.billing)).toEqual(["paid", "skipped", "upcoming"]);

    const stateOn = (date: ISODate) => advanceClock([c], "2027-05-03", date, DEFAULT_CONFIG)[0].state;
    expect(stateOn("2027-05-24")).toBe("event_day");
    expect(stateOn("2027-05-31")).toBe("permitted");
    expect(stateOn("2027-06-07")).toBe("event_day");
  });
});

describe("cancel", () => {
  it("cancelling S1 on May 3 refunds $62.50 and frees Shelter 3", () => {
    let s1 = run(draft("PMT-27-0109", S1.answers, "2027-04-26"), { type: "create_board" }, "applicant", "2027-04-26");
    s1 = run(s1, { type: "book_and_pay", method: "card" }, "applicant", "2027-04-26");
    const cancelled = run(s1, { type: "cancel" }, "applicant", "2027-05-03");

    expect(cancelled.ending).toBe("cancelled");
    expect(cancelled.endingReason).toMatch(/^10 to 29 days before/);
    expect(cancelled.payments.at(-1)).toMatchObject({ kind: "refund", amount: -62.5 });
    expect(caseTotals(cancelled)).toMatchObject({ paid: 62.5, due: 0 });
    // The case keeps the state it ended in (Permitted), but it no longer takes the slot.
    expect(cancelled.state).toBe("permitted");
    expect(availability(S1.answers.location!, SHELTER_3_WINDOW, ctx("2027-05-03", [cancelled])).status).toBe("open");
  });
});

describe("accept_complete and confirm_routing", () => {
  const jazz = submitted("PMT-27-0118", S3.answers, "2027-04-16");
  const photos = submitted("PMT-27-0115", F5.answers, "2027-04-17");

  it("the first complete application wins City Hall Plaza on Jun 18", () => {
    const held = run(jazz, { type: "accept_complete" }, "clerk", "2027-04-19", [photos]);
    expect(held.dateHold).toMatchObject({ status: "held", placedOn: "2027-04-19" });
    // The photo shoot runs 5 to 7 pm; the concert starts at 6 but sets up from 4.
    expect(reasonFor(photos, { type: "accept_complete" }, "clerk", "2027-04-19", [held])).toBe("Jazz in the Plaza has this date held");
  });

  it("routing() prefills what confirm_routing takes, and a request parks the asker until the applicant answers", () => {
    let c = run(jazz, { type: "accept_complete" }, "clerk", "2027-04-19");
    const suggested = routing(c, classify(c, DEFAULT_CONFIG));
    expect(suggested.map((r) => r.dept).sort()).toEqual(["hl", "pws"]);
    c = run(c, { type: "confirm_routing", reviewers: suggested.map((r) => ({ dept: r.dept, sections: r.sections, dueDate: "2027-05-03" })) }, "clerk", "2027-04-19");
    expect(c.state).toBe("in_review");
    expect(queueFor([c], "hl", "2027-04-20").map((q) => q.task.catalogId)).toEqual(["review:hl"]);

    c = run(c, { type: "request_info", taskId: `${c.id}:vendor_health_permit:1`, message: "Please upload the current health permit", dueDate: "2027-05-05" }, "hl", "2027-04-30");
    expect(c.state).toBe("needs_info");
    expect(queueFor([c], "hl", "2027-05-03")).toEqual([]);
    const standing = Object.fromEntries(waitingOn(c, "2027-05-03").map((p) => [p.party, p.status]));
    expect(standing).toMatchObject({ applicant: "up_now", hl: "waiting" });

    c = run(c, { type: "respond_to_request", taskId: `${c.id}:vendor_health_permit:1`, files: [FILE] }, "applicant", "2027-05-03");
    expect(c.state).toBe("in_review");
    expect(boardColumn(task(c, "vendor_health_permit:1")!)).toBe("with_city");
    expect(queueFor([c], "hl", "2027-05-03").map((q) => q.task.catalogId)).toEqual(["review:hl"]);
  });
});

describe("confirm_routing and the plan's cards", () => {
  it("routing() suggests every department a card of the plan names, on all 38 seed scripts, so the Clerk is never refused its own prefill", () => {
    for (const script of SEED_SCRIPTS) {
      const createdOn = script.createdAt.slice(0, 10);
      const planned = draft(script.id, script.answers, createdOn);
      if (planned.tier === "instant") continue;
      const c = run(planned, { type: "create_board" }, "applicant", createdOn);
      const suggested = new Set(routing(c, classify(c, DEFAULT_CONFIG)).map((r) => r.dept));
      const named = c.tasks.filter((t) => t.owner === "applicant" && (t.kind === "document" || t.kind === "form") && t.reviewer && t.reviewer !== "clerk").map((t) => t.reviewer);
      for (const dept of named) expect(suggested.has(dept!), `${script.key}: ${dept} is named on a card and not suggested`).toBe(true);
    }
  });

  it("leaving a card's reviewer off the list is refused, with the department and the card", () => {
    const jazz = run(submitted("PMT-27-0118", S3.answers, "2027-04-16"), { type: "accept_complete" }, "clerk", "2027-04-19");
    const suggested = routing(jazz, classify(jazz, DEFAULT_CONFIG)).map((r) => ({ dept: r.dept, sections: r.sections, dueDate: "2027-05-03" }));
    expect(reasonFor(jazz, { type: "confirm_routing", reviewers: suggested.filter((r) => r.dept !== "hl") }, "clerk", "2027-04-19")).toMatch(/^Route Health & Legal too: it checks "/);
    expect(reasonFor(jazz, { type: "confirm_routing", reviewers: suggested }, "clerk", "2027-04-19")).toBeNull();
  });
});

describe("schedule_meeting on the seed (S5, the 5K on Sun, Jul 11)", () => {
  it("a walkthrough is refused on or after the event, before today and on a blackout, for whoever dispatches it", () => {
    const s5 = replayScripts(SEED_SCRIPTS, { until: "2027-05-03" }).find((c) => c.id === "PMT-27-0097")!;
    const walkthrough = `${s5.id}:site_walkthrough`;
    const on = (date: ISODate, actor: Actor = "pws") => reasonFor(s5, { type: "schedule_meeting", taskId: walkthrough, date }, actor, "2027-05-03");
    expect(on("2027-07-20")).toBe("Choose a date before Sun, Jul 11, 2027.");
    expect(on("2027-07-11", "clerk")).toBe("Choose a date before Sun, Jul 11, 2027.");
    expect(on("2027-04-01")).toBe("Choose today or a later date.");
    expect(on("2027-05-31")).toBe("That date is a citywide blackout.");
    expect(on("2027-06-15")).toBeNull();
  });
});

describe("closeout (S6)", () => {
  it("permit to Closed: $9,645 paid, $750 over, $250 of the $1,000 deposit refunded, next year drafted", () => {
    let c = submitted("PMT-27-0031", S6.answers, "2027-02-01");
    expect(c.tier).toBe("special");
    c = run(c, { type: "accept_complete" }, "clerk", "2027-02-03");
    const reviewers = routing(c, classify(c, DEFAULT_CONFIG)).map((r) => ({ dept: r.dept, sections: r.sections, dueDate: "2027-03-17" }));
    expect(reviewers.map((r) => r.dept).sort()).toEqual(["clerk", "hl", "pws"]);
    c = run(c, { type: "confirm_routing", reviewers }, "clerk", "2027-02-03");
    for (const { dept } of reviewers) c = run(c, { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }, dept, "2027-03-10");
    c = run(c, { type: "send_quote", conditions: [], feeLines: [] }, "clerk", "2027-03-12");
    expect(caseTotals(c)).toMatchObject({ fees: 8645, deposit: 1000, total: 9645 });
    expect(task(c, "pay_fees")).toMatchObject({ status: "todo", dueDate: "2027-03-26", payload: { amount: 9645 } });

    c = run(c, { type: "accept_and_sign", signature: "Harold Petrov" }, "applicant", "2027-03-13");
    c = run(c, { type: "pay", amount: 9645, method: "card", kind: "quote" }, "applicant", "2027-03-13");
    expect(task(c, "issue_permit")?.status).toBe("todo");
    c = run(c, { type: "issue_permit" }, "clerk", "2027-03-13");
    expect(c.state).toBe("permitted");
    expect(c.dateHold).toMatchObject({ status: "held", expiresOn: null });
    expect(task(c, "issue_permit")?.status).toBe("done");
    expect(c.tasks.filter((t) => t.catalogId.startsWith("work_order:")).map((t) => t.catalogId)).toEqual([
      "work_order:barricades",
      "work_order:police",
      "work_order:closure",
      "work_order:trash",
      "work_order:power",
    ]);

    // The event is Sat, Apr 24. The day after, the clock opens Closeout.
    [c] = advanceClock([c], "2027-03-13", "2027-05-03", DEFAULT_CONFIG);
    expect(c.state).toBe("closeout");
    expect(c.activity.find((a) => a.text === "The event moved to Closeout.")?.at.slice(0, 10)).toBe("2027-04-25");
    expect(task(c, "carry_permit")?.status).toBe("done");
    expect(task(c, "cleanup_inspection")).toMatchObject({ owner: "pws", status: "todo", dueDate: "2027-05-07" });
    expect(task(c, "log_actual_hours")).toMatchObject({ owner: "pws", status: "todo", dueDate: "2027-05-07" });
    expect(task(c, "reconcile")).toMatchObject({ owner: "clerk", status: "locked", unlocksOn: "hours_logged" });
    expect(["final_bill_or_refund", "feedback", "book_again"].map((id) => task(c, id)?.status)).toEqual(["locked", "locked", "locked"]);
    expect(reasonFor(c, { type: "reconcile_close" }, "clerk", "2027-05-03")).toBe("Waiting on Public Works & Safety to log hours.");

    // Police ran 72 officer-hours against 66 (+$510); cleanup took 4 crew-hours ($240).
    const police = c.feeLines.find((line) => line.label === "Police")!;
    expect(police).toMatchObject({ qty: 66, unitPrice: 85, estimate: 5610 });
    c = run(
      c,
      {
        type: "log_closeout",
        cleanup: "pass",
        actuals: [{ feeLineId: police.id, qty: 72 }],
        extraLines: [{ dept: "pws", label: "Cleanup crew", qty: 4, unit: "worker-hour", unitPrice: DEFAULT_CONFIG.fees.cleanupCrewPerWorkerHour }],
      },
      "pws",
      "2027-05-03",
    );
    expect(task(c, "reconcile")?.status).toBe("todo");

    // Logged once. A second log would put the estimate back over the 72 hours just logged and
    // bill the cleanup crew twice ($480 due instead of $240), so the engine refuses it.
    const loggedTwice = transition(
      c,
      { type: "log_closeout", cleanup: "pass", actuals: [], extraLines: [{ dept: "pws", label: "Cleanup crew", qty: 4, unit: "worker-hour", unitPrice: DEFAULT_CONFIG.fees.cleanupCrewPerWorkerHour }] },
      "pws",
      ctx("2027-05-03", [c]),
    );
    expect(loggedTwice).toEqual({ ok: false, reason: "Hours were logged on Mon, May 3, 2027; the City Clerk is reconciling." });
    expect(c.feeLines.filter((line) => line.label === "Cleanup crew")).toHaveLength(1);
    expect(closeoutSettlement(c)).toEqual({ over: 750, deposit: 1000, fromDeposit: 750, refund: 250, bill: null });

    c = run(c, { type: "reconcile_close" }, "clerk", "2027-05-03");
    expect(c.state).toBe("closed");
    expect(c.closeout).toMatchObject({ balance: 750, refund: 250 });
    expect(c.payments.at(-1)).toMatchObject({ kind: "refund", amount: -250 });
    expect(caseTotals(c)).toMatchObject({ fees: 9395, paid: 9395, due: 0 });
    expect(task(c, "reconcile")?.status).toBe("done");
    expect(task(c, "final_bill_or_refund")).toMatchObject({ status: "done", payload: { amount: -250 } });
    expect([task(c, "feedback")?.status, task(c, "book_again")?.status]).toEqual(["todo", "todo"]);

    // "Book again next year" drafts the same weekday a year on: Sat, Apr 22, 2028.
    const again = transition(c, { type: "book_again" }, "applicant", ctx("2027-05-03", [c]));
    expect(again.ok && again.spawned?.[0]).toMatchObject({ state: "draft", tier: "special", clonedFrom: "PMT-27-0031", schedule: { date: "2028-04-22" } });
  });
});

/* ---------- from here on: the seed scripts, and the Phase 1 review findings ---------- */

const TODAY = "2027-05-03";
const APPROVE: Action = { type: "review_decide", decision: "approve", conditions: [], feeLines: [] };
/** The seed as the store loads it. replayScripts() throws if the engine refuses any step. */
const seed = replayScripts(SEED_SCRIPTS);

function seeded(key: string): EventCase {
  const script = SEED_SCRIPTS.find((s) => s.key === key)!;
  return seed.find((c) => c.id === script.id)!;
}

/** Every other seeded case, for the transitions that look at who holds which date. */
const othersOf = (c: EventCase) => seed.filter((other) => other.id !== c.id);
const standing = (c: EventCase, today: ISODate = TODAY) => Object.fromEntries(waitingOn(c, today).map((p) => [p.party, p.status]));

describe("seeded cases, taken further through both engines", () => {

  it("S4: the next move is the neighbors', not the Clerk's, until all 12 have signed", () => {
    let s4 = seeded("S4");
    expect(standing(s4)).toMatchObject({ applicant: "up_now", clerk: "waiting" });
    expect(waitingOn(s4, TODAY).find((p) => p.party === "clerk")?.note).toBe("Waiting on 3 neighbor sign-offs");
    expect(queueFor(seed, "clerk", TODAY).filter((q) => q.case.id === s4.id)).toEqual([]);
    expect(nextMove(s4, TODAY, "Maple Street block captain")).toBe(
      "Next: Maple Street block captain collects the neighbor sign-offs, then City Clerk checks the application is complete.",
    );

    for (let i = 0; i < 3; i++) s4 = run(s4, { type: "simulate_signoff" }, "neighbor", TODAY, othersOf(s4));
    expect(task(s4, "intake_check")).toMatchObject({ status: "todo", dueDate: "2027-05-06" });
    expect(standing(s4).clerk).toBe("up_now");
    expect(reasonFor(s4, { type: "accept_complete" }, "clerk", TODAY, othersOf(s4))).toBeNull();
  });

  it("a block party with every sign-off in before it is submitted goes straight to the Clerk (F4's history)", () => {
    const f4 = replayScripts(SEED_SCRIPTS, { until: "2027-04-09" }).find((c) => c.id === "PMT-27-0080")!;
    expect(f4.state).toBe("submitted");
    expect(task(f4, "intake_check")).toMatchObject({ status: "todo", dueDate: "2027-04-12" });
  });

  it("B11: paid and waiting on insurance, so Health & Legal is up and the Clerk waits", () => {
    const b11 = seeded("B11");
    expect(standing(b11)).toMatchObject({ applicant: "done_for_now", clerk: "waiting", hl: "up_now" });
    expect(task(b11, "issue_permit")?.status).toBe("locked");
    expect(queueFor(seed, "clerk", TODAY).filter((q) => q.case.id === b11.id)).toEqual([]);

    const verified = run(b11, { type: "verify_document", taskId: `${b11.id}:insurance_certificate` }, "hl", TODAY);
    expect(task(verified, "issue_permit")?.status).toBe("todo");
    expect(standing(verified)).toMatchObject({ clerk: "up_now", hl: "done_for_now" });
  });

  it("plan 6.2: B05 is overdue with Public Works & Safety and short on lead time; B01 has one activity entry", () => {
    const b05 = seeded("B05");
    expect(b05.state).toBe("in_review");
    expect(leadTimeRisk(b05, TODAY, DEFAULT_CONFIG)).toBe("at_risk");
    expect(queueFor(seed, "pws", TODAY).find((q) => q.case.id === b05.id)).toMatchObject({ group: "overdue", task: { catalogId: "review:pws" } });
    expect(seeded("B01").activity).toEqual([{ at: "2027-05-01T10:00", actor: "applicant", text: "Started a draft." }]);
  });

  it("F6: two fields for six hours is $240", () => {
    expect(seeded("F6").payments).toMatchObject([{ kind: "booking", amount: 240 }]);
  });

  it("S5: a decided review's clock stops on the day it was decided", () => {
    // Routed Mar 10, approved Fri, Apr 9: 30 days, whatever the demo date is. The Clerk gave it
    // until Apr 14, which is 35.
    expect(reviewClock(seeded("S5"), "pws", TODAY)).toMatchObject({ day: 30, of: 35, paused: false });
    expect(reviewClock(seeded("S5"), "pws", "2027-06-01")?.day).toBe(30);
  });

  it("F7: closing the Instant exception puts the $95 repair on a final-bill card", () => {
    let f7 = seeded("F7");
    f7 = run(f7, { type: "reconcile_close" }, "clerk", TODAY);
    expect(f7.state).toBe("closed");
    expect(task(f7, "final_bill_or_refund")).toMatchObject({ owner: "applicant", status: "todo", dueDate: "2027-05-17", payload: { amount: 95 } });
    expect(caseTotals(f7).due).toBe(95);

    f7 = run(f7, { type: "pay", amount: 95, method: "card", kind: "final_invoice" }, "applicant", TODAY);
    expect(task(f7, "final_bill_or_refund")?.status).toBe("done");
    expect(caseTotals(f7).due).toBe(0);
  });

  it("B09: an answer to the Clerk's request at intake is accepted with the application", () => {
    let b09 = seeded("B09");
    b09 = run(b09, { type: "respond_to_request", taskId: `${b09.id}:respond_to_request:1`, files: [FILE] }, "applicant", TODAY);
    expect(boardColumn(task(b09, "respond_to_request:1")!)).toBe("with_city");
    b09 = run(b09, { type: "accept_complete" }, "clerk", TODAY, othersOf(b09));
    expect(task(b09, "respond_to_request:1")?.status).toBe("done");
  });
});

describe("a Reviewed series (F2): quote, verification and permit", () => {
  const quoted = () => {
    let f2 = seeded("F2");
    f2 = run(f2, APPROVE, "pws", TODAY);
    f2 = run(f2, APPROVE, "hl", TODAY);
    return run(f2, { type: "send_quote", conditions: [], feeLines: [] }, "clerk", TODAY);
  };

  it("the quote asks for the one-off lines and the first Saturday; the rest is billed on schedule", () => {
    let f2 = quoted();
    expect(caseTotals(f2).total).toBe(5320);
    // Application $50, 12 vendors $900, 12 tent inspections $720, deposit $250, and one $200 Saturday.
    expect(task(f2, "pay_fees")?.payload.amount).toBe(2120);

    f2 = run(f2, { type: "accept_and_sign", signature: "Riverside Farmers Market" }, "applicant", TODAY);
    f2 = run(f2, { type: "pay", amount: 2120, method: "card", kind: "quote" }, "applicant", TODAY);
    expect(task(f2, "pay_fees")?.status).toBe("done");
    expect(f2.schedule!.occurrences.map((o) => o.billing)).toEqual(["paid", ...Array(16).fill("upcoming")]);
    expect(task(f2, "issue_permit")?.status).toBe("todo");

    f2 = run(f2, { type: "issue_permit" }, "clerk", TODAY);
    expect(f2.state).toBe("permitted");
    expect(caseTotals(f2)).toMatchObject({ paid: 2120, due: 3200 });
  });

  it("an unpaid quote still loses its hold, and a paid first session keeps it", () => {
    const unpaid = advanceClock([quoted()], TODAY, "2027-05-18", DEFAULT_CONFIG)[0];
    expect(unpaid.ending).toBe("hold_expired");

    const paid = run(quoted(), { type: "pay", amount: 2120, method: "card", kind: "quote" }, "applicant", TODAY);
    expect(advanceClock([paid], TODAY, "2027-05-18", DEFAULT_CONFIG)[0].ending).toBeNull();
  });

  it("once Health & Legal has decided, every vendor permit uploaded gets its own check, before and after the permit", () => {
    let f2 = run(seeded("F2"), APPROVE, "hl", TODAY);
    const upload = (c: EventCase, n: number) => run(c, { type: "complete_task", taskId: `${c.id}:vendor_health_permit:${n}`, files: [FILE] }, "applicant", TODAY);
    const hlQueue = (c: EventCase) => queueFor([c], "hl", TODAY).map((q) => q.task.catalogId);

    f2 = upload(upload(f2, 1), 2);
    expect(hlQueue(f2)).toEqual(["verify:vendor_health_permit:1", "verify:vendor_health_permit:2"]);
    // A second upload to the same card does not add a second check.
    f2 = run(f2, { type: "reject_document", taskId: `${f2.id}:vendor_health_permit:2`, reason: "This permit expired in March" }, "hl", TODAY);
    f2 = upload(f2, 2);
    expect(hlQueue(f2)).toEqual(["verify:vendor_health_permit:1", "verify:vendor_health_permit:2"]);
    expect(f2.tasks.filter((t) => t.catalogId === "verify:vendor_health_permit:2")).toHaveLength(1);
    f2 = run(f2, { type: "verify_document", taskId: `${f2.id}:vendor_health_permit:1` }, "hl", TODAY);
    f2 = run(f2, { type: "verify_document", taskId: `${f2.id}:vendor_health_permit:2` }, "hl", TODAY);
    expect(hlQueue(f2)).toEqual([]);

    f2 = run(f2, APPROVE, "pws", TODAY);
    f2 = run(f2, { type: "send_quote", conditions: [], feeLines: [] }, "clerk", TODAY);
    f2 = run(f2, { type: "accept_and_sign", signature: "Riverside Farmers Market" }, "applicant", TODAY);
    f2 = run(f2, { type: "pay", amount: 2120, method: "card", kind: "quote" }, "applicant", TODAY);
    f2 = run(f2, { type: "issue_permit" }, "clerk", TODAY);
    // These cards are due 14 days before the event, so most arrive after the permit.
    f2 = upload(f2, 3);
    expect(boardColumn(task(f2, "vendor_health_permit:3")!)).toBe("with_city");
    expect(hlQueue(f2)).toEqual(["verify:vendor_health_permit:3"]);
  });
});

describe("the date gate's lead time", () => {
  const reviewedPicnic: EventAnswers = { ...S1.answers, name: "Picnic with a DJ", addOns: { ...S1.answers.addOns, amplifiedSound: true } };
  const NOTICE_30 = "Needs 30 days of notice; pick a later date or add the late fee.";

  it("an Instant booking nine days out is refused; ten days out, or with the late fee, it goes through", () => {
    // Shelter 3 on Wed, May 12 is nine days from May 3. Instant needs ten.
    const answers: EventAnswers = { ...S1.answers, name: "Picnic at short notice", schedule: { ...S1.answers.schedule!, date: "2027-05-12", occurrences: [] } };
    const c = draft("PMT-27-0150", answers, "2027-05-02");
    expect(reasonFor(c, { type: "book_and_pay", method: "card" }, "applicant", TODAY)).toBe("Needs 10 days of notice; pick a later date or add the late fee.");
    expect(reasonFor(c, { type: "book_and_pay", method: "card" }, "applicant", "2027-05-02")).toBeNull();

    const late = run({ ...c, flags: { ...c.flags, lateFee: true } }, { type: "book_and_pay", method: "card" }, "applicant", TODAY);
    expect(late.feeLines.map((line) => [line.label, line.estimate])).toEqual([
      ["Shelter reservation", 125],
      ["Late fee", 31.25],
    ]);
    expect(late.payments).toMatchObject([{ kind: "booking", amount: 156.25 }]);
  });

  it("S1 with a DJ on May 3 is 19 days out of 30: Submit is refused until the applicant takes the late fee", () => {
    let c = run(draft("PMT-27-0151", reviewedPicnic, TODAY), { type: "create_board" }, "applicant", TODAY);
    c = completePreSubmitCards(c, TODAY);
    expect(reasonFor(c, { type: "submit" }, "applicant", TODAY)).toBe(NOTICE_30);

    // The applicant picks "pay a late fee" at the gate; the application then carries its line.
    c = run({ ...c, flags: { ...c.flags, lateFee: true } }, { type: "submit" }, "applicant", TODAY);
    expect(c.state).toBe("submitted");
    expect(c.feeLines.find((line) => line.kind === "late_fee")).toMatchObject({ label: "Late fee", estimate: 53.75 });
    expect(caseTotals(c).total).toBe(518.75);
  });

  it("the late fee is charged only while the date is inside the lead time", () => {
    const later: EventAnswers = { ...reviewedPicnic, schedule: { ...S1.answers.schedule!, date: "2027-06-19", occurrences: [] } };
    const flagged = { ...draft("PMT-27-0152", later, TODAY), flags: { sentToCommission: false, lateFee: true, signed: false, acceptedComplete: false, amendmentPending: false } };
    const board = run(flagged, { type: "create_board" }, "applicant", TODAY);
    expect(board.feeLines.some((line) => line.kind === "late_fee")).toBe(false);
  });
});

describe("amend: Maya adds a DJ to her permitted picnic on May 3 (demo path 7)", () => {
  const withDj: EventAnswers = { ...S1.answers, addOns: { ...S1.answers.addOns, amplifiedSound: true } };
  const cards = (c: EventCase) => c.tasks.map((t) => [t.catalogId, t.status, t.tags.join()]);

  it("the date gate runs again: 19 days left of the 30 a Reviewed event needs, so the amendment waits for a fix", () => {
    const s1 = seeded("S1");
    expect(reasonFor(s1, { type: "amend", answers: withDj }, "applicant", TODAY, othersOf(s1))).toBe("Needs 30 days of notice; pick a later date or add the late fee.");
  });

  it("with the late fee it goes through: Reviewed, new cards tagged, the new plan's fees, and the permit as it was", () => {
    const s1 = seeded("S1");
    const amended = run(s1, { type: "amend", answers: withDj, lateFee: true }, "applicant", TODAY, othersOf(s1));

    expect(amended).toMatchObject({ tier: "reviewed", state: "permitted", ending: null, permit: s1.permit, dateHold: s1.dateHold });
    expect(amended.flags).toMatchObject({ amendmentPending: true, lateFee: true });
    expect(amended.triggers.map((t) => t.id)).toEqual(["amplified_sound"]);
    expect(cards(amended)).toEqual([
      ["pay_fees", "done", ""],
      ["carry_permit", "locked", ""],
      ["insurance_certificate", "todo", "amendment"],
      ["sound_details", "todo", "amendment"],
      ["submit_application", "locked", "amendment"],
      ["accept_and_sign", "locked", "amendment"],
    ]);
    expect(amended.feeLines.map((line) => [line.label, line.estimate])).toEqual([
      ["Shelter reservation", 125],
      ["Amplified sound", 40],
      ["Application fee", 50],
      ["Refundable cleanup deposit", 250],
      ["Late fee", 53.75],
    ]);
    expect(new Set(amended.feeLines.map((line) => line.id)).size).toBe(5);
    // What she paid for the original plan stays paid; the rest comes with the amendment's quote.
    expect(caseTotals(amended)).toMatchObject({ total: 518.75, paid: 125, due: 393.75 });
    expect(amended.activity.at(-1)?.text).toBe("Amended the plan: This is a Reviewed event: about 3 weeks, $465 estimated. Late fee: $53.75.");
    // The slot is still hers.
    expect(availability(S1.answers.location!, SHELTER_3_WINDOW, ctx(TODAY, [amended])).status).toBe("booked");
  });

  it("an amendment that neither raises the tier nor moves the date needs no notice and no late fee", () => {
    // A week before the picnic, five more guests: still Instant, still May 22.
    const s1 = seeded("S1");
    const amended = run(s1, { type: "amend", answers: { ...S1.answers, attendance: 50 }, lateFee: true }, "applicant", "2027-05-15", othersOf(s1));
    expect(amended).toMatchObject({ tier: "instant", attendance: 50, state: "permitted" });
    expect(amended.feeLines.map((line) => line.label)).toEqual(["Shelter reservation"]);
    expect(cards(amended)).toEqual(cards(s1));
  });

  it("moving to a slot another case holds is refused with that case's name", () => {
    // Shelter 1 on Tue, May 25 is the church potluck's, held since its application was accepted.
    const s1 = seeded("S1");
    const moved: EventAnswers = { ...S1.answers, location: seeded("B07").location, schedule: { ...S1.answers.schedule!, date: "2027-05-25", occurrences: [] } };
    expect(reasonFor(s1, { type: "amend", answers: moved }, "applicant", TODAY, othersOf(s1))).toBe("East End Baptist Church fellowship potluck has this date held");
  });

  it("takes the answers only: a stale copy of the record cannot roll its history back", () => {
    const s1 = seeded("S1");
    const stale = { ...s1, state: "draft", payments: [], permit: null, tasks: [], attendance: 50 } as EventCase;
    const amended = run(s1, { type: "amend", answers: stale }, "applicant", TODAY, othersOf(s1));
    expect(amended).toMatchObject({ attendance: 50, state: "permitted", permit: s1.permit, payments: s1.payments });
    expect(amended.tasks.map((t) => t.id)).toEqual(s1.tasks.map((t) => t.id));
  });

  it("keeps the lines a reviewer added, and lists the sessions of a new schedule itself", () => {
    // The farmers market, with a fire-watch line from Public Works & Safety, ends a month early.
    let f2 = seeded("F2");
    f2 = run(f2, { type: "review_decide", decision: "approve", conditions: [], feeLines: [{ dept: "pws", label: "Fire watch", qty: 2, unit: "hour", unitPrice: 60 }] }, "pws", TODAY);
    const shorter: EventAnswers = { ...f2, schedule: { ...f2.schedule!, recurrence: { ...f2.schedule!.recurrence!, until: "2027-08-28" }, occurrences: [] } };
    const amended = run(f2, { type: "amend", answers: shorter }, "applicant", TODAY, othersOf(f2));

    expect(amended.schedule!.occurrences).toHaveLength(13);
    expect(amended.feeLines.map((line) => [line.label, line.estimate])).toEqual([
      ["Great Lawn reservation", 2600],
      ["Application fee", 50],
      ["Food or vendor permit", 900],
      ["Structure fire inspection", 720],
      ["Refundable cleanup deposit", 250],
      ["Fire watch", 120],
    ]);
    expect(amended.state).toBe("in_review");
  });
});

describe("a board built before the last edit", () => {
  // Shelter 3 on Sat, Jun 19: far enough out for a Reviewed event.
  const withSound: EventAnswers = {
    ...S1.answers,
    name: "Picnic with a DJ",
    schedule: { ...S1.answers.schedule!, date: "2027-06-19", occurrences: [] },
    addOns: { ...S1.answers.addOns, amplifiedSound: true },
  };

  it("dropping the add-on that made it Reviewed books as Instant, with Instant cards and fees only", () => {
    let c = run(draft("PMT-27-0160", withSound, TODAY), { type: "create_board" }, "applicant", TODAY);
    expect(c.tier).toBe("reviewed");
    expect(caseTotals(c).total).toBe(465);

    c = edit(c, { addOns: { ...c.addOns, amplifiedSound: false } }, TODAY);
    expect(c.tier).toBe("instant");
    c = run(c, { type: "book_and_pay", method: "card" }, "applicant", TODAY);
    expect(c.tasks.map((t) => [t.catalogId, t.status])).toEqual([
      ["pay_fees", "done"],
      ["carry_permit", "locked"],
    ]);
    expect(c.feeLines.map((line) => line.label)).toEqual(["Shelter reservation"]);
    expect(caseTotals(c)).toMatchObject({ total: 125, paid: 125, due: 0 });
  });

  it("adding alcohol after every card is in re-locks Submit until the new card is done", () => {
    let c = run(draft("PMT-27-0161", withSound, TODAY), { type: "create_board" }, "applicant", TODAY);
    c = completePreSubmitCards(c, TODAY);
    expect(task(c, "submit_application")?.status).toBe("todo");

    c = edit(c, { addOns: { ...c.addOns, alcohol: true } }, TODAY);
    c = run(c, { type: "create_board" }, "applicant", TODAY);
    expect(task(c, "alcohol_details")?.status).toBe("todo");
    expect(task(c, "insurance_certificate")?.status).toBe("submitted");
    expect(task(c, "submit_application")?.status).toBe("locked");
    expect(reasonFor(c, { type: "submit" }, "applicant", TODAY)).toBe("Unlocks when every card before submitting is done");

    c = completePreSubmitCards(c, TODAY);
    expect(task(c, "submit_application")?.status).toBe("todo");
    expect(reasonFor(c, { type: "submit" }, "applicant", TODAY)).toBeNull();
  });

  it("a vendor renamed after its permit was uploaded: the card keeps the file and takes the new name, in its title and its payload", () => {
    const withVendor: EventAnswers = { ...withSound, addOns: { ...withSound.addOns, foodVending: { vendors: 1, vendorNames: ["Old Name Tacos"] } } };
    let c = run(draft("PMT-27-0163", withVendor, TODAY), { type: "create_board" }, "applicant", TODAY);
    expect(task(c, "vendor_health_permit:1")).toMatchObject({ title: "Health permit: Old Name Tacos", payload: { vendorName: "Old Name Tacos" } });
    c = run(c, { type: "complete_task", taskId: `${c.id}:vendor_health_permit:1`, files: [FILE] }, "applicant", TODAY);
    expect(task(c, "vendor_health_permit:1")?.payload).toMatchObject({ vendorName: "Old Name Tacos", files: [FILE] });

    c = edit(c, { addOns: { ...c.addOns, foodVending: { vendors: 1, vendorNames: ["New Name Tacos"] } } }, TODAY);
    c = run(c, { type: "create_board" }, "applicant", TODAY);
    expect(task(c, "vendor_health_permit:1")).toMatchObject({ title: "Health permit: New Name Tacos", status: "submitted", payload: { vendorName: "New Name Tacos", files: [FILE] } });
  });

  it("the payment card follows the plan when the tier changes after the board exists", () => {
    const instant: EventAnswers = { ...withSound, addOns: S1.answers.addOns };
    let c = run(draft("PMT-27-0162", instant, TODAY), { type: "create_board" }, "applicant", TODAY);
    expect(task(c, "pay_fees")).toMatchObject({ title: "Pay and book", status: "todo", payload: { amount: 125 } });

    c = edit(c, { addOns: { ...c.addOns, amplifiedSound: true } }, TODAY);
    c = run(c, { type: "create_board" }, "applicant", TODAY);
    expect(task(c, "pay_fees")).toMatchObject({ title: "Pay fees and deposit", status: "locked", unlocksOn: "quote_sent", payload: { amount: 465 } });
  });
});
