/**
 * The rules engine and the state machine wired together, with nothing mocked.
 *
 * lib/rules and lib/state were each built and unit-tested against a mock of the other. This
 * file checks the places where one calls into the other: create_board, book_and_pay,
 * accept_complete, cancel and closeout. It borrows the answers of a few seed scripts but runs
 * none of their histories: the seed replay and the demo paths have their own tests.
 */
import { describe, expect, it } from "vitest";
import { CARD_BY_ID, DEFAULT_CONFIG, availability, classify, routing, type CatalogId, type RulesCtx } from "@/lib/rules";
import { advanceClock, boardColumn, caseTotals, classifyDraft, newCase, queueFor, transition, waitingOn, type Action } from "@/lib/state";
import { F5, S1, S2, S3, S6 } from "@/lib/state/seed/scenarios";
import type { Actor, EventAnswers, EventCase, ISODate } from "@/lib/types";

const FILE = { name: "sample.pdf", size: 240_000, type: "application/pdf" };

function ctx(today: ISODate, cases: EventCase[] = []): RulesCtx {
  return { today, now: `${today}T09:00`, cases, cfg: DEFAULT_CONFIG };
}

function draft(id: string, answers: EventAnswers, createdOn: ISODate): EventCase {
  return classifyDraft(newCase({ id, applicantId: "test", createdAt: `${createdOn}T09:00`, answers }), DEFAULT_CONFIG);
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
