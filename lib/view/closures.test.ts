import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/state";
import { DEFAULT_DEMO_TODAY } from "@/lib/rules/config";
import { makeCase } from "@/lib/state/testSupport";
import { routeLocation, streetsLocation, areaLocation, singleSchedule } from "@/lib/state/seed/helpers";
import type { EventCase } from "@/lib/types";
import {
  closureCalendarDays,
  closureHoursLabel,
  closureOverlaps,
  closureStatus,
  closuresInRange,
  formatOverlap,
  occupiesStreet,
  parseClosuresFilters,
  closuresQueryString,
} from "./closures";

const TODAY = DEFAULT_DEMO_TODAY; // Mon, May 3, 2027
const S5 = "PMT-27-0097"; // Riverfront Summer 5K: Special, Quote sent, holding its date, Jul 11
const F5 = "PMT-27-0115"; // Plaza wedding photos: Reviewed, Submitted, never accepted, Jun 18
const S3 = "PMT-27-0118"; // Jazz in the Plaza: Reviewed, Needs info (accepted, routed), Jun 18

function getCase(cases: EventCase[], id: string): EventCase {
  const found = cases.find((c) => c.id === id);
  if (!found) throw new Error(`no case ${id}`);
  return found;
}

describe("closureStatus", () => {
  it("is held for a case holding its date, even before a quote (accepted at intake, or routed)", () => {
    const cases = buildSeed();
    const s3 = getCase(cases, S3);
    expect(s3.state).toBe("needs_info");
    expect(s3.dateHold.status).toBe("held");
    expect(closureStatus(s3)).toBe("held");
  });

  it("is held for the 5K, quote sent and holding Jul 11, from the seed", () => {
    const cases = buildSeed();
    expect(closureStatus(getCase(cases, S5))).toBe("held");
  });

  it("is pending for a submitted application that never got accepted (it lost the competing date)", () => {
    const cases = buildSeed();
    const f5 = getCase(cases, F5);
    expect(f5.state).toBe("submitted");
    expect(f5.dateHold.status).toBe("none");
    expect(closureStatus(f5)).toBe("pending");
  });

  it("is permitted for a live permit, null for a Draft, an ended case, or one with no location", () => {
    expect(closureStatus(makeCase({ state: "permitted", location: streetsLocation(["main-1-2"], "Main Street") }))).toBe("permitted");
    expect(closureStatus(makeCase({ state: "draft", location: streetsLocation(["main-1-2"], "Main Street") }))).toBeNull();
    expect(closureStatus(makeCase({ state: "quote_sent", ending: "withdrawn", dateHold: { status: "held", placedOn: TODAY, expiresOn: null }, location: streetsLocation(["main-1-2"], "Main Street") }))).toBeNull();
    expect(closureStatus(makeCase({ state: "in_review", dateHold: { status: "held", placedOn: TODAY, expiresOn: null }, location: null }))).toBeNull();
  });
});

describe("occupiesStreet", () => {
  it("is true for streets and routes, false for an area or a bookable space", () => {
    expect(occupiesStreet(streetsLocation(["elm-100"], "100 block of Elm Street"))).toBe(true);
    expect(occupiesStreet(routeLocation(["main-1-2"], "Main Street"))).toBe(true);
    expect(occupiesStreet(areaLocation("city-hall-plaza", { x: 0, y: 0, w: 10, h: 10 }, 100))).toBe(false);
  });
});

