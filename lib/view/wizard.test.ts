import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, requirements, classify, dateGate, type RulesCtx } from "@/lib/rules";
import { buildSeed } from "@/lib/state";
import { EMPTY_ADDONS, type EventAnswers, type EventCase } from "@/lib/types";
import {
  WIZARD_STEPS,
  addOnEffectText,
  addOnsForEventType,
  buildResultPanel,
  dateGateSatisfied,
  groupTasksByPhase,
  isWizardStep,
  missingFields,
  nextWizardStep,
  previousWizardStep,
  primaryButtonReady,
  removeAddOnForTrigger,
  repeatsByDefault,
  resolveWizardStep,
  sessionCountLabel,
  triggerDropLabel,
  weekdayName,
  wizardStepIndex,
} from "./wizard";

const TODAY = "2027-05-03";
const seed = buildSeed();
const ctx: RulesCtx = { today: TODAY, cases: seed, cfg: DEFAULT_CONFIG };

function caseById(id: string): EventCase {
  const found = seed.find((c) => c.id === id);
  if (!found) throw new Error(`no seeded case ${id}`);
  return found;
}

const S3 = caseById("PMT-27-0118"); // Jazz in the Plaza: Reviewed
const S4 = caseById("PMT-27-0126"); // Maple Street block party: Reviewed by exception
const S5 = caseById("PMT-27-0097"); // Riverfront Summer 5K: Special

const baseAnswers: EventAnswers = {
  eventType: "picnic_party",
  name: "Smith family reunion",
  location: { mode: "inventory", inventoryIds: ["shelter-2"], segmentIds: [], capacity: 40, label: "Shelter 2, Riverside Park" },
  schedule: { date: "2027-06-19", start: "11:00", end: "16:00", occurrences: [] },
  attendance: 40,
  addOns: EMPTY_ADDONS,
};

describe("step order", () => {
  it("walks what, where, when, size, plan in order", () => {
    expect(WIZARD_STEPS).toEqual(["what", "where", "when", "size", "plan"]);
    expect(wizardStepIndex("where")).toBe(1);
    expect(nextWizardStep("what")).toBe("where");
    expect(nextWizardStep("plan")).toBeNull();
    expect(previousWizardStep("where")).toBe("what");
    expect(previousWizardStep("what")).toBeNull();
  });

  it("resolveWizardStep trusts a real step and falls back otherwise", () => {
    expect(isWizardStep("when")).toBe(true);
    expect(isWizardStep("nope")).toBe(false);
    expect(isWizardStep(null)).toBe(false);
    expect(resolveWizardStep("size", "what")).toBe("size");
    expect(resolveWizardStep("bogus", "what")).toBe("what");
    expect(resolveWizardStep(null, "plan")).toBe("plan");
  });
});

describe("step 1: event type defaults", () => {
  it("a market or festival turns on food or vending, once, without overwriting a later edit", () => {
    const on = addOnsForEventType("market_festival", EMPTY_ADDONS);
    expect(on.foodVending).toEqual({ vendors: 1, vendorNames: [] });
    const untouched = addOnsForEventType("market_festival", { ...EMPTY_ADDONS, foodVending: { vendors: 3 } });
    expect(untouched.foodVending).toEqual({ vendors: 3 });
  });

  it("every other type leaves add-ons alone", () => {
    expect(addOnsForEventType("picnic_party", EMPTY_ADDONS)).toBe(EMPTY_ADDONS);
  });

  it("only a class or club meetup repeats by default", () => {
    expect(repeatsByDefault("class_meetup")).toBe(true);
    expect(repeatsByDefault("picnic_party")).toBe(false);
    expect(repeatsByDefault(null)).toBe(false);
  });
});

