import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/state";
import { estimateFees, DEFAULT_CONFIG } from "@/lib/rules";
import { DEMO_PATHS } from "@/lib/data/demoScript";
import {
  HERO_PREVIEW_DEFAULT,
  blockPartyNote,
  cancellationRows,
  cityStaffDoor,
  comparisonRows,
  demoPathJump,
  faqItems,
  feeScheduleRows,
  heroPreviewAnswers,
  heroPreviewResult,
  planAnEventPath,
  tierCards,
} from "./landing";

describe("heroPreviewResult", () => {
  it("Shelter 2 with 40 people is Instant", () => {
    const { classification } = heroPreviewResult(HERO_PREVIEW_DEFAULT);
    expect(classification.tier).toBe("instant");
  });

  it("turning alcohol on makes it Standard", () => {
    const { classification } = heroPreviewResult({ ...HERO_PREVIEW_DEFAULT, alcohol: true });
    expect(classification.tier).toBe("reviewed");
  });

  it("switching to a street makes it Special", () => {
    const { classification } = heroPreviewResult({ ...HERO_PREVIEW_DEFAULT, where: "street" });
    expect(classification.tier).toBe("special");
  });

  it("amplified sound alone makes it Standard, and a what-if offers the way back", () => {
    const { classification, whatIfs } = heroPreviewResult({ ...HERO_PREVIEW_DEFAULT, amplifiedSound: true });
    expect(classification.tier).toBe("reviewed");
    expect(whatIfs.some((w) => w.triggerId === "amplified_sound" && w.tier === "instant")).toBe(true);
  });

  it("the fees shown equal a fresh estimateFees() on the same answers", () => {
    const form = { ...HERO_PREVIEW_DEFAULT, alcohol: true };
    const { answers, classification, fees } = heroPreviewResult(form);
    const independent = estimateFees(answers, classification, DEFAULT_CONFIG);
    expect(fees).toEqual(independent);
    expect(fees.total).toBeGreaterThan(0);
  });

  it("never mutates the config it's given", () => {
    const cfgCopy = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    heroPreviewResult({ ...HERO_PREVIEW_DEFAULT, alcohol: true, amplifiedSound: true, where: "street" });
    expect(DEFAULT_CONFIG).toEqual(cfgCopy);
  });
});

describe("heroPreviewAnswers", () => {
  it("never sets a location for a space the inventory doesn't have", () => {
    for (const where of ["shelter", "plaza", "street"] as const) {
      const a = heroPreviewAnswers({ ...HERO_PREVIEW_DEFAULT, where });
      expect(a.location).not.toBeNull();
    }
  });
});

describe("tierCards", () => {
  const seed = buildSeed();
  const cards = tierCards(seed);

  it("has one row per tier, in order", () => {
    expect(cards.map((c) => c.tier)).toEqual(["instant", "reviewed", "special"]);
  });

  it("S1's birthday picnic is the Instant example at $125", () => {
    const row = cards.find((c) => c.tier === "instant")!;
    expect(row.example.caseId).toBe("PMT-27-0109");
    expect(row.typicalFee).toBe(125);
    expect(row.reviewerText).toBe("City Clerk only");
  });

  it("S3's Jazz in the Plaza is the Standard example at $715, reviewed by PWS and HL", () => {
    const row = cards.find((c) => c.tier === "reviewed")!;
    expect(row.example.caseId).toBe("PMT-27-0118");
    expect(row.example.title).toBe("Jazz in the Plaza");
    expect(row.typicalFee).toBe(715);
    expect(row.reviewerText).toBe("Public Works & Safety, Health & Legal");
  });

  it("S5's Riverfront Summer 5K is the Special example at $6,530, reviewed by all three", () => {
    const row = cards.find((c) => c.tier === "special")!;
    expect(row.example.caseId).toBe("PMT-27-0097");
    expect(row.typicalFee).toBe(6530);
    expect(row.reviewerText).toBe("City Clerk, Public Works & Safety, Health & Legal");
  });

  it("reads lead times off the rules engine, not typed in", () => {
    for (const row of cards) {
      expect(row.leadTimeDays).toBe(DEFAULT_CONFIG.leadTimeDays[row.tier]);
    }
  });
});