describe("closuresInRange", () => {
  it("shows the 5K's route as held on Jul 11, and as permitted once it is", () => {
    const cases = buildSeed();
    const items = closuresInRange(cases, { from: "2027-07-11", to: "2027-07-11" });
    const fiveK = items.find((item) => item.case.id === S5);
    expect(fiveK?.status).toBe("held");
    expect(fiveK?.case.location).toMatchObject({ mode: "route", miles: 3.1 });

    const permitted = cases.map((c) => (c.id === S5 ? ({ ...c, state: "permitted" as const }) : c));
    const afterPermit = closuresInRange(permitted, { from: "2027-07-11", to: "2027-07-11" });
    expect(afterPermit.find((item) => item.case.id === S5)?.status).toBe("permitted");
  });

  it("the week of Jun 14 has the Plaza overlap: Plaza wedding photos (pending) and Jazz in the Plaza (held)", () => {
    const cases = buildSeed();
    const items = closuresInRange(cases, { from: "2027-06-14", to: "2027-06-20" });
    const ids = items.map((item) => item.case.id);
    expect(ids).toContain(F5);
    expect(ids).toContain(S3);
    expect(items.find((item) => item.case.id === F5)?.status).toBe("pending");
    expect(items.find((item) => item.case.id === S3)?.status).toBe("held");
  });

  it("is empty for a range with nothing booked, held or pending", () => {
    const cases = buildSeed();
    expect(closuresInRange(cases, { from: "2028-01-01", to: "2028-01-07" })).toEqual([]);
  });

  it("'streets only' drops an occupied plaza or bookable space", () => {
    const cases = buildSeed();
    const items = closuresInRange(cases, { from: "2027-06-14", to: "2027-06-20" }, { streetsOnly: true });
    expect(items.some((item) => item.case.id === F5 || item.case.id === S3)).toBe(false);
  });

  it("a status filter narrows to that one status", () => {
    const cases = buildSeed();
    const held = closuresInRange(cases, { from: "2027-06-14", to: "2027-06-20" }, { status: "held" });
    expect(held.every((item) => item.status === "held")).toBe(true);
    expect(held.some((item) => item.case.id === S3)).toBe(true);
  });
});

describe("closureOverlaps", () => {
  it("names both events, the shared space and each one's own hours, for the Plaza on Jun 18", () => {
    const cases = buildSeed();
    const items = closuresInRange(cases, { from: "2027-06-14", to: "2027-06-20" });
    const overlaps = closureOverlaps(items);
    const plaza = overlaps.find((o) => o.date === "2027-06-18");
    expect(plaza).toBeTruthy();
    expect(plaza!.sharedLabel).toBe("City Hall Plaza");
    const names = [plaza!.a.case.name, plaza!.b.case.name].sort();
    expect(names).toEqual(["Jazz in the Plaza", "Plaza wedding photos"]);
    expect(formatOverlap(plaza!)).toMatch(/^City Hall Plaza: .+ and .+\.$/);
  });

  it("two bookings on the same street on different days never overlap", () => {
    const a = { case: makeCase({ id: "PMT-27-9001", location: streetsLocation(["main-1-2"], "Main Street, 1st to 2nd Avenue"), schedule: singleSchedule("2027-09-01", "09:00", "11:00") }), status: "held" as const, dates: ["2027-09-01"] };
    const b = { case: makeCase({ id: "PMT-27-9002", location: streetsLocation(["main-1-2"], "Main Street, 1st to 2nd Avenue"), schedule: singleSchedule("2027-09-02", "09:00", "11:00") }), status: "held" as const, dates: ["2027-09-02"] };
    expect(closureOverlaps([a, b])).toEqual([]);
  });

  it("a route that laps its own segments never overlaps itself", () => {
    const loop = { case: makeCase({ id: "PMT-27-9003", location: routeLocation(["main-1-2", "main-2-3", "main-1-2", "main-2-3"], "Two laps") }), status: "held" as const, dates: ["2027-09-01"] };
    expect(closureOverlaps([loop])).toEqual([]);
  });

  it("two bookings that share a segment on the same day overlap, named with both hours", () => {
    const a = { case: makeCase({ id: "PMT-27-9004", name: "Art Walk", location: streetsLocation(["main-2-3"], "Main Street, 2nd to 3rd Avenue"), schedule: singleSchedule("2027-09-01", "17:00", "22:00") }), status: "held" as const, dates: ["2027-09-01"] };
    const b = { case: makeCase({ id: "PMT-27-9005", name: "Summer Market", location: streetsLocation(["main-2-3", "main-3-4"], "Main Street, 2nd to 4th Avenue"), schedule: singleSchedule("2027-09-01", "09:00", "18:00") }), status: "pending" as const, dates: ["2027-09-01"] };
    const overlaps = closureOverlaps([a, b]);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].sharedLabel).toBe("Main Street, 2nd to 3rd Avenue");
    expect(formatOverlap(overlaps[0])).toBe("Main Street, 2nd to 3rd Avenue: Art Walk 5 to 10 pm and Summer Market 9 am to 6 pm.");
  });
});

