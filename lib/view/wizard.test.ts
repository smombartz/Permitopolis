import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, requirements, classify, dateGate, type RulesCtx } from "@/lib/rules";
import { buildSeed } from "@/lib/state";
import { EMPTY_ADDONS, type EventAnswers, type EventCase } from "@/lib/types";
import {
  WIZARD_STEPS,
  addOnEffectText,
  buildResultPanel,
  dateGateSatisfied,
  eventRecap,
  EVENT_TYPES,
  furthestAnsweredStep,
  groupTasksByPhase,
  isWizardStep,
  dateGateAnnouncement,
  lateFeeCarriesDate,
  leadTimeGapText,
  missingFields,
  nextWizardStep,
  previousWizardStep,
  primaryButtonReady,
  removeAddOnForTrigger,
  repeatsByDefault,
  resolveWizardStep,
  scheduleOnDate,
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

/** S2 as it stands once booked: a permitted series, which is what holds a slot. */
function S2Booked(): EventCase {
  return { ...caseById("PMT-27-0142"), state: "permitted", permit: { issuedOn: TODAY, signature: null } };
}

const S3 = caseById("PMT-27-0118"); // Jazz in the Plaza: Standard
const S4 = caseById("PMT-27-0126"); // Maple Street block party: Standard through exception
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
  it("offers Other as the last type", () => {
    expect(EVENT_TYPES.at(-1)).toBe("other");
  });

  it("a market or festival with no add-ons yet reads like any other type: no food vendor, no Health & Legal", () => {
    const market = buildResultPanel({ ...baseAnswers, eventType: "market_festival" }, ctx);
    const picnic = buildResultPanel(baseAnswers, ctx);
    expect(market.triggers.map((t) => t.id)).not.toContain("food_vending");
    expect(market.tier).toBe(picnic.tier);
    expect(market.reviewers).toEqual(picnic.reviewers);
  });

  it("only a class or club meetup repeats by default", () => {
    expect(repeatsByDefault("class_meetup")).toBe(true);
    expect(repeatsByDefault("picnic_party")).toBe(false);
    expect(repeatsByDefault(null)).toBe(false);
  });
});

describe("eventRecap", () => {
  it("a blank wizard has no type, no name and nothing answered", () => {
    const recap = eventRecap({ eventType: null, name: "  ", location: null, schedule: null, attendance: null, addOns: EMPTY_ADDONS });
    expect(recap).toMatchObject({ eventType: null, name: null, description: null });
    expect(recap.rows.map((r) => r.label)).toEqual(["Place", "Date and hours", "Attendance", "Add-ons"]);
    expect(recap.rows.every((r) => r.value === null)).toBe(true);
  });

  it("carries step 1's type, name and description, and each later answer", () => {
    const recap = eventRecap({ ...baseAnswers, eventType: "other", description: " A book swap " });
    expect(recap).toMatchObject({ eventType: "other", name: "Smith family reunion", description: "A book swap" });
    expect(Object.fromEntries(recap.rows.map((r) => [r.label, r.value]))).toEqual({
      Place: "Shelter 2, Riverside Park",
      "Date and hours": "Sat, Jun 19, 2027, 11 am to 4 pm",
      Attendance: "40",
      "Add-ons": "None",
    });
  });

  it("lists a series' sessions and the add-ons chosen on step 4", () => {
    const recap = eventRecap(S2Booked());
    expect(recap.rows.map((r) => r.label)).toContain("Sessions");
    const withVendors = eventRecap({ ...baseAnswers, addOns: { ...EMPTY_ADDONS, foodVending: { vendors: 3 } } });
    expect(withVendors.rows.find((r) => r.label === "Add-ons")?.value).toBe("3 food vendors");
  });
});

