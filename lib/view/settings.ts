/**
 * Pure view-model for workstream 6A, the City Clerk's Settings tool (/city/settings). No React,
 * no store: the screen reads `useDemo` for `cases` and `cfg` and passes plain values in. Tested
 * against the real seed in settings.test.ts.
 *
 * The "What this changes" panel (tier rules) computes both the before and the after tier with
 * `classify()` itself, from whichever config it is given, rather than trusting a case's stored
 * `tier`. That is deliberate: `setConfig()` does not re-classify the cases already in the store
 * (see the engine request in the Phase 5 log), so a stored tier can be stale the moment the
 * Clerk changes a threshold. Computing fresh from `classify()` means this panel reads right
 * whether or not that engine fix has landed yet.
 */
import { addMonths, format, parseISO } from "date-fns";
import { SCENARIO_JUMPS, type ScenarioKey } from "@/lib/data/demoScript";
import { BLACKOUTS, IMPACTED } from "@/lib/data/calendar";
import { getSpace } from "@/lib/data/inventory";
import { classify } from "@/lib/rules";
import type { FeeSchedule, RulesConfig } from "@/lib/rules/types";
import { TIER_LABEL, type EventCase, type HHmm, type ISODate, type Tier } from "@/lib/types";

/* ------------------------------------------------------------------------ */
/* Tier rules: thresholds and lead times                                    */
/* ------------------------------------------------------------------------ */

export interface TierRulesEdits {
  reviewedAttendance: number;
  specialAttendance: number;
  blockPartyMaxAttendance: number;
  heavyBarricades: number;
  leadTimeDays: Record<Tier, number>;
}

/** The edited fields, read off a config, for a section's local draft state. */
export function tierRulesFromConfig(cfg: RulesConfig): TierRulesEdits {
  return {
    reviewedAttendance: cfg.thresholds.reviewedAttendance,
    specialAttendance: cfg.thresholds.specialAttendance,
    blockPartyMaxAttendance: cfg.thresholds.blockPartyMaxAttendance,
    heavyBarricades: cfg.thresholds.heavyBarricades,
    leadTimeDays: { ...cfg.leadTimeDays },
  };
}

/** `cfg` with the edited thresholds and lead times merged in; everything else unchanged. */
export function applyTierRules(cfg: RulesConfig, edits: TierRulesEdits): RulesConfig {
  return {
    ...cfg,
    thresholds: {
      ...cfg.thresholds,
      reviewedAttendance: edits.reviewedAttendance,
      specialAttendance: edits.specialAttendance,
      blockPartyMaxAttendance: edits.blockPartyMaxAttendance,
      heavyBarricades: edits.heavyBarricades,
    },
    leadTimeDays: { ...edits.leadTimeDays },
  };
}

export interface TierRulesErrors {
  reviewedAttendance?: string;
  specialAttendance?: string;
  blockPartyMaxAttendance?: string;
  heavyBarricades?: string;
  leadTimeDays?: Partial<Record<Tier, string>>;
}

/**
 * The guard rails: Reviewed below Special, every threshold and lead time zero or more, and the
 * lead times ordered Instant through Special. An invalid value is reported here and the screen
 * never calls `setConfig()` with it.
 */
export function validateTierRules(edits: TierRulesEdits): TierRulesErrors {
  const errors: TierRulesErrors = {};
  const nonNegative = (n: number) => Number.isFinite(n) && n >= 0;

  if (!nonNegative(edits.reviewedAttendance)) errors.reviewedAttendance = "Enter 0 or more people.";
  if (!nonNegative(edits.specialAttendance)) errors.specialAttendance = "Enter 0 or more people.";
  if (!nonNegative(edits.blockPartyMaxAttendance)) errors.blockPartyMaxAttendance = "Enter 0 or more people.";
  if (!nonNegative(edits.heavyBarricades)) errors.heavyBarricades = "Enter 0 or more barricades.";

  if (!errors.reviewedAttendance && !errors.specialAttendance && edits.reviewedAttendance >= edits.specialAttendance) {
    errors.reviewedAttendance = "Must be below the Special event threshold.";
  }

  const leadErrors: Partial<Record<Tier, string>> = {};
  const { instant, reviewed, special } = edits.leadTimeDays;
  if (!nonNegative(instant)) leadErrors.instant = "Enter 0 or more days.";
  if (!nonNegative(reviewed)) leadErrors.reviewed = "Enter 0 or more days.";
  if (!nonNegative(special)) leadErrors.special = "Enter 0 or more days.";
  if (!leadErrors.instant && !leadErrors.reviewed && instant > reviewed) {
    leadErrors.reviewed = "Must be at least the Instant lead time.";
  }
  if (!leadErrors.reviewed && !leadErrors.special && reviewed > special) {
    leadErrors.special = "Must be at least the Reviewed lead time.";
  }
  if (Object.keys(leadErrors).length > 0) errors.leadTimeDays = leadErrors;

  return errors;
}

