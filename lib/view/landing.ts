/**
 * Pure view-model for the landing page (`/`) and the demo guide (`/demo`). No React, no store:
 * the hero preview's tiny form maps to real `EventAnswers` and runs the real rules engine
 * (`classify`, `estimateFees`, `whatIf`); the tier-card and comparison-table rows are read off
 * `DEFAULT_CONFIG` and the seed, never typed in by hand. Tested with the real seed
 * (`buildSeed()`), no mocks, in `lib/view/landing.test.ts`.
 *
 * Owned by workstream 3A (app/page.tsx, app/demo/page.tsx, components/landing/**).
 */
import { getSpace } from "@/lib/data/inventory";
import { getSegment, milesOf } from "@/lib/data/streets";
import { applicantNameOf } from "@/lib/data/people";
import { SCENARIO_JUMPS, type DemoPath } from "@/lib/data/demoScript";
import { fmtMoney, fmtNumber } from "@/lib/format";
import { classify, DEFAULT_CONFIG, estimateFees, whatIf } from "@/lib/rules";
import type { Classification, FeeEstimate, RulesConfig, WhatIf } from "@/lib/rules";
import { homeFor, routes } from "@/lib/routes";
import { pathForPersona } from "@/lib/view/shell";
import { caseTotals } from "@/lib/state";
import {
  EMPTY_ADDONS,
  PARTY_LABEL,
  type EventAnswers,
  type EventCase,
  type EventType,
  type Location,
  type Party,
  type Schedule,
  type Tier,
  type TriggerId,
} from "@/lib/types";

/* ------------------------------------------------------------------------ */
/* Hero preview: a tiny form mapped to real EventAnswers                     */
/* ------------------------------------------------------------------------ */

export type HeroWhere = "shelter" | "plaza" | "street";

export interface HeroPreviewForm {
  eventType: EventType;
  where: HeroWhere;
  attendance: number;
  amplifiedSound: boolean;
  alcohol: boolean;
}

export const HERO_PREVIEW_DEFAULT: HeroPreviewForm = {
  eventType: "picnic_party",
  where: "shelter",
  attendance: 40,
  amplifiedSound: false,
  alcohol: false,
};

export const HERO_WHERE_OPTIONS: { value: HeroWhere; label: string }[] = [
  { value: "shelter", label: "A shelter" },
  { value: "plaza", label: "The plaza" },
  { value: "street", label: "A street" },
];

/** A fixed afternoon, never used for the date gate: the hero preview never shows that panel. */
const HERO_SCHEDULE: Schedule = { date: "2027-06-12", start: "11:00", end: "15:00", occurrences: [] };

/** The real place behind each "where" choice, read off the reference data, never hand-typed. */
export function heroLocation(where: HeroWhere): Location {
  if (where === "shelter") {
    const space = getSpace("shelter-2");
    if (!space) throw new Error("Hero preview: shelter-2 is missing from the inventory.");
    return { mode: "inventory", inventoryIds: [space.id], segmentIds: [], capacity: space.capacity, label: space.label };
  }
  if (where === "plaza") {
    const space = getSpace("city-hall-plaza");
    if (!space) throw new Error("Hero preview: city-hall-plaza is missing from the inventory.");
    return { mode: "area", inventoryIds: [], segmentIds: [], areaId: "city-hall-plaza", squareFeet: space.squareFeet, label: space.label };
  }
  const segment = getSegment("main-1-2");
  if (!segment) throw new Error("Hero preview: main-1-2 is missing from the streets.");
  return { mode: "streets", inventoryIds: [], segmentIds: [segment.id], label: segment.label };
}

/** Maps the hero's tiny form to a real `EventAnswers`. Never written back to the store. */
export function heroPreviewAnswers(form: HeroPreviewForm): EventAnswers {
  return {
    eventType: form.eventType,
    name: "Your event",
    location: heroLocation(form.where),
    schedule: HERO_SCHEDULE,
    attendance: form.attendance,
    addOns: { ...EMPTY_ADDONS, amplifiedSound: form.amplifiedSound, alcohol: form.alcohol },
  };
}

export interface HeroPreviewResult {
  answers: EventAnswers;
  classification: Classification;
  fees: FeeEstimate;
  whatIfs: WhatIf[];
}

/** The hero panel's live result: the real `classify()`, `estimateFees()` and `whatIf()`. */
export function heroPreviewResult(form: HeroPreviewForm, cfg: RulesConfig = DEFAULT_CONFIG): HeroPreviewResult {
  const answers = heroPreviewAnswers(form);
  const classification = classify(answers, cfg);
  const fees = estimateFees(answers, classification, cfg);
  const whatIfs = whatIf(answers, cfg);
  return { answers, classification, fees, whatIfs };
}