describe("buildResultPanel, against the PRD's acceptance rows", () => {
  it("S3: Reviewed, 30-day lead time, Public Works & Safety and Health & Legal, $715 including the deposit", () => {
    const panel = buildResultPanel(S3, ctx, { ignoreCaseId: S3.id });
    expect(panel.tier).toBe("reviewed");
    expect(panel.leadTimeDays).toBe(30);
    expect(panel.reviewers.map((r) => r.dept)).toEqual(["pws", "hl"]);
    expect(panel.fees.total).toBe(715);
  });

  it("S5: Special event, 60-day lead time, all three city groups", () => {
    const panel = buildResultPanel(S5, ctx, { ignoreCaseId: S5.id });
    expect(panel.tier).toBe("special");
    expect(panel.leadTimeDays).toBe(60);
    expect(panel.reviewers.map((r) => r.dept)).toEqual(["clerk", "pws", "hl"]);
  });

  it("a 40-person picnic at a shelter with alcohol is Reviewed; turning alcohol off is Instant", () => {
    const withAlcohol: EventAnswers = { ...baseAnswers, addOns: { ...EMPTY_ADDONS, alcohol: true } };
    const panel = buildResultPanel(withAlcohol, ctx);
    expect(panel.tier).toBe("reviewed");
    expect(panel.whatIf.map((w) => w.triggerId)).toContain("alcohol");

    const without = removeAddOnForTrigger(withAlcohol.addOns, "alcohol");
    expect(buildResultPanel({ ...withAlcohol, addOns: without }, ctx).tier).toBe("instant");
  });

  it("S4's exact answers give Reviewed by the block-party exception", () => {
    const panel = buildResultPanel(S4, ctx, { ignoreCaseId: S4.id });
    expect(panel.tier).toBe("reviewed");
  });
});

describe("the block-party exception's neighbor sign-off card", () => {
  it("is in the plan's grouped cards, so it shows up in the plan at a glance", () => {
    const cls = classify(S4, DEFAULT_CONFIG);
    const tasks = requirements(S4, cls, { caseId: "PREVIEW", today: TODAY, cfg: DEFAULT_CONFIG });
    const groups = groupTasksByPhase(tasks);
    expect(groups.flatMap((g) => g.tasks).some((t) => t.catalogId === "neighbor_signoff")).toBe(true);
  });
});

describe("addOnEffectText", () => {
  it("quotes the configured fee for the add-ons that carry one", () => {
    expect(addOnEffectText("amplifiedSound", DEFAULT_CONFIG)).toContain("$40");
    expect(addOnEffectText("alcohol", DEFAULT_CONFIG)).toContain("$100");
    expect(addOnEffectText("foodVending", DEFAULT_CONFIG)).toContain("$75");
    expect(addOnEffectText("tentsStages", DEFAULT_CONFIG)).toContain("$60");
  });

  it("names the reviewing department even when there is no direct fee line", () => {
    expect(addOnEffectText("cookingGenerators", DEFAULT_CONFIG)).toContain("Public Works & Safety");
    expect(addOnEffectText("fireworksDrones", DEFAULT_CONFIG)).toContain("Special");
    expect(addOnEffectText("admission", DEFAULT_CONFIG)).toContain("City Clerk");
    expect(addOnEffectText("cityServices", DEFAULT_CONFIG)).toContain("Public Works & Safety");
  });
});

describe("removeAddOnForTrigger and triggerDropLabel", () => {
  it("turns off exactly the add-on a trigger stands for", () => {
    const addOns = { ...EMPTY_ADDONS, alcohol: true, amplifiedSound: true };
    expect(removeAddOnForTrigger(addOns, "alcohol")).toEqual({ ...addOns, alcohol: false });
    expect(removeAddOnForTrigger(addOns, "amplified_sound")).toEqual({ ...addOns, amplifiedSound: false });
  });

  it("has plain-language labels for the droppable triggers", () => {
    expect(triggerDropLabel("alcohol")).toBe("alcohol");
    expect(triggerDropLabel("amplified_sound")).toBe("amplified sound");
  });
});

describe("sessionCountLabel", () => {
  it("counts a single event as one session", () => {
    expect(sessionCountLabel({ date: "2027-06-19", start: "11:00", end: "16:00", occurrences: [] })).toBe("1 session");
  });

  it("counts a series' occurrences, S2's 13 Sundays included", () => {
    const occurrences = Array.from({ length: 13 }, (_, i) => ({
      date: `2027-06-${6 + i}`,
      availability: { status: "open" as const },
      billing: "upcoming" as const,
    }));
    const schedule = {
      date: "2027-06-06",
      start: "08:00",
      end: "09:00",
      recurrence: { frequency: "weekly" as const, weekday: 0, until: "2027-08-29" },
      occurrences,
    };
    expect(sessionCountLabel(schedule)).toBe("13 sessions");
  });
});

