/**
 * Static checks on the seed scripts themselves (not on the engine, which does not exist in
 * this worktree). Verifies the data workstream 2A will replay: shape, dates, reserved slots,
 * the background set's counts and plan 6.2's stress rows.
 */
import { describe, expect, it } from "vitest";
import { getSpace } from "@/lib/data/inventory";
import { MAIN_1ST_TO_4TH, RIVERFRONT_5K_ROUTE, getSegment } from "@/lib/data/streets";
import { PERSONAS } from "@/lib/data/people";
import { weekdayOf } from "@/lib/dates";
import type { CaseState, Ending, Location } from "@/lib/types";
import type { SeedScript } from "../types";
import { BACKGROUND_SCRIPTS } from "./background";
import { SEED_SCRIPTS } from "./scripts";
import { SEED_CUTOFF } from "./helpers";

const EXPECTED_KEYS = [
  "S1",
  "S2",
  "S3",
  "S4",
  "S5",
  "S6",
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  ...Array.from({ length: 25 }, (_, i) => `B${String(i + 1).padStart(2, "0")}`),
];

function idNumber(id: string): number {
  const match = /^PMT-27-(\d{4})$/.exec(id);
  if (!match) throw new Error(`not a PMT-27-#### id: ${id}`);
  return Number(match[1]);
}

describe("every seed script", () => {
  it("has 38 unique, well-formed ids no greater than PMT-27-0142", () => {
    expect(SEED_SCRIPTS).toHaveLength(38);
    for (const s of SEED_SCRIPTS) {
      expect(s.id).toMatch(/^PMT-27-\d{4}$/);
      expect(idNumber(s.id)).toBeLessThanOrEqual(142);
    }
    expect(new Set(SEED_SCRIPTS.map((s) => s.id)).size).toBe(38);
  });

  it("has exactly the keys S1-S6, F1-F7 and B01-B25", () => {
    expect(new Set(SEED_SCRIPTS.map((s) => s.key))).toEqual(new Set(EXPECTED_KEYS));
    expect(new Set(SEED_SCRIPTS.map((s) => s.key)).size).toBe(38);
  });

  it("never dates a step (or createdAt) after the demo cutoff, and keeps steps in order", () => {
    for (const s of SEED_SCRIPTS) {
      expect(s.createdAt <= SEED_CUTOFF).toBe(true);
      let previous = s.createdAt;
      for (const step of s.steps) {
        expect(step.at <= SEED_CUTOFF).toBe(true);
        expect(step.at >= previous).toBe(true);
        previous = step.at;
      }
    }
  });

  it("only references inventory spaces and street segments that exist", () => {
    for (const s of SEED_SCRIPTS) {
      const loc = s.answers.location;
      if (!loc) continue;
      for (const id of loc.inventoryIds) expect(getSpace(id), `${s.key}: unknown space ${id}`).toBeDefined();
      for (const id of loc.segmentIds) expect(getSegment(id), `${s.key}: unknown segment ${id}`).toBeDefined();
    }
  });

  it("matches the PRD's stated weekdays", () => {
    // 0 = Sunday ... 6 = Saturday.
    expect(weekdayOf("2027-05-22")).toBe(6); // S1: Sat
    expect(weekdayOf("2027-06-06")).toBe(0); // S2: first Sunday
    expect(weekdayOf("2027-06-18")).toBe(5); // S3: Fri
    expect(weekdayOf("2027-06-26")).toBe(6); // S4: Sat
    expect(weekdayOf("2027-07-11")).toBe(0); // S5: Sun
    expect(weekdayOf("2027-04-24")).toBe(6); // S6: Sat
  });
});