/* ------------------------------------------------------------------------ */
/* Event tiers: the three-card grid                                         */
/* ------------------------------------------------------------------------ */

/** The seeded case that stands for each tier (plan 7): S1, S3 and S5. */
const TIER_EXAMPLE_CASE_ID: Record<Tier, string> = {
  instant: "PMT-27-0109",
  reviewed: "PMT-27-0118",
  special: "PMT-27-0097",
};

export interface TierCard {
  tier: Tier;
  leadTimeDays: number;
  /** Who reviews this tier's example, read off `classify()`'s own reviewer list. */
  reviewerText: string;
  typicalFee: number;
  example: { caseId: string; title: string; applicantName: string };
}

/** The three-card grid's rows, read from the seed and the rules: nothing here is typed in. */
export function tierCards(seed: EventCase[], cfg: RulesConfig = DEFAULT_CONFIG): TierCard[] {
  return (["instant", "reviewed", "special"] as const).map((tier) => {
    const caseId = TIER_EXAMPLE_CASE_ID[tier];
    const c = seed.find((x) => x.id === caseId);
    if (!c) throw new Error(`Landing page: the seed is missing ${caseId}, the ${tier} tier's example.`);
    const cls = classify(c, cfg);
    const reviewerText = cls.reviewers.length > 0 ? cls.reviewers.map((r) => PARTY_LABEL[r.dept]).join(", ") : "City Clerk only";
    return {
      tier,
      leadTimeDays: cls.leadTimeDays,
      reviewerText,
      typicalFee: caseTotals(c).total,
      example: { caseId: c.id, title: c.name, applicantName: applicantNameOf(c) },
    };
  });
}

/* ------------------------------------------------------------------------ */
/* What sets the tier: the comparison table                                  */
/* ------------------------------------------------------------------------ */

export interface ComparisonRow {
  id: TriggerId | "none";
  label: string;
  tier: Tier;
}

const COMPARISON_TRIGGER_IDS: TriggerId[] = [
  "street",
  "route",
  "attendance_1000",
  "fireworks_drones",
  "heavy_resources",
  "plaza_open_area",
  "attendance_100",
  "amplified_sound",
  "alcohol",
  "food_vending",
  "tents_stages",
  "cooking_generators",
  "admission",
  "city_services",
];

function baseComparisonAnswers(): EventAnswers {
  return { eventType: "picnic_party", name: "", location: null, schedule: null, attendance: null, addOns: { ...EMPTY_ADDONS } };
}

/** An `EventAnswers` that raises exactly one named trigger, so its own tier is read off `classify()`. */
function isolatedAnswersFor(id: TriggerId, cfg: RulesConfig): EventAnswers {
  const base = baseComparisonAnswers();
  switch (id) {
    case "street":
      return { ...base, location: heroLocation("street") };
    case "route": {
      const segmentIds = ["river-a", "river-b"];
      return { ...base, location: { mode: "route", inventoryIds: [], segmentIds, miles: milesOf(segmentIds), label: "River Road" } };
    }
    case "attendance_1000":
      return { ...base, attendance: cfg.thresholds.specialAttendance };
    case "fireworks_drones":
      return { ...base, addOns: { ...EMPTY_ADDONS, fireworksDrones: true } };
    case "heavy_resources":
      return {
        ...base,
        addOns: { ...EMPTY_ADDONS, cityServices: { barricades: cfg.thresholds.heavyBarricades + 1, trash: false, power: false, policeOfficers: 0, policeHours: 0 } },
      };
    case "plaza_open_area":
      return { ...base, location: heroLocation("plaza") };
    case "attendance_100":
      return { ...base, attendance: cfg.thresholds.reviewedAttendance };
    case "amplified_sound":
      return { ...base, addOns: { ...EMPTY_ADDONS, amplifiedSound: true } };
    case "alcohol":
      return { ...base, addOns: { ...EMPTY_ADDONS, alcohol: true } };
    case "food_vending":
      return { ...base, addOns: { ...EMPTY_ADDONS, foodVending: { vendors: 1 } } };
    case "tents_stages":
      return { ...base, addOns: { ...EMPTY_ADDONS, tentsStages: { count: 1 } } };
    case "cooking_generators":
      return { ...base, addOns: { ...EMPTY_ADDONS, cookingGenerators: true } };
    case "admission":
      return { ...base, addOns: { ...EMPTY_ADDONS, admission: true } };
    case "city_services":
      return { ...base, addOns: { ...EMPTY_ADDONS, cityServices: { barricades: 1, trash: true, power: false, policeOfficers: 0, policeHours: 0 } } };
    default:
      return base;
  }
}