describe("weekdayName", () => {
  it("0 is Sunday", () => {
    expect(weekdayName(0)).toBe("Sunday");
    expect(weekdayName(6)).toBe("Saturday");
  });
});

describe("missingFields and primaryButtonReady", () => {
  it("lists every missing required answer, each linked to its step", () => {
    const blank: EventAnswers = { eventType: null, name: "", location: null, schedule: null, attendance: null, addOns: EMPTY_ADDONS };
    expect(missingFields(blank).map((m) => m.key)).toEqual(["type", "name", "place", "date", "attendance"]);
    expect(missingFields(baseAnswers)).toEqual([]);
  });

  it("the primary button is ready only once nothing is missing and the date gate passes", () => {
    const cls = classify(baseAnswers, DEFAULT_CONFIG);
    const gate = dateGate(baseAnswers, cls, ctx);
    expect(primaryButtonReady(baseAnswers, gate)).toBe(true);

    const blank: EventAnswers = { ...baseAnswers, name: "" };
    expect(primaryButtonReady(blank, gate)).toBe(false);

    const failingGate = { ...gate, ok: false };
    expect(primaryButtonReady(baseAnswers, failingGate)).toBe(false);
  });
});

describe("buildResultPanel and the late fee flag", () => {
  it("adds the late-fee line only while the date is really inside the lead time", () => {
    // S1's answers, 19 days out with amplified sound added: Reviewed needs 30.
    const tooClose: EventAnswers = {
      ...baseAnswers,
      addOns: { ...EMPTY_ADDONS, amplifiedSound: true },
      schedule: { date: "2027-05-22", start: "11:00", end: "16:00", occurrences: [] },
    };
    const withFlag = buildResultPanel(tooClose, ctx, { lateFee: true });
    expect(withFlag.fees.lines.some((l) => l.kind === "late_fee")).toBe(true);

    // Pick a date far enough out: the flag no longer costs anything.
    const farEnough: EventAnswers = { ...tooClose, schedule: { ...tooClose.schedule!, date: "2027-07-01" } };
    const farPanel = buildResultPanel(farEnough, ctx, { lateFee: true });
    expect(farPanel.fees.lines.some((l) => l.kind === "late_fee")).toBe(false);
  });
});

describe("dateGateSatisfied", () => {
  it("passes outright when the gate already passes", () => {
    expect(dateGateSatisfied({ ok: true } as never, false)).toBe(true);
  });

  it("a lead-time-only failure clears once the late fee is chosen", () => {
    const gate = { ok: false, availability: { status: "open" } } as never;
    expect(dateGateSatisfied(gate, false)).toBe(false);
    expect(dateGateSatisfied(gate, true)).toBe(true);
  });

  it("a booked or blacked-out date never clears with the late fee alone", () => {
    const booked = { ok: false, availability: { status: "booked" } } as never;
    expect(dateGateSatisfied(booked, true)).toBe(false);
    const blackout = { ok: false, availability: { status: "blackout" } } as never;
    expect(dateGateSatisfied(blackout, true)).toBe(false);
  });
});

describe("groupTasksByPhase", () => {
  it("groups S3's plan cards by phase, in the catalogue's own order, skipping empty phases", () => {
    const cls = classify(S3, DEFAULT_CONFIG);
    const tasks = requirements(S3, cls, { caseId: "PREVIEW", today: TODAY, cfg: DEFAULT_CONFIG });
    const groups = groupTasksByPhase(tasks);
    expect(groups.every((g) => g.tasks.length > 0)).toBe(true);
    const phases = groups.map((g) => g.phase);
    expect(phases).toEqual([...phases].sort((a, b) => phases.indexOf(a) - phases.indexOf(b)));
    expect(groups.flatMap((g) => g.tasks)).toHaveLength(tasks.length);
  });
});
