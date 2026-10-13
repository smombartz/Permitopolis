/**
 * Amendment against the real rules and the real seed (PRD, "Amend"): what takes effect at once
 * and what it settles, what a pending amendment leaves alone, and what the Clerk's decision does
 * before and after the permit. Demo path 7 itself (Maya adds a DJ, start to finish) is in
 * tests/demo-paths.test.ts; ./applicant.test.ts has the transitions one at a time.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, DEFAULT_DEMO_TODAY, type RulesCtx } from "@/lib/rules";
import type { Actor, EventCase } from "@/lib/types";
import type { Action } from "../actions";
import { amendmentBalance, amendmentPaymentDue, amendmentStage, pendingAmendment, permittedPlan } from "../amendment";
import { availableActions } from "../availableActions";
import { advanceClock } from "../clock";
import { quoteBalance } from "../core";
import { buildSeed } from "../seed";
import { caseTotals, queueFor, refundIfCancelled } from "../selectors";
import { transition } from "../transition";
import { waitingOn } from "../waitingOn";

const TODAY = DEFAULT_DEMO_TODAY;
const CFG = DEFAULT_CONFIG;
const S1 = "PMT-27-0109"; // Maya Chen's picnic: Instant, permitted, $125 paid, Shelter 3, May 22, 11 am to 4 pm
const S2 = "PMT-27-0142"; // Sunrise Yoga Club: an Instant series, a Draft until it is booked
const S3 = "PMT-27-0118"; // Jazz in the Plaza: Reviewed, in review (Needs info), nothing paid yet
const ULTRA = "PMT-27-0030"; // Four Bridges Ultra: Special, permitted, $8,700 paid, three open work orders

const seed = buildSeed();
const find = (id: string) => seed.find((c) => c.id === id)!;
const ctxFor = (c: EventCase): RulesCtx => ({ today: TODAY, now: `${TODAY}T09:00`, cases: seed.map((other) => (other.id === c.id ? c : other)), cfg: CFG });

function run(c: EventCase, action: Action, actor: Actor): EventCase {
  const result = transition(c, action, actor, ctxFor(c));
  if (!result.ok) throw new Error(`${action.type} as ${actor} was refused: ${result.reason}`);
  return result.case;
}
const refusal = (c: EventCase, action: Action, actor: Actor) => {
  const result = transition(c, action, actor, ctxFor(c));
  return result.ok ? null : result.reason;
};
const card = (c: EventCase, suffix: string) => c.tasks.find((t) => t.id === `${c.id}:${suffix}`);
const up = (c: EventCase) => waitingOn(c, TODAY).filter((p) => p.status === "up_now").map((p) => p.party);
const workOrders = (c: EventCase) => c.tasks.filter((t) => t.catalogId.startsWith("work_order:")).map((t) => [t.catalogId, t.status]);

describe("a change that adds no card takes effect at once, and what it costs is settled", () => {
  it("two more hours at the shelter: $50 more, and the payment card opens again for it", () => {
    const s1 = find(S1);
    const longer = run(s1, { type: "amend", answers: { ...s1, schedule: { ...s1.schedule!, end: "18:00" } } }, "applicant");
    expect(longer.flags.amendmentPending).toBe(false);
    expect(amendmentStage(longer)).toBeNull();
    expect(longer.schedule).toMatchObject({ start: "11:00", end: "18:00" });
    expect(caseTotals(longer)).toMatchObject({ total: 175, paid: 125, due: 50 });
    // Nothing is charged for her: the card she paid with on the board is open again, for the difference.
    expect(longer.payments).toEqual(s1.payments);
    expect(card(longer, "pay_fees")).toMatchObject({ status: "todo", payload: { amount: 50 } });
    expect(amendmentPaymentDue(longer, CFG)).toBe(50);
    expect(up(longer)).toEqual(["applicant"]);
    expect(availableActions(longer, "applicant", ctxFor(longer)).map((a) => [a.type, a.label, a.enabled])).toEqual([
      ["pay", "Pay the difference", true],
      ["cancel", "Cancel", true],
      ["amend", "Amend", true],
    ]);
    // The Clerk can take it at the counter instead.
    expect(availableActions(longer, "clerk", ctxFor(longer)).find((a) => a.type === "pay")).toMatchObject({ label: "Record an in-person payment", enabled: true });

    const paid = run(longer, { type: "pay", amount: 50, method: "card", kind: "quote" }, "applicant");
    expect(card(paid, "pay_fees")).toMatchObject({ status: "done", payload: { amount: 175 } });
    expect(caseTotals(paid)).toMatchObject({ total: 175, paid: 175, due: 0 });
    expect(up(paid)).toEqual([]);
    expect(refusal(paid, { type: "pay", amount: 1, method: "card", kind: "quote" }, "applicant")).toBe("No quote to pay.");
  });

  it("two hours fewer: the $50 goes back on the spot", () => {
    const s1 = find(S1);
    const shorter = run(s1, { type: "amend", answers: { ...s1, schedule: { ...s1.schedule!, end: "14:00" } } }, "applicant");
    expect(shorter.flags.amendmentPending).toBe(false);
    expect(shorter.payments.at(-1)).toMatchObject({ amount: -50, kind: "refund", method: "card" });
    expect(caseTotals(shorter)).toMatchObject({ total: 75, paid: 75, due: 0 });
    expect(card(shorter, "pay_fees")).toMatchObject({ status: "done", payload: { amount: 75 } });
    expect(up(shorter)).toEqual([]);
  });

  it("a permitted event's work orders follow the plan: trash service added, police dropped and refunded", () => {
    const ultra = find(ULTRA);
    expect(workOrders(ultra)).toEqual([
      ["work_order:barricades", "todo"],
      ["work_order:police", "todo"],
      ["work_order:closure", "todo"],
    ]);
    const services = ultra.addOns.cityServices!;
    const amended = run(ultra, { type: "amend", answers: { ...ultra, addOns: { ...ultra.addOns, cityServices: { ...services, trash: true, policeOfficers: 0, policeHours: 0 } } } }, "applicant");
    expect(amended.flags.amendmentPending).toBe(false);
    expect(workOrders(amended)).toEqual([
      ["work_order:barricades", "todo"],
      ["work_order:closure", "todo"],
      ["work_order:trash", "todo"],
    ]);
    expect(card(amended, "work_order:trash")).toMatchObject({ owner: "pws", title: "Arrange trash service", dueDate: "2027-08-12" });
    // Public Works & Safety's queue has the new one and not the one that was dropped.
    expect(queueFor([amended], "pws", TODAY).map((row) => row.task.catalogId)).toEqual(["work_order:barricades", "work_order:closure", "work_order:trash"]);
    expect(amended.payments.at(-1)).toMatchObject({ amount: -2040, kind: "refund" });
    expect(caseTotals(amended)).toMatchObject({ total: 6660, paid: 6660, due: 0 });
  });

  it("a work order already done stays on the record when the plan drops its service", () => {
    const ultra = find(ULTRA);
    const delivered = run(ultra, { type: "complete_city_task", taskId: `${ULTRA}:work_order:police` }, "pws");
    const services = ultra.addOns.cityServices!;
    const amended = run(delivered, { type: "amend", answers: { ...delivered, addOns: { ...delivered.addOns, cityServices: { ...services, policeOfficers: 0, policeHours: 0 } } } }, "applicant");
    expect(workOrders(amended)).toContainEqual(["work_order:police", "done"]);
  });

  it("a series amended with no change in price owes nothing: its later sessions are billed on their own day, as before", () => {
    const booked = run(find(S2), { type: "book_and_pay", method: "card" }, "applicant");
    const amended = run(booked, { type: "amend", answers: { ...booked, attendance: 25 } }, "applicant");
    expect(amended).toMatchObject({ attendance: 25, flags: { amendmentPending: false } });
    expect(amendmentBalance(amended, CFG)).toBe(0);
    expect(amended.payments).toEqual(booked.payments);
    expect(card(amended, "pay_fees")?.status).toBe("done");
    expect(caseTotals(amended)).toMatchObject({ total: 260, paid: 20, due: 240 });
  });
});

describe("a change at Quote sent that adds no card brings the quote's payment card in step", () => {
  const S5 = "PMT-27-0097"; // Riverfront Summer 5K: Quote sent, $6,530, nothing paid

  it("S5 drops its amplified sound: the fee lines, the board's payment card and what checkout takes are all $6,490", () => {
    const s5 = find(S5);
    expect(s5).toMatchObject({ state: "quote_sent", permit: null });
    expect(card(s5, "pay_fees")).toMatchObject({ status: "todo", payload: { amount: 6530 } });

    const quieter = run(s5, { type: "amend", answers: { ...s5, addOns: { ...s5.addOns, amplifiedSound: false } } }, "applicant");
    expect(quieter.flags.amendmentPending).toBe(false);
    expect(caseTotals(quieter)).toMatchObject({ total: 6490, paid: 0, due: 6490 });
    expect(quoteBalance(quieter, CFG)).toBe(6490);
    // The card on the board says what the quote now asks for, not the figure it was sent with.
    expect(card(quieter, "pay_fees")).toMatchObject({ status: "todo", payload: { amount: 6490 } });
    expect(refusal(quieter, { type: "pay", amount: 6490, method: "card", kind: "quote" }, "applicant")).toBeNull();
  });

  it("a change that adds a card is pending, and the card still asks what checkout asks; a decline puts the quote's own figure back", () => {
    const s5 = find(S5);
    expect(s5.addOns.tentsStages).toBeNull();
    const withTent = run(s5, { type: "amend", answers: { ...s5, addOns: { ...s5.addOns, tentsStages: { count: 1 } } } }, "applicant");
    expect(withTent.flags.amendmentPending).toBe(true);
    const asked = quoteBalance(withTent, CFG);
    expect(asked).toBeGreaterThan(6530);
    expect(card(withTent, "pay_fees")).toMatchObject({ status: "todo", payload: { amount: asked } });

    let c = run(withTent, { type: "complete_task", taskId: `${S5}:structure_specs`, files: [{ name: "tent.pdf", size: 100_000, type: "application/pdf" }] }, "applicant");
    c = run(c, { type: "submit" }, "applicant");
    const declined = run(c, { type: "decide_amendment", decision: "decline", reason: "No tents on the route." }, "clerk");
    expect(declined.feeLines).toEqual(s5.feeLines);
    expect(card(declined, "pay_fees")).toMatchObject({ status: "todo", payload: { amount: 6530 } });
  });

  it("a quote part paid: the card asks for what is left of the new figure", () => {
    const part = run(find(S5), { type: "pay", amount: 1000, method: "in_person", kind: "quote" }, "clerk");
    expect(card(part, "pay_fees")).toMatchObject({ status: "todo", payload: { amount: 5530 } });
    const quieter = run(part, { type: "amend", answers: { ...part, addOns: { ...part.addOns, amplifiedSound: false } } }, "applicant");
    expect(card(quieter, "pay_fees")).toMatchObject({ status: "todo", payload: { amount: 5490 } });
  });
});

describe("a series amended after a session is paid keeps that session paid", () => {
  it("an hour longer, from a wizard that rebuilt the schedule with no session list: the first Sunday stays paid and owes its own difference, nothing is refunded", () => {
    const booked = run(find(S2), { type: "book_and_pay", method: "card" }, "applicant");
    expect(booked.schedule?.occurrences.map((o) => o.billing).slice(0, 2)).toEqual(["paid", "upcoming"]);
    // The wizard's When step empties the list whenever the hours or the date are edited.
    const longer = run(booked, { type: "amend", answers: { ...booked, schedule: { ...booked.schedule!, end: "10:00", occurrences: [] } } }, "applicant");
    expect(longer.schedule?.occurrences).toHaveLength(13);
    expect(longer.schedule?.occurrences.map((o) => o.billing).slice(0, 2)).toEqual(["paid", "upcoming"]);
    // 13 sessions at $40 now. The 12 to come are billed on their day; the one already paid owes its other $20.
    expect(caseTotals(longer)).toMatchObject({ total: 520, paid: 20 });
    expect(longer.payments).toEqual(booked.payments);
    expect(amendmentBalance(longer, CFG)).toBe(20);
    expect(card(longer, "pay_fees")).toMatchObject({ status: "todo", payload: { amount: 20 } });
  });
});

describe("a pending amendment leaves the permit on the plan it was issued for", () => {
  const s1 = find(S1);
  const withDjOnALaterDay = { ...s1, addOns: { ...s1.addOns, amplifiedSound: true }, schedule: { ...s1.schedule!, date: "2027-06-12", occurrences: [] } };

  it("the record takes the new answers; permittedPlan() still reads the original ones", () => {
    const pending = run(s1, { type: "amend", answers: withDjOnALaterDay }, "applicant");
    expect(pending).toMatchObject({ tier: "reviewed", flags: { amendmentPending: true }, schedule: { date: "2027-06-12" }, addOns: { amplifiedSound: true } });
    expect(amendmentStage(pending)).toBe("proposed");

    const permitted = permittedPlan(pending);
    expect(permitted).toMatchObject({ tier: "instant", triggers: [], schedule: s1.schedule, addOns: s1.addOns, location: s1.location, name: s1.name });
    // Everything that is not an answer is the record's own: its state, its permit, its cards.
    expect(permitted).toMatchObject({ state: "permitted", permit: s1.permit, tasks: pending.tasks, payments: s1.payments });
    expect(pendingAmendment(pending)).toMatchObject({ priorTier: "instant", priorLateFee: false, priorFeeLines: s1.feeLines, priorSubmit: null, proposedOn: TODAY });
  });

  it("with nothing pending, the permitted plan is the record itself", () => {
    expect(permittedPlan(s1)).toBe(s1);
    expect(pendingAmendment(s1)).toBeNull();
  });

  it("a second amendment waits for the first, and says which wait it is", () => {
    const pending = run(s1, { type: "amend", answers: withDjOnALaterDay }, "applicant");
    expect(refusal(pending, { type: "amend", answers: s1 }, "applicant")).toBe("An amendment is already pending; wait for the City Clerk's decision.");
  });

  /** Demo path 7 as far as it is scripted: the DJ on the same day, with the late fee. */
  const withDj = () => run(s1, { type: "amend", answers: { ...s1, addOns: { ...s1.addOns, amplifiedSound: true } }, lateFee: true }, "applicant");
  const approved = () => {
    let c = run(withDj(), { type: "complete_task", taskId: `${S1}:sound_details`, form: { equipment: "One DJ booth", soundCheckTime: "10:30" } }, "applicant");
    c = run(c, { type: "complete_task", taskId: `${S1}:insurance_certificate`, files: [{ name: "coi.pdf", size: 200_000, type: "application/pdf" }] }, "applicant");
    c = run(c, { type: "submit" }, "applicant");
    c = run(c, { type: "verify_document", taskId: `${S1}:sound_details` }, "pws");
    c = run(c, { type: "verify_document", taskId: `${S1}:insurance_certificate` }, "hl");
    return run(c, { type: "decide_amendment", decision: "approve" }, "clerk");
  };

  it("the plan the permit covers keeps its own fee lines: the amended plan's deposit and late fee are not on it", () => {
    const pending = withDj();
    expect(pending.feeLines.map((line) => line.kind)).toEqual(["fee", "fee", "fee", "deposit", "late_fee"]);
    expect(permittedPlan(pending).feeLines).toEqual(s1.feeLines);
    expect(caseTotals(permittedPlan(pending))).toMatchObject({ total: 125, paid: 125, due: 0 });
  });

  it("cancelling while it is pending refunds what the permit's plan refunds: $62.50, with no deposit she never paid", () => {
    const seeded = refundIfCancelled(s1, TODAY, CFG);
    expect(seeded).toMatchObject({ refund: 62.5, deposit: 0, canCancel: true });
    for (const pending of [withDj(), approved()]) {
      // The figure the permit page and the Cancel dialog show...
      expect(refundIfCancelled(pending, TODAY, CFG)).toEqual(seeded);
      // ...is the one `cancel` pays, and the one the case and Payments then read.
      const cancelled = run(pending, { type: "cancel" }, "applicant");
      expect(cancelled.payments.at(-1)).toMatchObject({ amount: -62.5, kind: "refund" });
      expect(cancelled.endingReason).toBe("Cancelled by the applicant. Refunded $62.50 (10 to 29 days before: 50% of space and permit fees; the application fee is kept).");
    }
  });

  it("what was paid toward an amendment that never took effect goes back whole when the permit is cancelled", () => {
    // The Clerk records $100 of the $393.75 at the counter; the amendment still waits for the rest.
    const part = run(run(approved(), { type: "accept_and_sign", signature: "Maya Chen" }, "applicant"), { type: "pay", amount: 100, method: "in_person", kind: "quote" }, "clerk");
    expect(part.flags.amendmentPending).toBe(true);
    expect(refundIfCancelled(part, TODAY, CFG)).toMatchObject({ refund: 162.5, deposit: 0 });
    expect(run(part, { type: "cancel" }, "applicant").payments.at(-1)).toMatchObject({ amount: -162.5, kind: "refund" });
  });
});

