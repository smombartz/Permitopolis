/**
 * Pure view-model for Health & Legal's Inspections page (workstream 5D, P2): day-of food booth
 * inspections, one booth per food vendor, for every event on its event day or in the next 14
 * days. No React, no store.
 *
 * The engine keeps no inspection of its own (there is no engineRequest for one: recording a
 * result is a one-line activity note, not a new kind of state). A result is written with
 * `add_note` in a fixed, readable wording and read back from the case's own activity log, so
 * reset() and a fresh seed replay carry it like any other note. Tested against the real seed in
 * inspections.test.ts.
 */
import { applicantNameOf } from "@/lib/data/people";
import { addDaysISO } from "@/lib/dates";
import { isVisibleToCity, sessionDates } from "@/lib/state";
import type { EventCase, ISODate, ISODateTime, Task, Tier } from "@/lib/types";

export type InspectionResult = "pass" | "fail" | "re-inspect";

export const INSPECTION_RESULTS: InspectionResult[] = ["pass", "fail", "re-inspect"];

export const RESULT_LABEL: Record<InspectionResult, string> = {
  pass: "Pass",
  fail: "Fail",
  "re-inspect": "Re-inspect",
};

const NOTE_PREFIX = "Food booth inspection: ";
const NOTE_RE = /^Food booth inspection: (.+?): (pass|fail|re-inspect)\.(?: (.*))?$/;

/** The fixed, readable wording an inspection result is recorded with, read back by `parseInspectionNote`. */
export function formatInspectionNote(vendorName: string, result: InspectionResult, note: string): string {
  const trimmed = note.trim();
  return `${NOTE_PREFIX}${vendorName}: ${result}.${trimmed ? ` ${trimmed}` : ""}`;
}

/** The reverse of `formatInspectionNote`. Null for any activity entry that is not one of these notes. */
export function parseInspectionNote(text: string): { vendorName: string; result: InspectionResult; note: string } | null {
  const match = NOTE_RE.exec(text);
  if (!match) return null;
  return { vendorName: match[1], result: match[2] as InspectionResult, note: match[3] ?? "" };
}

export interface BoothRow {
  vendorTaskId: string;
  vendorName: string;
  result: InspectionResult | null;
  note: string;
  recordedAt: ISODateTime | null;
}

/** This vendor's most recent recorded result on the case, newest activity entry first. Null if never recorded. */
function latestResultFor(c: EventCase, vendorName: string): { result: InspectionResult; note: string; recordedAt: ISODateTime } | null {
  for (let i = c.activity.length - 1; i >= 0; i--) {
    const parsed = parseInspectionNote(c.activity[i].text);
    if (parsed && parsed.vendorName === vendorName) return { result: parsed.result, note: parsed.note, recordedAt: c.activity[i].at };
  }
  return null;
}

/** One row per food vendor on the case, with its most recently recorded result, if any. */
export function boothRowsFor(c: EventCase): BoothRow[] {
  return c.tasks
    .filter((task) => task.catalogId === "vendor_health_permit")
    .map((task) => boothRowForTask(c, task));
}

function boothRowForTask(c: EventCase, task: Task): BoothRow {
  const vendorName = task.payload.vendorName ?? task.title;
  const found = latestResultFor(c, vendorName);
  return { vendorTaskId: task.id, vendorName, result: found?.result ?? null, note: found?.note ?? "", recordedAt: found?.recordedAt ?? null };
}

export type InspectionBucket = "today" | "upcoming";

export interface InspectionEventGroup {
  caseId: string;
  caseName: string;
  applicantName: string;
  tier: Tier;
  /** The earliest session in the 14-day window: the day these booths are inspected. */
  eventDate: ISODate;
  bucket: InspectionBucket;
  booths: BoothRow[];
}

const UPCOMING_WINDOW_DAYS = 14;

/**
 * Every open event with food vendors whose day falls today or in the next 14 days, one group
 * per event, sorted by date then name. A series only ever shows its earliest matching session:
 * a food booth list is for the day, not the whole run.
 */
export function buildInspectionGroups(cases: EventCase[], today: ISODate): InspectionEventGroup[] {
  const horizon = addDaysISO(today, UPCOMING_WINDOW_DAYS);
  const groups: InspectionEventGroup[] = [];
  for (const c of cases) {
    // A Draft is the applicant's alone: the city has no page for it, and no booth of its to inspect.
    if (c.ending !== null || !isVisibleToCity(c)) continue;
    const booths = boothRowsFor(c);
    if (booths.length === 0) continue;
    const upcoming = sessionDates(c).filter((d) => d >= today && d <= horizon);
    if (upcoming.length === 0) continue;
    const eventDate = upcoming.reduce((a, b) => (a < b ? a : b));
    groups.push({ caseId: c.id, caseName: c.name, applicantName: applicantNameOf(c), tier: c.tier, eventDate, bucket: eventDate === today ? "today" : "upcoming", booths });
  }
  return groups.sort((a, b) => (a.eventDate !== b.eventDate ? (a.eventDate < b.eventDate ? -1 : 1) : a.caseName < b.caseName ? -1 : 1));
}

export function groupsByBucket(groups: InspectionEventGroup[]): { today: InspectionEventGroup[]; upcoming: InspectionEventGroup[] } {
  return { today: groups.filter((g) => g.bucket === "today"), upcoming: groups.filter((g) => g.bucket === "upcoming") };
}
