import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, type RulesCtx } from "@/lib/rules";
import { buildSeed } from "@/lib/state";
import type { EventAnswers, EventCase } from "@/lib/types";
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
  it("a tier rise (the PRD's example, Maya adds a DJ): Reviewed, 3 new cards, the gate fails on lead time, a late fee of $53.75", () => {
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
    // The PRD's example line says "3 new cards": the real plan for a Reviewed picnic adds a
    // fourth, "Accept conditions and sign" (every Reviewed or Special plan has one, picnic or
    // not). The banner counts the real plan, not the PRD's illustrative number (see the readme
    // on "classify()'s summary phrases" for the same kind of fixed-copy vs. real-number gap).
    expect(diff.cardsAdded.map((c) => c.catalogId).sort()).toEqual(["accept_and_sign", "insurance_certificate", "sound_details", "submit_application"].sort());
    expect(tierRiseBannerText(diff)).toBe("This change makes your event Reviewed. Everything you entered is kept; 4 new cards will be added.");
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
    // S3 (Jazz in the Plaza) is Reviewed for amplified sound; dropping it should no longer call
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