describe("an amendment before the permit: the application under review changes", () => {
  /** S3 with a tent added: one new card, the application's own Submit card reopened, then submitted. */
  function submitted() {
    const s3 = find(S3);
    let c = run(s3, { type: "amend", answers: { ...s3, addOns: { ...s3.addOns, tentsStages: { count: 1 } } } }, "applicant");
    expect(c).toMatchObject({ state: "needs_info", tier: "reviewed", flags: { amendmentPending: true } });
    expect(c.tasks.filter((t) => t.tags.includes("amendment")).map((t) => [t.catalogId, t.status])).toEqual([
      ["submit_application", "locked"],
      ["structure_specs", "todo"],
    ]);
    expect(pendingAmendment(c)).toMatchObject({ priorSubmit: { status: "done", unlocksOn: null, tags: [] }, priorFeeLines: s3.feeLines });
    // While it is the amendment's, the card is named for what it sends.
    expect(card(c, "submit_application")).toMatchObject({ title: "Submit amendment", why: "Send your change to the City Clerk" });
    c = run(c, { type: "complete_task", taskId: `${S3}:structure_specs`, files: [{ name: "tent-layout.pdf", size: 200_000, type: "application/pdf" }] }, "applicant");
    c = run(c, { type: "submit" }, "applicant");
    return { s3, c };
  }

  it("Public Works & Safety, which had decided its review, gets the new card to check; then the Clerk decides", () => {
    const { s3, c } = submitted();
    const s3card = card(s3, "submit_application")!;
    expect(card(c, "verify:structure_specs")).toMatchObject({ owner: "pws", status: "todo" });
    expect(card(c, "decide_amendment")).toMatchObject({ status: "locked" });
    const verified = run(c, { type: "verify_document", taskId: `${S3}:structure_specs` }, "pws");
    expect(card(verified, "decide_amendment")).toMatchObject({ status: "todo" });
    expect(availableActions(verified, "clerk", ctxFor(verified))[0]).toMatchObject({ type: "decide_amendment", label: "Decide amendment", enabled: true, primary: true });

    const approved = run(verified, { type: "decide_amendment", decision: "approve" }, "clerk");
    // No permit yet, so nothing to sign or settle: the quote, when it comes, is for the amended plan.
    expect(approved.flags.amendmentPending).toBe(false);
    expect(approved.payments).toEqual([]);
    expect(caseTotals(approved)).toMatchObject({ total: 775, paid: 0 });
    expect(card(approved, "pay_fees")?.status).toBe("locked");
    expect(card(approved, "structure_specs")).toMatchObject({ status: "done", tags: ["amendment"] });
    expect(approved.activity.slice(-2).map((a) => [a.actor, a.text])).toEqual([
      ["clerk", "Approved the amendment."],
      ["system", "The amendment is part of the application now."],
    ]);
    expect(approved.state).toBe("needs_info");
    // The application's own card again, under its own name.
    expect(card(approved, "submit_application")).toMatchObject({ status: "done", title: s3card.title, why: s3card.why });
  });

  it("a decline puts the application back: its own Submit card done again, the fee lines to the cent, the new card and its check gone", () => {
    const { s3, c } = submitted();
    const declined = run(c, { type: "decide_amendment", decision: "decline", reason: "The plaza cannot take a tent that size." }, "clerk");
    expect(declined).toMatchObject({ tier: s3.tier, triggers: s3.triggers, addOns: s3.addOns, schedule: s3.schedule, state: s3.state, flags: s3.flags });
    expect(declined.feeLines).toEqual(s3.feeLines);
    expect(card(declined, "submit_application")).toMatchObject({ status: "done", tags: [], unlocksOn: null, title: "Submit application", why: "Send your application to the City Clerk" });
    expect(card(declined, "structure_specs")).toBeUndefined();
    expect(card(declined, "verify:structure_specs")).toBeUndefined();
    // Every card and task the application had is as it was; the one addition is the Clerk's decision.
    const before = s3.tasks.map((t) => [t.catalogId, t.status]);
    expect(declined.tasks.map((t) => [t.catalogId, t.status])).toEqual([...before, ["decide_amendment", "done"]]);
    expect(caseTotals(declined)).toEqual(caseTotals(s3));
  });
});