describe("buildResultPanel, against the PRD's acceptance rows", () => {
  it("S3: Standard, 30-day lead time, Public Works & Safety and Health & Legal, $715 including the deposit", () => {
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

  it("a 40-person picnic at a shelter with alcohol is Standard; turning alcohol off is Instant", () => {
    const withAlcohol: EventAnswers = { ...baseAnswers, addOns: { ...EMPTY_ADDONS, alcohol: true } };
    const panel = buildResultPanel(withAlcohol, ctx);
    expect(panel.tier).toBe("reviewed");
    expect(panel.whatIf.map((w) => w.triggerId)).toContain("alcohol");

    const without = removeAddOnForTrigger(withAlcohol.addOns, "alcohol");
    expect(buildResultPanel({ ...withAlcohol, addOns: without }, ctx).tier).toBe("instant");
  });

  it("S4's exact answers give Standard through the block-party exception", () => {
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

describe("furthestAnsweredStep: how far the stepper's edit links reach on the answers alone", () => {
  it("is the last of steps 1 to 4 holding an answer, and never the plan", () => {
    const blank: EventAnswers = { eventType: null, name: "", location: null, schedule: null, attendance: null, addOns: EMPTY_ADDONS };
    expect(furthestAnsweredStep(blank)).toBe(wizardStepIndex("what"));
    expect(furthestAnsweredStep({ ...blank, location: baseAnswers.location })).toBe(wizardStepIndex("where"));
    expect(furthestAnsweredStep({ ...blank, schedule: baseAnswers.schedule })).toBe(wizardStepIndex("when"));
    // A size typed before the place was chosen still counts: Size has been reached.
    expect(furthestAnsweredStep({ ...blank, attendance: 40 })).toBe(wizardStepIndex("size"));
    expect(furthestAnsweredStep(baseAnswers)).toBe(wizardStepIndex("size"));
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
    // S1's answers, 19 days out with amplified sound added: Standard needs 30.
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
  // S1's answers, 19 days out with amplified sound added: Standard needs 30 (same case
  // lateFeeCarriesDate uses below), so the gate really does offer the late fee as a fix.
  const tooClose: EventAnswers = {
    ...baseAnswers,
    addOns: { ...EMPTY_ADDONS, amplifiedSound: true },
    schedule: { date: "2027-05-22", start: "11:00", end: "16:00", occurrences: [] },
  };

  it("passes outright when the gate already passes", () => {
    const gate = dateGate(baseAnswers, classify(baseAnswers, DEFAULT_CONFIG), ctx);
    expect(gate.ok).toBe(true);
    expect(dateGateSatisfied(gate, false)).toBe(true);
  });

  it("a lead-time-only failure clears once the late fee is chosen", () => {
    const gate = buildResultPanel(tooClose, ctx).dateGate;
    expect(gate.fixes).toContain("late_fee");
    expect(dateGateSatisfied(gate, false)).toBe(false);
    expect(dateGateSatisfied(gate, true)).toBe(true);
  });

  it("a booked or blacked-out date never clears with the late fee alone", () => {
    // Shelter 2 is blacked out on this date in the seed (see the readme, "Where the seed
    // differs from the PRD's wording"); the gate then offers only a new date.
    const blackedOut: EventAnswers = {
      ...baseAnswers,
      location: { mode: "inventory", inventoryIds: ["shelter-2"], segmentIds: [], capacity: 40, label: "Shelter 2, Riverside Park" },
      schedule: { date: "2027-05-31", start: "11:00", end: "16:00", occurrences: [] },
    };
    const gate = buildResultPanel(blackedOut, ctx).dateGate;
    expect(gate.availability.status).toBe("blackout");
    expect(gate.fixes).not.toContain("late_fee");
    expect(dateGateSatisfied(gate, true)).toBe(false);
  });

  it("a date already in the past never clears with the late fee, even though nothing else is wrong with it", () => {
    // Regression: the old check read the availability status alone and missed
    // `cfg.lateFee.minDaysBeforeEvent`, so a stale or back-dated draft with the flag still on
    // could slip through even though the real gate never offers the fee for it.
    const inThePast: EventAnswers = { ...tooClose, schedule: { ...tooClose.schedule!, date: "2027-04-01" } };
    const gate = buildResultPanel(inThePast, ctx).dateGate;
    expect(gate.daysUntil).toBeLessThan(0);
    expect(gate.fixes).not.toContain("late_fee");
    expect(dateGateSatisfied(gate, true)).toBe(false);
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

describe("leadTimeGapText", () => {
  it("says how many days are left and how many are needed, in the PRD's words", () => {
    expect(leadTimeGapText(19, 30)).toBe("19 days left, 30 needed. This event needs 11 more days of notice than it has.");
    expect(leadTimeGapText(29, 30)).toBe("29 days left, 30 needed. This event needs 1 more day of notice than it has.");
    expect(leadTimeGapText(1, 10)).toBe("1 day left, 10 needed. This event needs 9 more days of notice than it has.");
  });

  it("a Standard event 19 days out really is 19 days away with 30 needed", () => {
    const answers: EventAnswers = { ...baseAnswers, addOns: { ...EMPTY_ADDONS, amplifiedSound: true }, schedule: { date: "2027-05-22", start: "11:00", end: "16:00", occurrences: [] } };
    const panel = buildResultPanel(answers, ctx);
    expect(panel.dateGate.daysUntil).toBe(19);
    expect(panel.leadTimeDays).toBe(30);
    expect(leadTimeGapText(panel.dateGate.daysUntil, panel.leadTimeDays)).toMatch(/^19 days left, 30 needed\./);
  });

  it("a date already gone says so", () => {
    expect(leadTimeGapText(-2, 10)).toBe("That date has passed. This event needs 10 days of notice.");
  });
});

describe("scheduleOnDate", () => {
  const sundays = { date: "2027-06-06", start: "08:00", end: "09:00", recurrence: { frequency: "weekly" as const, weekday: 0, until: "2027-08-29" }, occurrences: [] };

  it("a series moved to a Saturday repeats on Saturdays and keeps an end date that is still ahead", () => {
    const moved = scheduleOnDate(sundays, "2027-06-12", "class_meetup");
    expect(moved.date).toBe("2027-06-12");
    expect(moved.recurrence).toEqual({ frequency: "weekly", weekday: 6, until: "2027-08-29" });
    expect(weekdayName(moved.recurrence!.weekday)).toBe("Saturday");
  });

  it("a series moved past its end date gets a new end, the default distance out", () => {
    const moved = scheduleOnDate(sundays, "2027-09-04", "class_meetup");
    expect(moved.recurrence?.weekday).toBe(6);
    expect(moved.recurrence?.until).toBe("2027-11-20");
  });

  it("a moved series still holds its slot for other applicants", () => {
    const moved = { ...S2Booked(), schedule: scheduleOnDate(S2Booked().schedule, "2027-06-12", "class_meetup") };
    const others: RulesCtx = { ...ctx, cases: [...seed.filter((c) => c.id !== moved.id), moved] };
    const rival: EventAnswers = { ...baseAnswers, location: moved.location, schedule: { date: "2027-06-19", start: moved.schedule!.start, end: moved.schedule!.end, occurrences: [] } };
    const gate = dateGate(rival, classify(rival, DEFAULT_CONFIG), others);
    expect(gate.availability.status).toBe("booked");
  });

  it("a single event stays single; a class or club meetup repeats from its first date", () => {
    expect(scheduleOnDate(null, "2027-06-19", "picnic_party").recurrence).toBeUndefined();
    expect(scheduleOnDate(null, "2027-06-19", "class_meetup").recurrence).toEqual({ frequency: "weekly", weekday: 6, until: "2027-09-04" });
    const single = { date: "2027-06-19", start: "11:00", end: "16:00", occurrences: [] };
    expect(scheduleOnDate(single, "2027-06-26", "class_meetup").recurrence).toBeUndefined();
  });
});

describe("lateFeeCarriesDate", () => {
  const tooClose: EventAnswers = { ...baseAnswers, addOns: { ...EMPTY_ADDONS, amplifiedSound: true }, schedule: { date: "2027-05-22", start: "11:00", end: "16:00", occurrences: [] } };

  it("is true only when the fee was chosen and the gate offers it", () => {
    const gate = buildResultPanel(tooClose, ctx).dateGate;
    expect(gate.fixes).toContain("late_fee");
    expect(lateFeeCarriesDate(gate, false)).toBe(false);
    expect(lateFeeCarriesDate(gate, true)).toBe(true);
  });

  it("is false once the date passes on its own", () => {
    const later: EventAnswers = { ...tooClose, schedule: { ...tooClose.schedule!, date: "2027-06-19" } };
    expect(lateFeeCarriesDate(buildResultPanel(later, ctx).dateGate, true)).toBe(false);
  });
});

describe("dateGateAnnouncement: what the wizard's status line says when the gate changes", () => {
  const tooClose: EventAnswers = { ...baseAnswers, addOns: { ...EMPTY_ADDONS, amplifiedSound: true }, schedule: { date: "2027-05-22", start: "11:00", end: "16:00", occurrences: [] } };

  it("says nothing while the gate passes", () => {
    const panel = buildResultPanel(baseAnswers, ctx);
    expect(panel.dateGate.ok).toBe(true);
    expect(dateGateAnnouncement(panel.dateGate, panel.leadTimeDays, false)).toBe("");
  });

  it("a date that is too close is said in the banner's own words", () => {
    const panel = buildResultPanel(tooClose, ctx);
    expect(dateGateAnnouncement(panel.dateGate, panel.leadTimeDays, false)).toBe("19 days left, 30 needed. This event needs 11 more days of notice than it has.");
  });

  it("the late fee, once it carries the date, is said in place of the gap", () => {
    const panel = buildResultPanel(tooClose, ctx, { lateFee: true });
    expect(dateGateAnnouncement(panel.dateGate, panel.leadTimeDays, true)).toMatch(/^A \$[\d,.]+ late fee is added, so this date can stand\.$/);
  });

  it("a blacked-out date says why, and the late fee does not change that", () => {
    const blackedOut: EventAnswers = {
      ...baseAnswers,
      location: { mode: "inventory", inventoryIds: ["shelter-2"], segmentIds: [], capacity: 40, label: "Shelter 2, Riverside Park" },
      schedule: { date: "2027-05-31", start: "11:00", end: "16:00", occurrences: [] },
    };
    const panel = buildResultPanel(blackedOut, ctx);
    const said = dateGateAnnouncement(panel.dateGate, panel.leadTimeDays, true);
    expect(said).toBe(`That date isn't available: ${panel.dateGate.availability.reason}.`);
    expect(said).not.toMatch(/\.\.$/);
  });
});