describe("closureHoursLabel", () => {
  it("includes setup and teardown when the schedule has them", () => {
    const c = makeCase({ schedule: singleSchedule("2027-07-11", "07:00", "11:00", { setupStart: "06:00", teardownEnd: "11:30" }) });
    expect(closureHoursLabel(c)).toBe("7 to 11 am (setup 6 am, teardown 11:30 am)");
  });

  it("is just the event's hours when there is no setup or teardown", () => {
    const c = makeCase({ schedule: singleSchedule("2027-07-11", "07:00", "11:00") });
    expect(closureHoursLabel(c)).toBe("7 to 11 am");
  });
});

describe("closureCalendarDays", () => {
  it("counts the 5K on Jul 11 and marks the week's impacted and blackout days", () => {
    const cases = buildSeed();
    const range = { from: "2027-07-04", to: "2027-07-10" };
    const items = closuresInRange(cases, range);
    const days = closureCalendarDays(range, items);
    expect(days).toHaveLength(7);
    expect(days.find((d) => d.date === "2027-07-04")?.blackoutLabel).toMatch(/fireworks/i);
    expect(days.find((d) => d.date === "2027-07-05")?.blackoutLabel).toMatch(/cleanup/i);
  });

  it("counts the Plaza overlap's two cases on Jun 18", () => {
    const cases = buildSeed();
    const range = { from: "2027-06-14", to: "2027-06-20" };
    const items = closuresInRange(cases, range);
    const days = closureCalendarDays(range, items);
    expect(days.find((d) => d.date === "2027-06-18")?.count).toBe(2);
  });

  it("marks Jul 11 as impacted the week the 5K runs", () => {
    const cases = buildSeed();
    const range = { from: "2027-07-11", to: "2027-07-17" };
    const items = closuresInRange(cases, range);
    const days = closureCalendarDays(range, items);
    expect(days.find((d) => d.date === "2027-07-11")?.impactedReason).toMatch(/5K/);
  });
});

describe("parseClosuresFilters / closuresQueryString", () => {
  it("defaults to today, a single day", () => {
    const filters = parseClosuresFilters(new URLSearchParams(), TODAY);
    expect(filters).toMatchObject({ mode: "day", from: TODAY, to: TODAY, streetsOnly: false });
  });

  it("a week mode runs 7 days from its start", () => {
    const filters = parseClosuresFilters(new URLSearchParams("mode=week&from=2027-06-14"), TODAY);
    expect(filters).toMatchObject({ mode: "week", from: "2027-06-14", to: "2027-06-20" });
  });

  it("round-trips through the query string", () => {
    const filters = parseClosuresFilters(new URLSearchParams("mode=range&from=2027-06-01&to=2027-06-10&status=held&streets=1"), TODAY);
    const query = closuresQueryString(filters);
    expect(parseClosuresFilters(new URLSearchParams(query), TODAY)).toEqual(filters);
  });

  it("an invalid or backwards range falls back to one valid day", () => {
    const filters = parseClosuresFilters(new URLSearchParams("mode=range&from=2027-06-10&to=not-a-date"), TODAY);
    expect(filters.from).toBe("2027-06-10");
    expect(filters.to).toBe("2027-06-10");
  });
});
