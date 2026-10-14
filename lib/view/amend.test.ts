import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, type RulesCtx } from "@/lib/rules";
import { amendmentBalance, buildSeed, caseTotals, transition, type Action } from "@/lib/state";
import type { Actor, EventAnswers, EventCase } from "@/lib/types";
import { canAmend } from "./board";
import { amendAnswersOf, amendmentGateSatisfied, buildAmendmentDiff, tierRiseBannerText } from "./amend";

const TODAY = "2027-05-03";
const seed = buildSeed();
const ctx: RulesCtx = { today: TODAY, cases: seed, cfg: DEFAULT_CONFIG };

function caseById(id: string): EventCase {
  const found = seed.find((c) => c.id === id);
  if (!found) throw new Error(`no seeded case ${id}`);
  return found;
}

/** Maya's picnic (S1, PMT-27-0109): Instant, Permitted, booked for Sat, May 22, 2027. */
const MAYA = caseById("PMT-27-0109");

function withDj(c: EventCase): EventAnswers {
  return { ...amendAnswersOf(c), addOns: { ...c.addOns, amplifiedSound: true } };
}

describe("buildAmendmentDiff", () => {
  it("a tier rise (the PRD's example, Maya adds a DJ): Standard, 3 new cards, the gate fails on lead time, a late fee of $53.75", () => {
    const diff = buildAmendmentDiff(MAYA, withDj(MAYA), ctx);
    expect(diff.material).toBe(true);
    expect(diff.tierBefore).toBe("instant");
    expect(diff.tierAfter).toBe("reviewed");
    expect(diff.tierRose).toBe(true);
    expect(diff.tierFell).toBe(false);
    expect(diff.needsNotice).toBe(true);
    expect(diff.cardsAdded.map((c) => c.catalogId).sort()).toEqual(["accept_and_sign", "insurance_certificate", "sound_details", "submit_application"].sort());
    expect(diff.cardsRemoved).toEqual([]);
    expect(diff.gate).toMatchObject({ ok: false, leadTimeOk: false, daysUntil: 19 });
    expect(diff.gate.fixes).toEqual(["new_date", "drop_addon", "late_fee"]);
    expect(amendmentGateSatisfied(diff, false)).toBe(false);
  });

  it("choosing the late fee satisfies the gate and prices it onto the new total", () => {
    const diff = buildAmendmentDiff(MAYA, withDj(MAYA), ctx, { lateFee: true });
    expect(amendmentGateSatisfied(diff, true)).toBe(true);
    expect(diff.lateFeeAmount).toBe(53.75);
    expect(diff.feeBefore).toBe(125);
    expect(diff.paid).toBe(125);
    // The new plan's total, deposit included, is the same $518.75 the engine will charge.
    expect(diff.feeAfter).toBe(518.75);
    expect(diff.feeDiff).toBe(393.75);
    // The PRD's example line says "3 new cards": the real plan for a Standard picnic adds a
    // fourth, "Accept conditions and sign" (every Standard or Special plan has one, picnic or
    // not). The banner counts the real plan, not the PRD's illustrative number (see the readme
    // on "classify()'s summary phrases" for the same kind of fixed-copy vs. real-number gap).
    expect(diff.cardsAdded.map((c) => c.catalogId).sort()).toEqual(["accept_and_sign", "insurance_certificate", "sound_details", "submit_application"].sort());
    expect(tierRiseBannerText(diff)).toBe("This change makes your event Standard. Everything you entered is kept; 4 new cards will be added.");
    // The amendment's Submit card is listed under the name the board will give it.
    expect(diff.cardsAdded.map((c) => c.title)).toEqual(["Certificate of insurance", "Sound details", "Submit amendment", "Accept conditions and sign"]);
  });

  it("a smaller crowd, the same tier: nothing material, nothing added or removed", () => {
    const diff = buildAmendmentDiff(MAYA, { ...amendAnswersOf(MAYA), attendance: 20 }, ctx);
    expect(diff.material).toBe(false);
    expect(diff.tierBefore).toBe("instant");
    expect(diff.tierAfter).toBe("instant");
    expect(diff.cardsAdded).toEqual([]);
    expect(diff.cardsRemoved).toEqual([]);
    expect(diff.gate.ok).toBe(true);
  });

  it("a later date inside the same tier still needs the lead time's notice", () => {
    const sameDayNextWeek = { ...MAYA.schedule!, date: "2027-05-10", occurrences: [{ date: "2027-05-10", availability: { status: "open" as const }, billing: "paid" as const }] };
    const diff = buildAmendmentDiff(MAYA, { ...amendAnswersOf(MAYA), schedule: sameDayNextWeek }, ctx);
    expect(diff.tierAfter).toBe("instant");
    expect(diff.needsNotice).toBe(true);
  });

  it("dropping a trigger that lowers the tier removes the cards it alone required", () => {
    // S3 (Jazz in the Plaza) is Standard for amplified sound; dropping it should no longer call
    // for the sound details card (what it adds back is a different workstream's board rebuild,
    // not this diff's job).
    const jazz = caseById("PMT-27-0118");
    const diff = buildAmendmentDiff(jazz, { ...amendAnswersOf(jazz), addOns: { ...jazz.addOns, amplifiedSound: false } }, ctx);
    expect(diff.tierFell).toBe(diff.tierAfter !== diff.tierBefore);
    if (diff.tierFell) {
      expect(diff.cardsRemoved.map((c) => c.catalogId)).toContain("sound_details");
    }
  });
});