/**
 * "What sets the tier": one row per trigger, each raised in isolation and read back off
 * `classify()`, plus the Instant baseline. Nothing here types in which tier a trigger raises
 * to; that comes from the engine itself.
 */
export function comparisonRows(cfg: RulesConfig = DEFAULT_CONFIG): ComparisonRow[] {
  const rows: ComparisonRow[] = COMPARISON_TRIGGER_IDS.map((id) => {
    const cls = classify(isolatedAnswersFor(id, cfg), cfg);
    const trigger = cls.triggers.find((t) => t.id === id);
    if (!trigger) throw new Error(`Comparison table: isolating ${id} did not raise its own trigger.`);
    return { id, label: trigger.label, tier: trigger.raisesTo };
  });
  rows.push({ id: "none", label: "A bookable space within capacity, no add-ons", tier: "instant" });
  return rows;
}

/** The block-party exception, as a note under the table: the threshold comes from the config. */
export function blockPartyNote(cfg: RulesConfig = DEFAULT_CONFIG): string {
  return `A block party on one residential block, with no food or vending and fewer than ${fmtNumber(cfg.thresholds.blockPartyMaxAttendance)} people, is Reviewed — not Special — with a neighbor sign-off card.`;
}

/* ------------------------------------------------------------------------ */
/* Fees and cancellations: frosted panels from DEFAULT_CONFIG.fees           */
/* ------------------------------------------------------------------------ */

export interface FeeScheduleRow {
  label: string;
  amount: string;
}

/** The fee schedule panel's rows, every amount read off `cfg.fees`. */
export function feeScheduleRows(cfg: RulesConfig = DEFAULT_CONFIG): FeeScheduleRow[] {
  const f = cfg.fees;
  return [
    { label: "Application fee — Instant", amount: fmtMoney(f.applicationFee.instant) },
    { label: "Application fee — Reviewed", amount: fmtMoney(f.applicationFee.reviewed) },
    { label: "Application fee — Special event", amount: fmtMoney(f.applicationFee.special) },
    { label: "Shelter", amount: `${fmtMoney(f.shelterPerHour)} per hour` },
    { label: "Field", amount: `${fmtMoney(f.fieldPerHour)} per hour` },
    { label: "City Hall Plaza", amount: `${fmtMoney(f.cityHallPlazaPerDay)} per day` },
    { label: "Great Lawn", amount: `${fmtMoney(f.greatLawnPerDay)} per day` },
    { label: "Street closure", amount: `${fmtMoney(f.streetClosurePerBlockPerDay)} per block per day` },
    { label: "Route closure", amount: `${fmtMoney(f.routeClosurePerMile)} per mile` },
    { label: "Amplified sound", amount: `${fmtMoney(f.amplifiedSoundPerDay)} per day` },
    { label: "Temporary alcohol license", amount: `${fmtMoney(f.alcoholLicensePerDay)} per day` },
    { label: "Food or vendor permit", amount: `${fmtMoney(f.vendorPermitEach)} per vendor` },
    { label: "Structure fire inspection", amount: `${fmtMoney(f.structureInspectionEach)} per structure` },
    { label: "Police officer", amount: `${fmtMoney(f.policePerOfficerHour)} per officer-hour` },
    { label: "Barricade", amount: `${fmtMoney(f.barricadeEachPerDay)} each per day` },
    { label: "Cleanup crew (actuals only)", amount: `${fmtMoney(f.cleanupCrewPerWorkerHour)} per worker-hour` },
    { label: "Refundable cleanup deposit — Reviewed", amount: fmtMoney(f.deposit.reviewed) },
    { label: "Refundable cleanup deposit — Special event", amount: fmtMoney(f.deposit.special) },
    { label: "Late fee", amount: `${Math.round(cfg.lateFee.rate * 100)}% of fees, excluding the deposit` },
  ];
}

/** The cancellation schedule panel's rows: the config's own `label` text, never retyped. */
export function cancellationRows(cfg: RulesConfig = DEFAULT_CONFIG): string[] {
  return cfg.cancellation.map((band) => band.label);
}

/* ------------------------------------------------------------------------ */
/* Questions: an 8-item FAQ grounded in the PRD and the config               */
/* ------------------------------------------------------------------------ */

