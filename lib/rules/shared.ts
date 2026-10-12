/**
 * Helpers shared by every rule file. Nothing here is part of the public RulesApi
 * surface except `occupiedWindow`, `locationsOverlap` and `dueDate`, which are
 * also exported directly from `lib/rules/index.ts` to satisfy RulesApi.
 */
import { addDaysISO, hoursBetween, rollBackToFriday } from "@/lib/dates";
import { getSegment } from "@/lib/data/streets";
import { SPACE_BY_ID } from "@/lib/data/inventory";
import type { HHmm, ISODate, Location, Schedule, Tier, Trigger, TriggerId } from "@/lib/types";
import type { RulesConfig } from "./types";

/** Round to the cent; avoids float noise like 62.49999999999999. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const TIER_RANK: Record<Tier, number> = { instant: 0, reviewed: 1, special: 2 };

/** The highest-ranked tier among a set of triggers; 'instant' when there are none. */
export function highestTier(triggers: Trigger[]): Tier {
  let tier: Tier = "instant";
  for (const t of triggers) {
    if (TIER_RANK[t.raisesTo] > TIER_RANK[tier]) tier = t.raisesTo;
  }
  return tier;
}

export function tier(a: Tier, b: Tier): Tier {
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}

export function trig(id: TriggerId, raisesTo: Tier, label: string): Trigger {
  return { id, raisesTo, label };
}

/** Setup start (or start) to teardown end (or end). */
export function occupiedWindow(schedule: Schedule): { start: HHmm; end: HHmm } {
  return { start: schedule.setupStart ?? schedule.start, end: schedule.teardownEnd ?? schedule.end };
}

/** A shared inventory id, the same areaId, or a shared segment id. */
export function locationsOverlap(a: Location, b: Location): boolean {
  if (a.inventoryIds.some((id) => b.inventoryIds.includes(id))) return true;
  if (a.areaId && a.areaId === b.areaId) return true;
  if (a.segmentIds.some((id) => b.segmentIds.includes(id))) return true;
  return false;
}

/** `base` plus `offsetDays`, moved to the Friday before when it lands on a weekend. */
export function dueDate(base: ISODate, offsetDays: number, cfg?: RulesConfig): ISODate {
  const computed = addDaysISO(base, offsetDays);
  if (cfg?.sla.rollWeekendsBack === false) return computed;
  return rollBackToFriday(computed);
}

/** True when this location touches a park space (for the all-parks blackout). */
export function isParkLocation(location: Location): boolean {
  if (location.mode === "inventory") return location.inventoryIds.some((id) => SPACE_BY_ID[id]?.isPark);
  if (location.mode === "area") return location.areaId !== undefined && SPACE_BY_ID[location.areaId]?.isPark === true;
  return false;
}

/** Street names this location touches, for the impacted-date check. */
export function streetsOf(location: Location): string[] {
  if (location.mode !== "streets" && location.mode !== "route") return [];
  const names = new Set<string>();
  for (const id of location.segmentIds) {
    const seg = getSegment(id);
    if (seg) names.add(seg.street);
  }
  return [...names];
}

/** The zone(s) this location's spaces sit in, for the impacted-date check. */
export function zonesOf(location: Location): string[] {
  const zones = new Set<string>();
  if (location.mode === "inventory") {
    for (const id of location.inventoryIds) {
      const space = SPACE_BY_ID[id];
      if (space) zones.add(space.zone);
    }
  } else if (location.mode === "area" && location.areaId) {
    const space = SPACE_BY_ID[location.areaId];
    if (space) zones.add(space.zone);
  }
  return [...zones];
}

/** Space/area ids this location occupies, for the blackout and impacted spaceIds check. */
export function spaceIdsOf(location: Location): string[] {
  if (location.mode === "inventory") return location.inventoryIds;
  if (location.mode === "area" && location.areaId) return [location.areaId];
  return [];
}

export function hoursOf(schedule: Schedule): number {
  return hoursBetween(schedule.start, schedule.end);
}