export function tierRulesAreValid(errors: TierRulesErrors): boolean {
  return Object.keys(errors).length === 0;
}

export interface TierChangeRow {
  caseId: string;
  name: string;
  before: Tier;
  after: Tier;
}

/**
 * Every open Draft (not yet submitted, no ending) whose tier would change under `editedCfg`,
 * compared with its tier under `currentCfg`. Both tiers are computed fresh with `classify()`,
 * never read off `case.tier`: see the module note.
 */
export function openDraftTierChanges(cases: EventCase[], currentCfg: RulesConfig, editedCfg: RulesConfig): TierChangeRow[] {
  const rows: TierChangeRow[] = [];
  for (const c of cases) {
    if (c.state !== "draft" || c.ending !== null) continue;
    const before = classify(c, currentCfg).tier;
    const after = classify(c, editedCfg).tier;
    if (before !== after) rows.push({ caseId: c.id, name: c.name, before, after });
  }
  return rows;
}

export interface ScenarioPreviewRow {
  id: ScenarioKey;
  name: string;
  before: Tier;
  after: Tier;
}

/**
 * The Demo menu's six scenarios (S1 to S6), re-classified from their own answers under
 * `currentCfg` and `editedCfg`, so the Clerk sees the edit's effect on every rehearsed case
 * before relying on it. Independent of each case's real state: S5 and S6 are long past Draft,
 * but their answers still tell `classify()` what tier they would get today.
 */
export function scenarioTierPreviews(cases: EventCase[], currentCfg: RulesConfig, editedCfg: RulesConfig): ScenarioPreviewRow[] {
  return SCENARIO_JUMPS.map((jump) => {
    const c = cases.find((x) => x.id === jump.caseId);
    const before = c ? classify(c, currentCfg).tier : "instant";
    const after = c ? classify(c, editedCfg).tier : "instant";
    return { id: jump.id, name: c?.name ?? jump.label, before, after };
  });
}

/** "Jazz in the Plaza: Reviewed, unchanged" or "Jazz in the Plaza: Reviewed → Special". */
export function scenarioPreviewLine(row: ScenarioPreviewRow): string {
  if (row.before === row.after) return `${row.name}: ${TIER_LABEL[row.before]}, unchanged`;
  return `${row.name}: ${TIER_LABEL[row.before]} → ${TIER_LABEL[row.after]}`;
}

/* ------------------------------------------------------------------------ */
/* Fees and deposits                                                         */
/* ------------------------------------------------------------------------ */

export type FeeGroup = "application" | "spaces" | "streets" | "addons" | "staffing" | "deposits";

export const FEE_GROUP_LABEL: Record<FeeGroup, string> = {
  application: "Application fees",
  spaces: "Spaces",
  streets: "Streets and routes",
  addons: "Add-ons",
  staffing: "Staffing and equipment",
  deposits: "Deposits",
};

export interface FeeFieldDef {
  id: string;
  group: FeeGroup;
  label: string;
  unit: string;
  get: (fees: FeeSchedule) => number;
  set: (fees: FeeSchedule, value: number) => FeeSchedule;
}

const FEE_KEY_LABEL: Record<"applicationFee" | "deposit", string> = { applicationFee: "Application fee", deposit: "Deposit" };

function tierField(tier: Tier, group: FeeGroup, key: "applicationFee" | "deposit"): FeeFieldDef {
  return {
    id: `${key}.${tier}`,
    group,
    // Named for the tier it applies to, so "Instant" under Application fees and "Instant"
    // under Deposits read as two different fields, not one repeated three times.
    label: `${FEE_KEY_LABEL[key]}: ${TIER_LABEL[tier]}`,
    unit: "flat",
    get: (fees) => fees[key][tier],
    set: (fees, value) => ({ ...fees, [key]: { ...fees[key], [tier]: value } }),
  };
}

function plainField(id: keyof FeeSchedule, group: FeeGroup, label: string, unit: string): FeeFieldDef {
  return {
    id,
    group,
    label,
    unit,
    get: (fees) => fees[id] as number,
    set: (fees, value) => ({ ...fees, [id]: value }),
  };
}

