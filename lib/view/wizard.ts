/**
 * Pure view-model for the applicant wizard (`/apply`). No React, no store: the screen reads
 * `useDemo` selectors and the pure functions in `@/lib/rules`, and calls these to turn that
 * into what steps 1 to 5 show. Tested against the real seed in wizard.test.ts.
 */
import { fmtMoney, plural } from "@/lib/format";
import { getSpace } from "@/lib/data/inventory";
import {
  capacityWarning,
  classify,
  dateGate,
  estimateFees,
  whatIf,
  type Classification,
  type DateGate,
  type FeeEstimate,
  type CapacityWarning,
  type RulesConfig,
  type RulesCtx,
  type WhatIf,
} from "@/lib/rules";
import type {
  AddOns,
  CityServices,
  EventAnswers,
  EventType,
  Location,
  Schedule,
  Task,
  TaskPhase,
  Trigger,
  TriggerId,
  WizardStep,
} from "@/lib/types";

/* ---------- step order ---------- */

export const WIZARD_STEPS: readonly WizardStep[] = ["what", "where", "when", "size", "plan"];

export const WIZARD_STEP_LABEL: Record<WizardStep, string> = {
  what: "What",
  where: "Where",
  when: "When",
  size: "Size",
  plan: "Plan",
};

export function isWizardStep(value: string | null | undefined): value is WizardStep {
  return value != null && (WIZARD_STEPS as readonly string[]).includes(value);
}

/** The step a URL's `?step=` names, or `fallback` when it is missing or not a real step. */
export function resolveWizardStep(value: string | null | undefined, fallback: WizardStep): WizardStep {
  return isWizardStep(value) ? value : fallback;
}

export function wizardStepIndex(step: WizardStep): number {
  return WIZARD_STEPS.indexOf(step);
}

export function nextWizardStep(step: WizardStep): WizardStep | null {
  const i = wizardStepIndex(step);
  return i < WIZARD_STEPS.length - 1 ? WIZARD_STEPS[i + 1] : null;
}

export function previousWizardStep(step: WizardStep): WizardStep | null {
  const i = wizardStepIndex(step);
  return i > 0 ? WIZARD_STEPS[i - 1] : null;
}

/* ---------- step 1: event type ---------- */

export const EVENT_TYPES: EventType[] = [
  "picnic_party",
  "performance_rally",
  "market_festival",
  "race_parade",
  "block_party",
  "class_meetup",
];

/**
 * What picking an event type pre-fills besides the map mode, which `LocationPicker` already
 * starts on the right tab for from its own `eventType` prop. A market or festival turns on
 * food or vending, with one vendor to start; nothing is overwritten once the applicant has
 * set it themselves.
 */
export function addOnsForEventType(eventType: EventType, current: AddOns): AddOns {
  if (eventType === "market_festival" && current.foodVending === null) {
    return { ...current, foodVending: defaultFoodVending() };
  }
  return current;
}

/** A class or club meetup turns on Repeat by default, before the applicant has touched it. */
export function repeatsByDefault(eventType: EventType | null): boolean {
  return eventType === "class_meetup";
}

/* ---------- add-on defaults, for a toggle just switched on ---------- */

export function defaultFoodVending(): NonNullable<AddOns["foodVending"]> {
  return { vendors: 1, vendorNames: [] };
}

export function defaultTentsStages(): NonNullable<AddOns["tentsStages"]> {
  return { count: 1 };
}

export function defaultCityServices(): CityServices {
  return { barricades: 0, trash: false, power: false, policeOfficers: 0, policeHours: 0 };
}

/** A single bookable space as a `Location`, for the capacity warning's suggested space button. */
export function locationForSpace(id: string): Location {
  const space = getSpace(id);
  return { mode: "inventory", inventoryIds: [id], segmentIds: [], capacity: space?.capacity, label: space?.label ?? id };
}

/* ---------- the live result panel (every step) ---------- */

