import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/state";
import { makeCase } from "@/lib/state/testSupport";
import { DEFAULT_CONFIG } from "@/lib/rules";
import { EMPTY_ADDONS } from "@/lib/types";
import {
  FEE_FIELDS,
  applyTierRules,
  blackoutRows,
  feeFieldsByGroup,
  impactedRows,
  monthOffset,
  openDraftTierChanges,
  scenarioPreviewLine,
  scenarioTierPreviews,
  tierRulesAreValid,
  tierRulesFromConfig,
  updateFeeField,
  validateTierRules,
} from "./settings";

const cases = buildSeed();

describe("tierRulesFromConfig / applyTierRules", () => {
  it("round-trips the default config's thresholds and lead times", () => {
    const edits = tierRulesFromConfig(DEFAULT_CONFIG);
    expect(edits).toEqual({
      reviewedAttendance: 100,
      specialAttendance: 1000,
      blockPartyMaxAttendance: 250,
      heavyBarricades: 20,
      leadTimeDays: { instant: 10, reviewed: 30, special: 60 },
    });
  });

  it("applies the edits without touching the rest of the config", () => {
    const edits = { ...tierRulesFromConfig(DEFAULT_CONFIG), reviewedAttendance: 40 };
    const next = applyTierRules(DEFAULT_CONFIG, edits);
    expect(next.thresholds.reviewedAttendance).toBe(40);
    expect(next.thresholds.specialAttendance).toBe(1000);
    expect(next.fees).toBe(DEFAULT_CONFIG.fees);
    expect(next.sla).toBe(DEFAULT_CONFIG.sla);
  });
});

describe("validateTierRules", () => {
  const valid = tierRulesFromConfig(DEFAULT_CONFIG);

  it("passes the defaults", () => {
    const errors = validateTierRules(valid);
    expect(tierRulesAreValid(errors)).toBe(true);
  });

  it("rejects Reviewed at or above Special", () => {
    const errors = validateTierRules({ ...valid, reviewedAttendance: 1000, specialAttendance: 1000 });
    expect(errors.reviewedAttendance).toMatch(/below the Special/);
    expect(tierRulesAreValid(errors)).toBe(false);
  });

  it("rejects a negative threshold", () => {
    const errors = validateTierRules({ ...valid, blockPartyMaxAttendance: -5 });
    expect(errors.blockPartyMaxAttendance).toMatch(/0 or more/);
  });

  it("rejects lead times out of order", () => {
    const errors = validateTierRules({ ...valid, leadTimeDays: { instant: 40, reviewed: 30, special: 60 } });
    expect(errors.leadTimeDays?.reviewed).toMatch(/Instant/);
  });

  it("rejects a negative lead time", () => {
    const errors = validateTierRules({ ...valid, leadTimeDays: { instant: -1, reviewed: 30, special: 60 } });
    expect(errors.leadTimeDays?.instant).toMatch(/0 or more/);
  });
});