/** Every rate in `cfg.fees`, grouped the way the Fees and deposits section lists them. */
export const FEE_FIELDS: FeeFieldDef[] = [
  tierField("instant", "application", "applicationFee"),
  tierField("reviewed", "application", "applicationFee"),
  tierField("special", "application", "applicationFee"),
  plainField("shelterPerHour", "spaces", "Shelter", "per hour"),
  plainField("fieldPerHour", "spaces", "Field", "per hour"),
  plainField("cityHallPlazaPerDay", "spaces", "City Hall Plaza", "per day"),
  plainField("greatLawnPerDay", "spaces", "Great Lawn", "per day"),
  plainField("streetClosurePerBlockPerDay", "streets", "Street closure", "per block per day"),
  plainField("routeClosurePerMile", "streets", "Route closure", "per mile"),
  plainField("amplifiedSoundPerDay", "addons", "Amplified sound", "per day"),
  plainField("alcoholLicensePerDay", "addons", "Temporary alcohol license", "per day"),
  plainField("vendorPermitEach", "addons", "Food or vendor permit", "each"),
  plainField("structureInspectionEach", "addons", "Structure fire inspection", "each"),
  plainField("policePerOfficerHour", "staffing", "Police", "per officer-hour"),
  plainField("barricadeEachPerDay", "staffing", "Barricades", "each per day"),
  plainField("cleanupCrewPerWorkerHour", "staffing", "Cleanup crew (actuals only)", "per worker-hour"),
  tierField("instant", "deposits", "deposit"),
  tierField("reviewed", "deposits", "deposit"),
  tierField("special", "deposits", "deposit"),
];

export const FEE_GROUP_ORDER: FeeGroup[] = ["application", "spaces", "streets", "addons", "staffing", "deposits"];

/** `FEE_FIELDS`, split into its groups, each in `FEE_GROUP_ORDER`. */
export function feeFieldsByGroup(): Record<FeeGroup, FeeFieldDef[]> {
  const groups: Record<FeeGroup, FeeFieldDef[]> = { application: [], spaces: [], streets: [], addons: [], staffing: [], deposits: [] };
  for (const field of FEE_FIELDS) groups[field.group].push(field);
  return groups;
}

export function updateFeeField(fees: FeeSchedule, id: string, value: number): FeeSchedule {
  const field = FEE_FIELDS.find((f) => f.id === id);
  if (!field) return fees;
  return field.set(fees, Number.isFinite(value) && value >= 0 ? value : 0);
}

/* ------------------------------------------------------------------------ */
/* Blackout calendar                                                        */
/* ------------------------------------------------------------------------ */

/** A month anchor `offset` months from `iso`, for the Blackout calendar's Prev/Next months. */
export function monthOffset(iso: ISODate, offset: number): ISODate {
  return format(addMonths(parseISO(iso), offset), "yyyy-MM-dd");
}

// `ImpactedDate.zones` is `string[]` (the zones reached through a closed street), not `Zone[]`,
// so this maps by plain string and falls back to the raw id for anything unlisted.
const ZONE_LABEL: Record<string, string> = {
  "riverside-park": "Riverside Park",
  "great-lawn": "Great Lawn",
  downtown: "Downtown",
};

/** A blackout's places, in words: every park, or the spaces it names. */
function placesOf(blackout: { allParks?: boolean; spaceIds?: string[] }): string {
  if (blackout.allParks) return "Every city park";
  return (blackout.spaceIds ?? []).map((id) => getSpace(id)?.label ?? id).join(", ");
}

export interface BlackoutRow {
  date: ISODate;
  label: string;
  places: string;
  from?: HHmm;
}

/** `BLACKOUTS`, with its spaces and zones resolved to names for the list under the month view. */
export function blackoutRows(): BlackoutRow[] {
  return BLACKOUTS.map((b) => ({ date: b.date, label: b.label, places: placesOf(b), from: b.from }));
}

export interface ImpactedRow {
  date: ISODate;
  reason: string;
  places: string;
  from: HHmm;
  to: HHmm;
}

/** `IMPACTED`, with its streets, spaces and zones joined into one "which places" line. */
export function impactedRows(): ImpactedRow[] {
  return IMPACTED.map((i) => {
    const places = [...i.streets, ...i.spaceIds.map((id) => getSpace(id)?.label ?? id), ...i.zones.map((z) => ZONE_LABEL[z] ?? z)];
    return { date: i.date, reason: i.reason, places: places.join(", "), from: i.from, to: i.to };
  });
}