describe("an amendment still pending when the event arrives lapses: the event is held under the plan the permit covers", () => {
  const s1 = find(S1);
  const EVENT_DAY = "2027-05-22";
  const JUN_18 = "2027-06-18"; // the Demo menu's jump
  const tick = (c: EventCase, to: string) => advanceClock([c], TODAY, to, CFG)[0];
  const withoutActivity = (c: EventCase) => ({ ...c, activity: [] });

  const proposed = () => run(s1, { type: "amend", answers: { ...s1, addOns: { ...s1.addOns, amplifiedSound: true } }, lateFee: true }, "applicant");
  const submitted = () => {
    let c = run(proposed(), { type: "complete_task", taskId: `${S1}:sound_details`, form: { equipment: "One DJ booth", soundCheckTime: "10:30" } }, "applicant");
    c = run(c, { type: "complete_task", taskId: `${S1}:insurance_certificate`, files: [{ name: "coi.pdf", size: 200_000, type: "application/pdf" }] }, "applicant");
    return run(c, { type: "submit" }, "applicant");
  };
  const approved = () => {
    let c = run(submitted(), { type: "verify_document", taskId: `${S1}:sound_details` }, "pws");
    c = run(c, { type: "verify_document", taskId: `${S1}:insurance_certificate` }, "hl");
    return run(c, { type: "decide_amendment", decision: "approve" }, "clerk");
  };

  it("demo path 7 as scripted (proposed), then the date moved to Jun 18: Maya's picnic closes as the Instant event it was", () => {
    const pending = proposed();
    expect(pending).toMatchObject({ tier: "reviewed", flags: { amendmentPending: true } });

    // On the day: the original plan, and the one card that is for today.
    const eventDay = tick(pending, EVENT_DAY);
    expect(eventDay).toMatchObject({ state: "event_day", tier: "instant", triggers: [], addOns: { amplifiedSound: false }, flags: { amendmentPending: false, lateFee: false } });
    expect(eventDay.feeLines).toEqual(s1.feeLines);
    expect(eventDay.tasks.map((t) => [t.catalogId, t.status, t.tags])).toEqual([
      ["pay_fees", "done", []],
      ["carry_permit", "todo", []],
    ]);
    expect(caseTotals(eventDay)).toEqual({ fees: 125, deposit: 0, total: 125, paid: 125, due: 0 });
    expect(eventDay.activity.slice(-2).map((a) => [a.actor, a.text])).toEqual([
      ["system", "The amendment lapsed: it was not in effect by the event, which goes ahead under the original plan."],
      ["system", "Today is event day."],
    ]);
    expect(permittedPlan(eventDay)).toBe(eventDay);

    // After it: Closed, not Closeout; nobody has a cleanup inspection and nothing is due.
    const after = tick(pending, JUN_18);
    expect(after).toMatchObject({ state: "closed", tier: "instant", payments: s1.payments });
    expect(after.tasks.filter((t) => t.tags.includes("amendment"))).toEqual([]);
    expect(queueFor([after], "pws", JUN_18)).toEqual([]);
    expect(caseTotals(after)).toMatchObject({ total: 125, paid: 125, due: 0 });
    // Apart from the line that says so, the record is the one the seed reaches with no amendment at all.
    expect(withoutActivity(after)).toEqual(withoutActivity(tick(s1, JUN_18)));
  });

  it("submitted: the departments' checks and the Clerk's decision leave their queues", () => {
    const pending = submitted();
    expect(queueFor([pending], "pws", TODAY).map((row) => row.task.catalogId)).toEqual(["verify:sound_details"]);
    const eventDay = tick(pending, EVENT_DAY);
    expect(eventDay).toMatchObject({ state: "event_day", tier: "instant", flags: { amendmentPending: false } });
    for (const dept of ["clerk", "pws", "hl"] as const) expect(queueFor([eventDay], dept, EVENT_DAY)).toEqual([]);
    // The decision is kept for the file, closed; the cards and their checks are gone.
    expect(eventDay.tasks.map((t) => [t.catalogId, t.status])).toEqual([
      ["pay_fees", "done"],
      ["carry_permit", "todo"],
      ["decide_amendment", "done"],
    ]);
    expect(card(eventDay, "decide_amendment")?.payload).toEqual({ decision: "lapsed" });
    expect(tick(pending, JUN_18)).toMatchObject({ state: "closed", tier: "instant" });
  });

  it("approved and not paid: the payment card is the booking's again, and nothing is due", () => {
    const pending = approved();
    expect(card(pending, "pay_fees")).toMatchObject({ status: "todo", payload: { amount: 393.75 } });
    const eventDay = tick(pending, EVENT_DAY);
    expect(eventDay).toMatchObject({ state: "event_day", tier: "instant", flags: { amendmentPending: false, signed: false } });
    const seeded = card(s1, "pay_fees")!;
    expect(card(eventDay, "pay_fees")).toMatchObject({ status: "done", title: seeded.title, why: seeded.why, dueDate: seeded.dueDate, payload: seeded.payload });
    expect(card(eventDay, "accept_and_sign")).toBeUndefined();
    expect(eventDay.payments).toEqual(s1.payments);
    expect(up(eventDay)).toEqual(["applicant"]); // "Carry your permit", nothing else
    expect(availableActions(eventDay, "applicant", ctxFor(eventDay)).find((a) => a.type === "pay")).toBeUndefined();

    const after = tick(pending, JUN_18);
    expect(after).toMatchObject({ state: "closed", tier: "instant" });
    expect(caseTotals(after)).toMatchObject({ total: 125, paid: 125, due: 0 });
  });

  it("approved, signed and part paid: what was paid toward it goes back, and the signature goes with its card", () => {
    const part = run(run(approved(), { type: "accept_and_sign", signature: "Maya Chen" }, "applicant"), { type: "pay", amount: 100, method: "in_person", kind: "quote" }, "clerk");
    expect(part.flags).toMatchObject({ amendmentPending: true, signed: true });
    const eventDay = tick(part, EVENT_DAY);
    expect(eventDay.flags).toMatchObject({ amendmentPending: false, signed: false });
    expect(eventDay.payments.map((p) => [p.amount, p.kind])).toEqual([
      [125, "booking"],
      [100, "quote"],
      [-100, "refund"],
    ]);
    expect(card(eventDay, "pay_fees")).toMatchObject({ status: "done", title: "Pay and book", payload: { amount: 125 } });
    expect(caseTotals(eventDay)).toEqual({ fees: 125, deposit: 0, total: 125, paid: 125, due: 0 });
    expect(eventDay.activity.at(-2)?.text).toBe("The amendment lapsed: it was not in effect by the event, which goes ahead under the original plan. Refunded $100 paid toward it.");
  });

  it("an amendment that moves the date lapses on the day the permit is for, not on the day it asked for", () => {
    // The DJ on Sat, Jun 12 instead: outside the 30 days, so no late fee, and still pending on May 22.
    const moved = run(s1, { type: "amend", answers: { ...s1, addOns: { ...s1.addOns, amplifiedSound: true }, schedule: { ...s1.schedule!, date: "2027-06-12", occurrences: [] } } }, "applicant");
    expect(moved.schedule?.date).toBe("2027-06-12");
    expect(tick(moved, "2027-05-21")).toBe(moved);
    const eventDay = tick(moved, EVENT_DAY);
    expect(eventDay).toMatchObject({ state: "event_day", tier: "instant", schedule: s1.schedule, flags: { amendmentPending: false } });
    expect(tick(moved, JUN_18)).toMatchObject({ state: "closed", tier: "instant" });
  });

  it("an amendment in effect before the day is not touched by the clock", () => {
    const paid = run(run(approved(), { type: "accept_and_sign", signature: "Maya Chen" }, "applicant"), { type: "pay", amount: 393.75, method: "card", kind: "quote" }, "applicant");
    expect(paid.flags.amendmentPending).toBe(false);
    const eventDay = tick(paid, EVENT_DAY);
    expect(eventDay).toMatchObject({ state: "event_day", tier: "reviewed", addOns: { amplifiedSound: true } });
    expect(eventDay.activity.some((a) => a.text.includes("lapsed"))).toBe(false);
    // A Reviewed event goes through Closeout, as it should.
    expect(tick(paid, JUN_18)).toMatchObject({ state: "closeout", tier: "reviewed" });
  });
});
