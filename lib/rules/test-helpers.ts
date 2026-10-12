/**
 * Local fixture builders for lib/rules tests. Not a public export; imported
 * directly by *.test.ts files in this folder.
 */
import { EMPTY_ADDONS, type AddOns, type EventAnswers, type EventCase, type Location, type Schedule } from "@/lib/types";
import type { RulesCtx } from "./types";
import { DEFAULT_CONFIG } from "./config";

export function answers(overrides: Partial<EventAnswers> = {}): EventAnswers {
  return {
    eventType: null,
    name: "Test event",
    location: null,
    schedule: null,
    attendance: null,
    addOns: { ...EMPTY_ADDONS, ...(overrides.addOns ?? {}) },
    ...overrides,
  };
}

export function addOns(overrides: Partial<AddOns> = {}): AddOns {
  return { ...EMPTY_ADDONS, ...overrides };
}

export function inventoryLocation(inventoryIds: string[], extra: Partial<Location> = {}): Location {
  return { mode: "inventory", inventoryIds, segmentIds: [], label: inventoryIds.join(", "), ...extra };
}

export function areaLocation(areaId: "city-hall-plaza" | "great-lawn", extra: Partial<Location> = {}): Location {
  return { mode: "area", inventoryIds: [], areaId, segmentIds: [], label: areaId, ...extra };
}

export function streetsLocation(segmentIds: string[], extra: Partial<Location> = {}): Location {
  return { mode: "streets", inventoryIds: [], segmentIds, label: segmentIds.join(", "), ...extra };
}

export function routeLocation(segmentIds: string[], extra: Partial<Location> = {}): Location {
  return { mode: "route", inventoryIds: [], segmentIds, label: segmentIds.join(", "), ...extra };
}

export function schedule(overrides: Partial<Schedule> & { date: string; start: string; end: string }): Schedule {
  return { occurrences: [{ date: overrides.date, availability: { status: "open" }, billing: "upcoming" }], ...overrides };
}

export function ctx(overrides: Partial<RulesCtx> = {}): RulesCtx {
  return { today: "2027-05-03", cases: [], cfg: DEFAULT_CONFIG, ...overrides };
}

/** A minimal EventCase for availability/cancellation tests; callers override what they need. */
export function eventCase(overrides: Partial<EventCase> & { id: string }): EventCase {
  return {
    applicantId: "applicant-1",
    tier: "instant",
    triggers: [],
    eventType: null,
    name: "Test case",
    location: null,
    schedule: null,
    attendance: null,
    addOns: { ...EMPTY_ADDONS },
    state: "draft",
    ending: null,
    endingReason: null,
    dateHold: { status: "none", placedOn: null, expiresOn: null },
    reviews: [],
    tasks: [],
    conditions: [],
    feeLines: [],
    payments: [],
    activity: [],
    permit: null,
    flags: { sentToCommission: false, lateFee: false, signed: false, acceptedComplete: false, amendmentPending: false },
    closeout: { cleanup: null, notes: "", hoursLoggedOn: null, balance: null, refund: null, feedback: null },
    wizardStep: "plan",
    createdAt: "2027-04-01T09:00",
    submittedAt: null,
    clonedFrom: null,
    ...overrides,
  };
}