describe("background cases (plan 6.2)", () => {
  it("has 25 scripts", () => {
    expect(BACKGROUND_SCRIPTS).toHaveLength(25);
  });

  it("matches the exact state and ending counts", () => {
    const counts: Partial<Record<CaseState | Ending, number>> = {};
    const bump = (key: CaseState | Ending) => (counts[key] = (counts[key] ?? 0) + 1);
    for (const s of BACKGROUND_SCRIPTS) {
      if (s.expect.ending) bump(s.expect.ending);
      else bump(s.expect.state);
    }
    expect(counts).toEqual({
      draft: 2,
      submitted: 2,
      in_review: 3,
      needs_info: 2,
      quote_sent: 2,
      permitted: 4,
      event_day: 1,
      closeout: 2,
      closed: 3,
      denied: 1,
      withdrawn: 1,
      cancelled: 1,
      hold_expired: 1,
    });
  });

  it("includes every stress row from plan 6.2", () => {
    const names = BACKGROUND_SCRIPTS.map((s) => s.answers.name);
    expect(names.some((n) => n.length >= 90)).toBe(true);
    expect(PERSONAS.some((p) => p.name.length >= 60)).toBe(true);
    expect(PERSONAS.some((p) => /[À-ÖØ-öø-ÿ]/.test(p.name) && p.name.includes("'"))).toBe(true);
    expect(BACKGROUND_SCRIPTS.some((s) => s.answers.description === undefined)).toBe(true);
    expect(
      BACKGROUND_SCRIPTS.some((s) => s.answers.schedule && !s.answers.schedule.setupStart && !s.answers.schedule.teardownEnd),
    ).toBe(true);
    expect(BACKGROUND_SCRIPTS.some((s) => (s.answers.schedule?.occurrences.length ?? 0) >= 20)).toBe(true);
    expect(BACKGROUND_SCRIPTS.some((s) => s.steps.length === 0)).toBe(true); // one activity entry: creation only
    expect(BACKGROUND_SCRIPTS.some((s) => s.steps.length >= 30)).toBe(true);
    expect(BACKGROUND_SCRIPTS.some((s) => (s.answers.location?.miles ?? 0) > 10)).toBe(true);
    const hasZeroFeeLine = BACKGROUND_SCRIPTS.some((s) =>
      s.steps.some((step) => {
        const a = step.action;
        if (a.type === "log_closeout") return a.extraLines.some((l) => l.unitPrice === 0);
        if (a.type === "review_decide" || a.type === "send_quote") return a.feeLines.some((l) => l.unitPrice === 0);
        return false;
      }),
    );
    expect(hasZeroFeeLine).toBe(true);

    // An overdue task for each of the four parties: B03 (Clerk, 6 days against a 3-day intake
    // SLA), B05 (Public Works & Safety), B07 (Health & Legal), B08 (the applicant).
    const byKey = (key: string) => BACKGROUND_SCRIPTS.find((s) => s.key === key)!;
    expect(byKey("B03").notes).toMatch(/clerk-overdue/i);
    expect(byKey("B05").notes).toMatch(/overdue/i);
    expect(byKey("B07").notes).toMatch(/overdue/i);
    expect(byKey("B08").notes).toMatch(/overdue/i);
  });

  it("never holds or books a reserved slot", () => {
    const usesSpace = (loc: Location | null, id: string) => loc?.inventoryIds.includes(id) ?? false;
    const usesAnySegment = (loc: Location | null, ids: string[]) => ids.some((id) => loc?.segmentIds.includes(id));
    const datesOf = (s: SeedScript) => s.answers.schedule?.occurrences.map((o) => o.date) ?? [];

    for (const s of BACKGROUND_SCRIPTS) {
      const loc = s.answers.location;
      const dates = datesOf(s);

      // Shelter 3, May 22 (S1).
      expect(usesSpace(loc, "shelter-3") && dates.includes("2027-05-22")).toBe(false);
      // Field 4, every Sunday Jun 6-Aug 29 (S2).
      if (usesSpace(loc, "field-4")) {
        for (const d of dates) {
          const inRange = d >= "2027-06-06" && d <= "2027-08-29";
          expect(inRange && weekdayOf(d) === 0).toBe(false);
        }
      }
      // Maple Street 400 block, Jun 26 (S4).
      expect(usesAnySegment(loc, ["maple-400"]) && dates.includes("2027-06-26")).toBe(false);
      // City Hall Plaza, Jun 18 (S3 / F5).
      expect(loc?.areaId === "city-hall-plaza" && dates.includes("2027-06-18")).toBe(false);
      // The Riverfront 5K route, Jul 11 (S5).
      expect(usesAnySegment(loc, RIVERFRONT_5K_ROUTE) && dates.includes("2027-07-11")).toBe(false);
      // Main Street 1st to 4th, Apr 24, 2027 (S6) and Apr 22, 2028 (demo path 6, "book again").
      expect(
        usesAnySegment(loc, MAIN_1ST_TO_4TH) && (dates.includes("2027-04-24") || dates.includes("2028-04-22")),
      ).toBe(false);
      // Shelter 2 from May 13 on (demo path 2).
      if (usesSpace(loc, "shelter-2")) {
        for (const d of dates) expect(d >= "2027-05-13").toBe(false);
      }
    }
  });
});