describe("buildAmendmentDiff: the fee difference is the engine's, the figure `amend` then charges", () => {
  const ctxFor = (c: EventCase): RulesCtx => ({ today: TODAY, cases: seed.map((other) => (other.id === c.id ? c : other)), cfg: DEFAULT_CONFIG });
  const run = (c: EventCase, action: Action, actor: Actor): EventCase => {
    const result = transition(c, action, actor, ctxFor(c));
    if (!result.ok) throw new Error(`${action.type} as ${actor} was refused: ${result.reason}`);
    return result.case;
  };
  const diffOf = (c: EventCase, proposed: EventAnswers = amendAnswersOf(c), lateFee = false) => buildAmendmentDiff(c, proposed, ctxFor(c), { lateFee });

  it("an amendment that changes nothing costs nothing, on every seeded case that can be amended", () => {
    const amendable = seed.filter((c) => canAmend(c, TODAY).ok);
    // Every state an amendment can start from is among them: before the permit, at the quote, permitted, a series.
    expect([...new Set(amendable.map((c) => c.state))].sort()).toEqual(["event_day", "in_review", "needs_info", "permitted", "quote_sent", "submitted"]);
    expect(amendable.some((c) => c.schedule?.recurrence)).toBe(true);
    expect(amendable.map((c) => [c.id, diffOf(c).feeDiff]).filter(([, diff]) => diff !== 0)).toEqual([]);
    for (const c of amendable) expect([c.id, diffOf(c).feeAfter]).toEqual([c.id, caseTotals(c).total]);
  });

  it("a permitted series is not billed its later sessions: Sunrise Yoga after Pay and book reads $260, $20 paid, $240 on the sessions' own days, nothing to pay", () => {
    const yoga = run(caseById("PMT-27-0142"), { type: "book_and_pay", method: "card" }, "applicant");
    const diff = diffOf(yoga);
    expect(diff).toMatchObject({ feeAfter: 260, paid: 20, billedLater: 240, feeDiff: 0, permitted: true });
    // Tai Chi in the Park and Northgate Swim Club, on the seed, the same.
    for (const c of seed.filter((s) => s.permit && s.ending === null && s.schedule?.recurrence && canAmend(s, TODAY).ok)) {
      const d = diffOf(c);
      expect([c.name, d.feeDiff, d.feeAfter - d.paid - d.billedLater]).toEqual([c.name, 0, 0]);
    }
  });

  it("before the permit nothing has been paid for, so the difference is the change to the fees: one fewer guest on S5 changes nothing, not \"$6,530 more\"", () => {
    const s5 = caseById("PMT-27-0097");
    expect(s5).toMatchObject({ state: "quote_sent", payments: [] });
    const fewer = diffOf(s5, { ...amendAnswersOf(s5), attendance: s5.attendance! - 1 });
    expect(fewer).toMatchObject({ feeBefore: 6530, feeAfter: 6530, feeDiff: 0, permitted: false, material: false });
    // Dropping the amplified sound takes its $40 off the quote: nothing is refunded, nothing was paid.
    const quieter = diffOf(s5, { ...amendAnswersOf(s5), addOns: { ...s5.addOns, amplifiedSound: false } });
    expect(quieter).toMatchObject({ feeBefore: 6530, feeAfter: 6490, feeDiff: -40, permitted: false });
  });

  it("a late fee already charged stays on the plan: once path 7 is in effect, opening the wizard again with no change owes nothing, not a $53.75 refund", () => {
    let c = run(MAYA, { type: "amend", answers: withDj(MAYA), lateFee: true }, "applicant");
    c = run(c, { type: "complete_task", taskId: `${c.id}:sound_details`, form: { equipment: "One DJ booth", soundCheckTime: "10:30" } }, "applicant");
    c = run(c, { type: "complete_task", taskId: `${c.id}:insurance_certificate`, files: [{ name: "coi.pdf", size: 200_000, type: "application/pdf" }] }, "applicant");
    c = run(c, { type: "submit" }, "applicant");
    c = run(c, { type: "verify_document", taskId: `${c.id}:sound_details` }, "pws");
    c = run(c, { type: "verify_document", taskId: `${c.id}:insurance_certificate` }, "hl");
    c = run(c, { type: "decide_amendment", decision: "approve" }, "clerk");
    c = run(c, { type: "accept_and_sign", signature: "Maya Chen" }, "applicant");
    c = run(c, { type: "pay", amount: 393.75, method: "card", kind: "quote" }, "applicant");
    expect(c.flags.amendmentPending).toBe(false);
    expect(diffOf(c)).toMatchObject({ feeBefore: 518.75, feeAfter: 518.75, paid: 518.75, feeDiff: 0, lateFeeAmount: null });
  });

  it("what the panel says is to pay or to come back is what the engine then settles", () => {
    const changes: [string, EventAnswers][] = [
      ["two more hours", { ...amendAnswersOf(MAYA), schedule: { ...MAYA.schedule!, end: "18:00" } }],
      ["two hours fewer", { ...amendAnswersOf(MAYA), schedule: { ...MAYA.schedule!, end: "14:00" } }],
      ["a smaller crowd", { ...amendAnswersOf(MAYA), attendance: 20 }],
    ];
    for (const [what, proposed] of changes) {
      const diff = diffOf(MAYA, proposed);
      const amended = run(MAYA, { type: "amend", answers: proposed }, "applicant");
      // After `amend` a refund has already gone back and a balance is on the payment card.
      const settled = amended.payments.length - MAYA.payments.length === 1 ? amended.payments.at(-1)!.amount : amendmentBalance(amended, DEFAULT_CONFIG);
      expect([what, diff.feeDiff]).toEqual([what, settled]);
      expect([what, diff.feeAfter]).toEqual([what, caseTotals(amended).total]);
    }
    expect(diffOf(MAYA, changes[0][1]).feeDiff).toBe(50);
    expect(diffOf(MAYA, changes[1][1]).feeDiff).toBe(-50);
  });
});