describe("comparisonRows", () => {
  const rows = comparisonRows();

  it("has one row per trigger plus the Instant baseline", () => {
    expect(rows).toHaveLength(15);
  });

  it("raises street and route to Special", () => {
    expect(rows.find((r) => r.id === "street")?.tier).toBe("special");
    expect(rows.find((r) => r.id === "route")?.tier).toBe("special");
  });

  it("raises amplified sound and alcohol to Standard", () => {
    expect(rows.find((r) => r.id === "amplified_sound")?.tier).toBe("reviewed");
    expect(rows.find((r) => r.id === "alcohol")?.tier).toBe("reviewed");
  });

  it("the attendance rows read the configured thresholds", () => {
    const hundred = rows.find((r) => r.id === "attendance_100")!;
    const thousand = rows.find((r) => r.id === "attendance_1000")!;
    expect(hundred.label).toContain("100");
    expect(thousand.label).toContain("1,000");
  });

  it("ends with the Instant baseline", () => {
    expect(rows.at(-1)).toEqual({ id: "none", label: "A bookable space within capacity, no add-ons", tier: "instant" });
  });
});

describe("blockPartyNote", () => {
  it("quotes the configured threshold, not a hardcoded number", () => {
    const cfg = { ...DEFAULT_CONFIG, thresholds: { ...DEFAULT_CONFIG.thresholds, blockPartyMaxAttendance: 99 } };
    expect(blockPartyNote(cfg)).toContain("99");
    expect(blockPartyNote(DEFAULT_CONFIG)).toContain("250");
  });
});

describe("feeScheduleRows", () => {
  it("shows $25 per hour for a shelter", () => {
    const rows = feeScheduleRows();
    expect(rows.find((r) => r.label === "Shelter")?.amount).toBe("$25 per hour");
  });

  it("every amount is read off cfg.fees, not hardcoded", () => {
    const cfg = { ...DEFAULT_CONFIG, fees: { ...DEFAULT_CONFIG.fees, shelterPerHour: 999 } };
    const rows = feeScheduleRows(cfg);
    expect(rows.find((r) => r.label === "Shelter")?.amount).toBe("$999 per hour");
  });
});

describe("cancellationRows", () => {
  it("returns the config's own band labels", () => {
    expect(cancellationRows()).toEqual(DEFAULT_CONFIG.cancellation.map((b) => b.label));
  });
});

describe("faqItems", () => {
  it("has the eight required questions, in order", () => {
    expect(faqItems().map((f) => f.question)).toEqual([
      "Do I need insurance?",
      "How far ahead must I apply?",
      "What about a block party?",
      "Can I book a weekly class?",
      "What if my plans change?",
      "What does it cost to cancel?",
      "Who do I call on the day?",
      "Why do I need neighbors to sign?",
    ]);
  });

  it("quotes the configured lead times", () => {
    const answer = faqItems().find((f) => f.question === "How far ahead must I apply?")!.answer;
    expect(answer).toContain("10 days");
    expect(answer).toContain("30 days");
    expect(answer).toContain("60 days");
  });
});

describe("the two doors", () => {
  const seed = buildSeed();

  it("Plan an event opens a blank wizard for a new applicant", () => {
    expect(planAnEventPath("new", seed)).toBe("/apply");
  });

  it("Plan an event reopens the persona's one draft where it was left", () => {
    expect(planAnEventPath("sunrise-yoga-club", seed)).toBe("/apply?case=PMT-27-0142&step=when");
  });

  it("Plan an event is the wizard, not My events, for somebody who already has an event", () => {
    expect(planAnEventPath("maya-chen", seed)).toBe("/apply");
  });

  it("City staff opens My queue as the City Clerk, or as the city role already current", () => {
    expect(cityStaffDoor("applicant")).toEqual({ role: "clerk", href: "/city/queue" });
    expect(cityStaffDoor("clerk")).toEqual({ role: "clerk", href: "/city/queue" });
    expect(cityStaffDoor("hl")).toEqual({ role: "hl", href: "/city/queue" });
  });
});

describe("demoPathJump", () => {
  const seed = buildSeed();

  it("path 3 (S3) opens the Arts Collective's board", () => {
    const path = DEMO_PATHS.find((p) => p.id === 3)!;
    const jump = demoPathJump(path, seed);
    expect(jump).toEqual({ role: "applicant", personaId: "downtown-arts-collective", href: "/events/PMT-27-0118" });
  });

  it("path 2 (no scenario) opens a blank wizard as a new applicant", () => {
    const path = DEMO_PATHS.find((p) => p.id === 2)!;
    const jump = demoPathJump(path, seed);
    expect(jump).toEqual({ role: "applicant", personaId: "new", href: "/apply" });
  });

  it("path 5 (S5) opens the City Clerk's case view", () => {
    const path = DEMO_PATHS.find((p) => p.id === 5)!;
    const jump = demoPathJump(path, seed);
    expect(jump.role).toBe("clerk");
    expect(jump.href).toBe("/city/cases/PMT-27-0097");
  });
});

describe("comparisonRows labels", () => {
  it("every isolated row has a real label from the engine", () => {
    for (const row of comparisonRows()) {
      if (row.id === "none") continue;
      expect(row.label.length).toBeGreaterThan(0);
    }
  });
});