describe("scenarioTierPreviews, against the real seed", () => {
  it("S3 Jazz in the Plaza stays Reviewed when the Reviewed threshold drops to 40 (its own plaza trigger holds it there)", () => {
    const edited = applyTierRules(DEFAULT_CONFIG, { ...tierRulesFromConfig(DEFAULT_CONFIG), reviewedAttendance: 40 });
    const rows = scenarioTierPreviews(cases, DEFAULT_CONFIG, edited);
    const s3 = rows.find((r) => r.id === "S3")!;
    expect(s3.name).toBe("Jazz in the Plaza");
    expect(s3.before).toBe("reviewed");
    expect(s3.after).toBe("reviewed");
    expect(scenarioPreviewLine(s3)).toBe("Jazz in the Plaza: Reviewed, unchanged");
  });

  it("S1 Maya Chen's 45-guest picnic moves from Instant to Reviewed when the Reviewed threshold drops to 40", () => {
    const edited = applyTierRules(DEFAULT_CONFIG, { ...tierRulesFromConfig(DEFAULT_CONFIG), reviewedAttendance: 40 });
    const rows = scenarioTierPreviews(cases, DEFAULT_CONFIG, edited);
    const s1 = rows.find((r) => r.id === "S1")!;
    expect(s1.name).toBe("Maya Chen's 40th birthday picnic");
    expect(s1.before).toBe("instant");
    expect(s1.after).toBe("reviewed");
    expect(scenarioPreviewLine(s1)).toBe("Maya Chen's 40th birthday picnic: Instant → Reviewed");
  });

  // The brief for this workstream also expects "raising Special to 1,500 moves the 5K preview
  // to Reviewed" (S5, Riverfront Summer 5K). Against the real seed this does not happen: S5's
  // answers carry a route (always a Special trigger) and police staffing (always a
  // heavy-resources trigger), so it stays Special however high the attendance threshold goes.
  // Recorded here so the panel's real behavior is pinned down, and the mechanism itself is
  // proven in `openDraftTierChanges` below with a case that isolates the attendance trigger.
  it("S5 Riverfront Summer 5K stays Special when the Special threshold rises to 1,500 (its route and police staffing still trigger it)", () => {
    const edited = applyTierRules(DEFAULT_CONFIG, { ...tierRulesFromConfig(DEFAULT_CONFIG), specialAttendance: 1500 });
    const rows = scenarioTierPreviews(cases, DEFAULT_CONFIG, edited);
    const s5 = rows.find((r) => r.id === "S5")!;
    expect(s5.name).toBe("Riverfront Summer 5K");
    expect(s5.before).toBe("special");
    expect(s5.after).toBe("special");
  });

  it("previews every one of the six Demo menu scenarios", () => {
    const rows = scenarioTierPreviews(cases, DEFAULT_CONFIG, DEFAULT_CONFIG);
    expect(rows.map((r) => r.id)).toEqual(["S1", "S2", "S3", "S4", "S5", "S6"]);
    expect(rows.every((r) => r.before === r.after)).toBe(true);
  });
});

describe("openDraftTierChanges", () => {
  it("lists nothing when the edited config classifies every open Draft the same way", () => {
    expect(openDraftTierChanges(cases, DEFAULT_CONFIG, DEFAULT_CONFIG)).toEqual([]);
  });

  it("moves a 45-person open Draft from Instant to Reviewed when the Reviewed threshold drops to 40", () => {
    const draft = makeCase({ id: "PMT-27-TEST1", name: "A 45-guest picnic draft", state: "draft", attendance: 45, location: null, addOns: EMPTY_ADDONS });
    const edited = applyTierRules(DEFAULT_CONFIG, { ...tierRulesFromConfig(DEFAULT_CONFIG), reviewedAttendance: 40 });
    const rows = openDraftTierChanges([draft], DEFAULT_CONFIG, edited);
    expect(rows).toEqual([{ caseId: "PMT-27-TEST1", name: "A 45-guest picnic draft", before: "instant", after: "reviewed" }]);
  });

  // Isolates the mechanism the brief's "5K" example describes: a crowd of 1,200 with no street,
  // route or other Special trigger is Special on attendance alone, so raising the Special
  // threshold past it drops the draft to Reviewed.
  it("moves a 1,200-person open Draft with no other trigger from Special to Reviewed when the Special threshold rises to 1,500", () => {
    const draft = makeCase({ id: "PMT-27-TEST2", name: "A 1,200-runner 5K draft", state: "draft", attendance: 1200, location: null, addOns: EMPTY_ADDONS });
    const edited = applyTierRules(DEFAULT_CONFIG, { ...tierRulesFromConfig(DEFAULT_CONFIG), specialAttendance: 1500 });
    const rows = openDraftTierChanges([draft], DEFAULT_CONFIG, edited);
    expect(rows).toEqual([{ caseId: "PMT-27-TEST2", name: "A 1,200-runner 5K draft", before: "special", after: "reviewed" }]);
  });

  it("ignores a Draft with an ending, and a case that is not a Draft", () => {
    const withdrawn = makeCase({ id: "PMT-27-TEST3", state: "draft", ending: "withdrawn", attendance: 45, location: null, addOns: EMPTY_ADDONS });
    const submitted = makeCase({ id: "PMT-27-TEST4", state: "submitted", attendance: 45, location: null, addOns: EMPTY_ADDONS, tier: "instant" });
    const edited = applyTierRules(DEFAULT_CONFIG, { ...tierRulesFromConfig(DEFAULT_CONFIG), reviewedAttendance: 40 });
    expect(openDraftTierChanges([withdrawn, submitted], DEFAULT_CONFIG, edited)).toEqual([]);
  });

  it("every open Draft on the real seed is unaffected by the defaults (a no-op edit changes nothing)", () => {
    expect(openDraftTierChanges(cases, DEFAULT_CONFIG, DEFAULT_CONFIG)).toEqual([]);
  });
});