export interface ResultPanel {
  tier: Classification["tier"];
  summary: string;
  triggers: Trigger[];
  whatIf: WhatIf[];
  leadTimeDays: number;
  dateGate: DateGate;
  components: Classification["components"];
  reviewers: Classification["reviewers"];
  fees: FeeEstimate;
  capacityWarning: CapacityWarning | null;
}

/**
 * Recomputes everything the panel shows from the answers as they stand, the way the PRD asks:
 * classify(), whatIf(), estimateFees() and dateGate(), all from the same answers so nothing
 * can disagree. `lateFee` is the applicant's own choice at the date gate (`flags.lateFee` on a
 * real draft); `ignoreCaseId` keeps a draft from blocking its own slot once it exists.
 */
export function buildResultPanel(
  answers: EventAnswers,
  ctx: RulesCtx,
  options: { lateFee?: boolean; ignoreCaseId?: string } = {},
): ResultPanel {
  const cls = classify(answers, ctx.cfg);
  const gate = dateGate(answers, cls, ctx, options.ignoreCaseId);
  // Mirrors `lateFeeApplies()` in lib/state/checks.ts: the flag only costs anything while the
  // date really is inside the lead time, so a flag left on after a later date is picked (or
  // before any date is chosen) carries no fee line.
  const lateFeeApplies = !!options.lateFee && !gate.leadTimeOk;
  const fees = estimateFees(answers, cls, ctx.cfg, { lateFee: lateFeeApplies, caseId: options.ignoreCaseId });
  return {
    tier: cls.tier,
    summary: cls.summary,
    triggers: cls.triggers,
    whatIf: whatIf(answers, ctx.cfg),
    leadTimeDays: cls.leadTimeDays,
    dateGate: gate,
    components: cls.components,
    reviewers: cls.reviewers,
    fees,
    capacityWarning: capacityWarning(answers),
  };
}

/* ---------- dropping an add-on (what-if, and the date gate's "drop an add-on" fix) ---------- */

/** Mirrors `classify.ts`'s own counterfactual: the add-on fields a trigger id turns off. */
export function removeAddOnForTrigger(addOns: AddOns, id: TriggerId): AddOns {
  switch (id) {
    case "amplified_sound":
      return { ...addOns, amplifiedSound: false };
    case "alcohol":
      return { ...addOns, alcohol: false };
    case "food_vending":
      return { ...addOns, foodVending: null };
    case "tents_stages":
      return { ...addOns, tentsStages: null };
    case "cooking_generators":
      return { ...addOns, cookingGenerators: false };
    case "admission":
      return { ...addOns, admission: false };
    case "city_services":
      return { ...addOns, cityServices: null };
    case "fireworks_drones":
      return { ...addOns, fireworksDrones: false };
    default:
      return addOns;
  }
}

const TRIGGER_DROP_LABEL: Partial<Record<TriggerId, string>> = {
  fireworks_drones: "fireworks or drones",
  amplified_sound: "amplified sound",
  alcohol: "alcohol",
  food_vending: "food or vending",
  tents_stages: "tents or stages",
  cooking_generators: "cooking or generators",
  admission: "admission",
  city_services: "city services",
};

/** "amplified sound", for "Drop amplified sound" and "Remove amplified sound: Instant, book today". */
export function triggerDropLabel(id: TriggerId): string {
  return TRIGGER_DROP_LABEL[id] ?? id;
}

/* ---------- step 4: add-on effect copy, from the rules and the config ---------- */

export type AddOnKey =
  | "amplifiedSound"
  | "alcohol"
  | "foodVending"
  | "tentsStages"
  | "cookingGenerators"
  | "fireworksDrones"
  | "admission"
  | "cityServices";

