/**
 * Builders for seed scripts. Keep every script short and readable: a script is pure data,
 * replayed by workstream 2A through the real engine, so these helpers never call into
 * lib/rules or lib/state (both still throw "not implemented" in this worktree). They only
 * reach into lib/data and lib/dates, which are plain reference data and pure date math.
 */
import type { CatalogId } from "@/lib/rules/catalog";
import { bookableSpaces, getSpace } from "@/lib/data/inventory";
import { getSegment, milesOf } from "@/lib/data/streets";
import { datesEvery, weekdayOf } from "@/lib/dates";
import type {
  AddOns,
  Actor,
  CityServices,
  FileRef,
  HHmm,
  ISODate,
  ISODateTime,
  Location,
  Occurrence,
  Schedule,
} from "@/lib/types";
import { EMPTY_ADDONS } from "@/lib/types";
import type { Action } from "../actions";
import type { SeedStep } from "../types";

/** Nothing in a seed script's history may happen after this instant: see CLAUDE.md. */
export const SEED_CUTOFF: ISODateTime = "2027-05-03T08:00";

/* ---------- step builder ---------- */

/** One entry of a script's history. Fails fast if a step would land after the demo "now". */
export function step(at: ISODateTime, actor: Actor, action: Action): SeedStep {
  if (at > SEED_CUTOFF) {
    throw new Error(`seed step at ${at} is after the cutoff ${SEED_CUTOFF}: ${action.type}`);
  }
  return { at, actor, action };
}

/* ---------- task ids ---------- */

/** `${caseId}:${catalogId}`, plus `:${n}` for a per-vendor card (1-based). */
export function taskId(caseId: string, catalogId: CatalogId | string, n?: number): string {
  return n === undefined ? `${caseId}:${catalogId}` : `${caseId}:${catalogId}:${n}`;
}

/* ---------- sample files ---------- */

/** A plausible uploaded file. Defaults to a small PDF. */
export function sampleFile(name: string, opts?: Partial<FileRef>): FileRef {
  return { name, size: opts?.size ?? 240_000, type: opts?.type ?? "application/pdf" };
}

/** A file that will never pass review: wrong type, named like a phone snapshot. */
export function badFile(name = "IMG_0001.jpg"): FileRef {
  return { name, size: 1_200_000, type: "image/jpeg" };
}

/* ---------- locations ---------- */

/** One or more bookable shelters or fields. Capacity and label come from lib/data/inventory. */
export function inventoryLocation(ids: string[]): Location {
  const spaces = ids.map((id) => getSpace(id));
  const capacity = spaces.reduce((sum, s) => sum + (s?.capacity ?? 0), 0);
  const label = spaces.map((s) => s?.label ?? ids[0]).join(" and ");
  return { mode: "inventory", inventoryIds: ids, segmentIds: [], capacity, label };
}

/** A drawn rectangle on a plaza or open area. Capacity follows the config's sq ft per person. */
export function areaLocation(
  areaId: "city-hall-plaza" | "great-lawn",
  rect: { x: number; y: number; w: number; h: number },
  squareFeet: number,
  sqFtPerPerson = 10,
): Location {
  const space = getSpace(areaId);
  return {
    mode: "area",
    inventoryIds: [],
    areaId,
    areaRect: rect,
    segmentIds: [],
    squareFeet,
    capacity: Math.floor(squareFeet / sqFtPerPerson),
    label: space?.label ?? areaId,
  };
}

/** Closed street segments. `label` is explicit: the plain-language phrasing isn't derivable from ids alone. */
export function streetsLocation(segmentIds: string[], label: string): Location {
  return { mode: "streets", inventoryIds: [], segmentIds, miles: milesOf(segmentIds), label };
}

/** An ordered route, possibly repeating a loop (an out-and-back or multi-lap course). */
export function routeLocation(segmentIds: string[], label: string): Location {
  return { mode: "route", inventoryIds: [], segmentIds, miles: milesOf(segmentIds), label };
}

/* ---------- schedules ---------- */

export interface ScheduleOpts {
  setupStart?: HHmm;
  teardownEnd?: HHmm;
}

/** A single, one-day event. */
export function singleSchedule(date: ISODate, start: HHmm, end: HHmm, opts?: ScheduleOpts): Schedule {
  const occurrence: Occurrence = { date, availability: { status: "open" }, billing: "upcoming" };
  return { date, start, end, setupStart: opts?.setupStart, teardownEnd: opts?.teardownEnd, occurrences: [occurrence] };
}

/** A weekly series from `first` (inclusive) through `until` (inclusive). */
export function weeklySchedule(first: ISODate, start: HHmm, end: HHmm, until: ISODate, opts?: ScheduleOpts): Schedule {
  const occurrences: Occurrence[] = datesEvery(first, until, 7).map((date) => ({
    date,
    availability: { status: "open" },
    billing: "upcoming",
  }));
  return {
    date: first,
    start,
    end,
    setupStart: opts?.setupStart,
    teardownEnd: opts?.teardownEnd,
    recurrence: { frequency: "weekly", weekday: weekdayOf(first), until },
    occurrences,
  };
}

/* ---------- add-ons ---------- */

/** `cityServices` defaults every flag off except what is passed. */
export function cityServices(overrides: Partial<CityServices>): CityServices {
  return { barricades: 0, trash: false, power: false, policeOfficers: 0, policeHours: 0, ...overrides };
}

/** Starts from every add-on off, so a script only states what is on. */
export function addOns(overrides: Partial<AddOns>): AddOns {
  return { ...EMPTY_ADDONS, ...overrides };
}

/* ---------- misc ---------- */

export function vendorNames(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}`);
}

/** The label lib/data/streets.ts gives a single segment, for callers that just want one block. */
export function segmentLabel(id: string): string {
  return getSegment(id)?.label ?? id;
}

export function allInventorySpaceIds(): string[] {
  return bookableSpaces().map((s) => s.id);
}