describe("fees: feeFieldsByGroup / updateFeeField", () => {
  it("groups every fee field exactly once", () => {
    const groups = feeFieldsByGroup();
    const total = Object.values(groups).reduce((sum, fields) => sum + fields.length, 0);
    expect(total).toBe(FEE_FIELDS.length);
    expect(groups.application.map((f) => f.id)).toEqual(["applicationFee.instant", "applicationFee.reviewed", "applicationFee.special"]);
    expect(groups.deposits.map((f) => f.id)).toEqual(["deposit.instant", "deposit.reviewed", "deposit.special"]);
  });

  it("updates one field and leaves the rest of the schedule untouched", () => {
    const next = updateFeeField(DEFAULT_CONFIG.fees, "policePerOfficerHour", 95);
    expect(next.policePerOfficerHour).toBe(95);
    expect(next.barricadeEachPerDay).toBe(DEFAULT_CONFIG.fees.barricadeEachPerDay);
    expect(DEFAULT_CONFIG.fees.policePerOfficerHour).toBe(85); // the input is never mutated
  });

  it("updates a tiered field (application fee, deposit) by tier", () => {
    const next = updateFeeField(DEFAULT_CONFIG.fees, "applicationFee.special", 300);
    expect(next.applicationFee).toEqual({ instant: 0, reviewed: 50, special: 300 });
  });

  it("names a tiered field for its fee kind and tier, so Instant reads differently under each", () => {
    const groups = feeFieldsByGroup();
    expect(groups.application.map((f) => f.label)).toEqual(["Application fee: Instant", "Application fee: Reviewed", "Application fee: Special event"]);
    expect(groups.deposits.map((f) => f.label)).toEqual(["Deposit: Instant", "Deposit: Reviewed", "Deposit: Special event"]);
  });

  it("clamps a negative or non-finite entry to 0", () => {
    expect(updateFeeField(DEFAULT_CONFIG.fees, "fieldPerHour", -10).fieldPerHour).toBe(0);
    expect(updateFeeField(DEFAULT_CONFIG.fees, "fieldPerHour", Number.NaN).fieldPerHour).toBe(0);
  });

  it("is a no-op for an unknown field id", () => {
    expect(updateFeeField(DEFAULT_CONFIG.fees, "not_a_field", 10)).toBe(DEFAULT_CONFIG.fees);
  });
});

describe("blackoutRows / impactedRows", () => {
  it("resolves a park-wide blackout to 'Every city park'", () => {
    const rows = blackoutRows();
    const memorialDay = rows.find((r) => r.date === "2027-05-31")!;
    expect(memorialDay.places).toBe("Every city park");
  });

  it("resolves a blackout's space ids to their labels", () => {
    const rows = blackoutRows();
    const fireworks = rows.find((r) => r.date === "2027-07-04")!;
    expect(fireworks.places).toBe("City Hall Plaza, Great Lawn");
    expect(fireworks.from).toBe("16:00");
  });

  it("resolves an impacted date's streets, spaces and zones into one line", () => {
    const rows = impactedRows();
    const fiveK = rows.find((r) => r.date === "2027-07-11")!;
    expect(fiveK.places).toBe("Main Street, River Road, City Hall Plaza, Riverside Park");
    expect(fiveK.reason).toMatch(/Riverfront Summer 5K/);
  });
});

describe("monthOffset", () => {
  it("moves forward and back a whole month, keeping the day of month", () => {
    expect(monthOffset("2027-05-03", 1)).toBe("2027-06-03");
    expect(monthOffset("2027-05-03", -1)).toBe("2027-04-03");
    expect(monthOffset("2027-05-03", 0)).toBe("2027-05-03");
  });
});