export interface FaqItem {
  question: string;
  answer: string;
}

export function faqItems(cfg: RulesConfig = DEFAULT_CONFIG): FaqItem[] {
  const lead = cfg.leadTimeDays;
  return [
    {
      question: "Do I need insurance?",
      answer:
        "Every Reviewed and Special event uploads a certificate of insurance before submitting, and Health & Legal checks it before the permit issues. An Instant booking doesn't need one.",
    },
    {
      question: "How far ahead must I apply?",
      answer: `At least ${lead.instant} days for an Instant booking, ${lead.reviewed} days for a Reviewed event, and ${lead.special} days for a Special event. The wizard enforces this: a date inside the lead time offers a later date, dropping an add-on, or a late fee.`,
    },
    {
      question: "What about a block party?",
      answer: `${blockPartyNote(cfg)} Every household on the block signs off before the City Clerk's intake check can continue.`,
    },
    {
      question: "Can I book a weekly class?",
      answer: "Yes. Pick Class or club meetup, set a weekly or every-two-weeks repeat and an end date, and each session is billed on its own; a session that falls on a blackout date is skipped, not charged.",
    },
    {
      question: "What if my plans change?",
      answer:
        "Amend your application at any point. If the change raises the tier or moves the date inside its new lead time, you'll see the same date gate the wizard shows. Your current permit stays valid for the original plan while the amendment is reviewed.",
    },
    {
      question: "What does it cost to cancel?",
      answer: `${cancellationRows(cfg).join(" ")} The refundable cleanup deposit is always refunded in full.`,
    },
    {
      question: "Who do I call on the day?",
      answer: "Your permit carries the City Clerk's Office number. Public Works & Safety handles closures, barricades and other city services; Health & Legal handles food, vendor and insurance questions.",
    },
    {
      question: "Why do I need neighbors to sign?",
      answer: "A block party closes a residential street in front of people's homes, so every household on that block signs off before intake continues — it's their street for the day too.",
    },
  ];
}

/* ------------------------------------------------------------------------ */
/* The two doors                                                            */
/* ------------------------------------------------------------------------ */

/**
 * Where "Plan an event" lands: always the wizard. It reopens the persona's one draft where
 * they left it (S2, or a new applicant who has already started); anyone else, somebody with
 * events of their own included, gets a blank one, since they are starting another event.
 */
export function planAnEventPath(personaId: string, cases: EventCase[]): string {
  const path = pathForPersona(personaId, cases);
  return path === routes.events() ? routes.apply() : path;
}

export interface CityStaffDoor {
  role: Exclude<Party, "applicant">;
  href: string;
}

/**
 * Where "City staff" lands, and as whom: My queue, as the city role already current, or as the
 * City Clerk when the Applicant is. (A role switch alone would not do: from one city role to
 * another it keeps the page, and this page is the landing page.)
 */
export function cityStaffDoor(role: Party): CityStaffDoor {
  return { role: role === "applicant" ? "clerk" : role, href: routes.city.queue() };
}

/* ------------------------------------------------------------------------ */
/* Demo guide: starting a demo path                                         */
/* ------------------------------------------------------------------------ */

export interface DemoPathJump {
  role: Party;
  personaId?: string;
  href: string;
}

/**
 * Where "Start this path" goes: the path's own scenario jump (role, persona, page) when it has
 * one, otherwise the first step's role and persona, resolved the way picking a persona would.
 */
export function demoPathJump(path: DemoPath, cases: EventCase[]): DemoPathJump {
  if (path.scenario) {
    const jump = SCENARIO_JUMPS.find((j) => j.id === path.scenario);
    if (jump) return { role: jump.role, personaId: jump.personaId, href: jump.path };
  }
  const first = path.steps[0];
  if (!first) return { role: "applicant", href: routes.apply() };
  if (!first.persona) return { role: first.role, href: homeFor(first.role) };
  return { role: first.role, personaId: first.persona, href: pathForPersona(first.persona, cases) };
}

/** What is faked, from the PRD's "Scope" section: a short list for the demo guide. */
export const WHAT_IS_FAKED: string[] = [
  "No backend, database, auth, email or real payments — every click changes one in-browser store that resets to the seed.",
  "Uploads keep only the file name, size and type; every upload has a \"Use sample file\" button.",
  "Payments and signatures are simulated forms that always succeed, with a test card prefilled.",
  "Permitopolis is a fictional city, drawn as SVG — no map tiles or geocoding.",
  "No appeals (denials are final), no commission workflow beyond a marker, and no notifications outside the app.",
];