/** "Adds a sound approval, reviewed by Public Works & Safety, $40": one line per add-on toggle. */
export function addOnEffectText(key: AddOnKey, cfg: RulesConfig): string {
  const fees = cfg.fees;
  switch (key) {
    case "amplifiedSound":
      return `Adds a sound approval, reviewed by Public Works & Safety, ${fmtMoney(fees.amplifiedSoundPerDay)}`;
    case "alcohol":
      return `Adds a temporary alcohol license, reviewed by City Clerk and Public Works & Safety, ${fmtMoney(fees.alcoholLicensePerDay)}`;
    case "foodVending":
      return `Adds a food or vendor permit per vendor, reviewed by Health & Legal, ${fmtMoney(fees.vendorPermitEach)} each`;
    case "tentsStages":
      return `Adds a structure and fire inspection per structure, reviewed by Public Works & Safety, ${fmtMoney(fees.structureInspectionEach)} each`;
    case "cookingGenerators":
      return "Adds a structure and fire review, reviewed by Public Works & Safety";
    case "fireworksDrones":
      return "Adds a fireworks or drone safety review, reviewed by Public Works & Safety. Raises the tier to Special";
    case "admission":
      return "Adds admission tracking, reviewed by City Clerk";
    case "cityServices":
      return "Adds a city services request (barricades, trash, power, police), reviewed by Public Works & Safety";
  }
}

/* ---------- step 3: sessions and the weekday ---------- */

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function weekdayName(weekday: number): string {
  return WEEKDAY_NAMES[weekday] ?? "";
}

/** "13 sessions", "1 session": every date on the schedule, skipped ones included. */
export function sessionCountLabel(schedule: Schedule): string {
  const count = schedule.recurrence ? schedule.occurrences.length || 1 : 1;
  return plural(count, "session");
}

/* ---------- missing answers (Next is never blocked; step 5 and the primary button are) ---------- */

export type MissingFieldKey = "type" | "name" | "place" | "date" | "attendance";

export interface MissingField {
  key: MissingFieldKey;
  label: string;
  step: WizardStep;
}

/** What step 5 lists as still missing, each linking back to the step that collects it. */
export function missingFields(answers: EventAnswers): MissingField[] {
  const missing: MissingField[] = [];
  if (!answers.eventType) missing.push({ key: "type", label: "Event type", step: "what" });
  if (!answers.name.trim()) missing.push({ key: "name", label: "Event name", step: "what" });
  if (!answers.location) missing.push({ key: "place", label: "Where it happens", step: "where" });
  if (!answers.schedule) missing.push({ key: "date", label: "Date", step: "when" });
  if (answers.attendance === null) missing.push({ key: "attendance", label: "Expected attendance", step: "size" });
  return missing;
}

/**
 * The gate passes outright, or it failed only on the lead time (never on a booked or
 * blacked-out date) and the applicant chose to pay the late fee: `book_and_pay` and `submit`
 * let a late date through exactly this way (see the readme, "How the engine behaves").
 */
export function dateGateSatisfied(gate: DateGate, lateFee: boolean): boolean {
  if (gate.ok) return true;
  if (!lateFee) return false;
  return gate.availability.status === "open" || gate.availability.status === "impacted";
}

/** The primary button (book-and-pay or confirm-the-plan) is ready once nothing is missing and the date gate (or the late fee) clears. */
export function primaryButtonReady(answers: EventAnswers, gate: DateGate, lateFee = false): boolean {
  return missingFields(answers).length === 0 && dateGateSatisfied(gate, lateFee);
}

/* ---------- step 5: the plan's cards, grouped by phase ---------- */

export const TASK_PHASE_ORDER: TaskPhase[] = ["before_submitting", "review", "permit", "before_event", "event_day", "after"];

export const TASK_PHASE_LABEL: Record<TaskPhase, string> = {
  before_submitting: "Before you submit",
  review: "While it's reviewed",
  permit: "Getting your permit",
  before_event: "Before the event",
  event_day: "On the day",
  after: "After the event",
};

export interface PhaseGroup {
  phase: TaskPhase;
  label: string;
  tasks: Task[];
}

/** The plan's cards (requirements()'s output) grouped by phase, in the catalogue's own order. */
export function groupTasksByPhase(tasks: Task[]): PhaseGroup[] {
  return TASK_PHASE_ORDER.map((phase) => ({ phase, label: TASK_PHASE_LABEL[phase], tasks: tasks.filter((t) => t.phase === phase) })).filter(
    (group) => group.tasks.length > 0,
  );
}
