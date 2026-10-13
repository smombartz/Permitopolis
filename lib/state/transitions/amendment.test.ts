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
import { buildSeed } from "../seed";
import { caseTotals, queueFor } from "../selectors";
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
    c = run(c, { type: "complete_task", taskId: `${S3}:structure_specs`, files: [{ name: "tent-layout.pdf", size: 200_000, type: "application/pdf" }] }, "applicant");
    c = run(c, { type: "submit" }, "applicant");
    return { s3, c };
  }

  it("Public Works & Safety, which had decided its review, gets the new card to check; then the Clerk decides", () => {
    const { c } = submitted();
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
  });

  it("a decline puts the application back: its own Submit card done again, the fee lines to the cent, the new card and its check gone", () => {
    const { s3, c } = submitted();
    const declined = run(c, { type: "decide_amendment", decision: "decline", reason: "The plaza cannot take a tent that size." }, "clerk");
    expect(declined).toMatchObject({ tier: s3.tier, triggers: s3.triggers, addOns: s3.addOns, schedule: s3.schedule, state: s3.state, flags: s3.flags });
    expect(declined.feeLines).toEqual(s3.feeLines);
    expect(card(declined, "submit_application")).toMatchObject({ status: "done", tags: [], unlocksOn: null });
    expect(card(declined, "structure_specs")).toBeUndefined();
    expect(card(declined, "verify:structure_specs")).toBeUndefined();
    // Every card and task the application had is as it was; the one addition is the Clerk's decision.
    const before = s3.tasks.map((t) => [t.catalogId, t.status]);
    expect(declined.tasks.map((t) => [t.catalogId, t.status])).toEqual([...before, ["decide_amendment", "done"]]);
    expect(caseTotals(declined)).toEqual(caseTotals(s3));
  });
});
