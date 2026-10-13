import { describe, expect, it } from "vitest";
import { activePermits, buildSeed, sessionDates } from "@/lib/state";
import { DEFAULT_DEMO_TODAY } from "@/lib/rules/config";
import { addDaysISO } from "@/lib/dates";
import { fmtDateShort } from "@/lib/format";
import type { EventCase, ISODate } from "@/lib/types";
import {
  activeCalendarItems,
  activeListRows,
  activeMapHighlights,
  blackoutLabelOn,
  closeoutRows,
  clerkOverlay,
  hlOverlayForCase,
  monthAnchorOf,
  pwsOverlayForCase,
  roleOverlayTotal,
  shiftMonth,
  shiftWeek,
  todayLine,
  weekStartOf,
} from "./active";

const TODAY = DEFAULT_DEMO_TODAY; // Mon, May 3, 2027
const S1 = "PMT-27-0109"; // Maya Chen's picnic: Instant, Permitted
const S5 = "PMT-27-0097"; // Riverfront Summer 5K: Special, Quote sent, holding its date
const S6 = "PMT-27-0031"; // Main Street Food Truck Festival: Special, Closeout
const F6 = "PMT-27-0010"; // Little League Opening Day: Instant, Permitted
const B16 = "PMT-27-0034"; // Riverside Tai Chi Circle: Instant series, Event day today

function getCase(cases: EventCase[], id: string): EventCase {
  const found = cases.find((c) => c.id === id);
  if (!found) throw new Error(`no case ${id}`);
  return found;
}

/** The first day from `from` with no held or permitted session at all, holds included. */
function findEmptyDay(cases: EventCase[], from: ISODate = TODAY): ISODate {
  const busy = new Set(activeCalendarItems(cases, { includeHolds: true }).map((i) => i.date));
  let day = from;
  while (busy.has(day)) day = addDaysISO(day, 1);
  return day;
}

describe("activeListRows", () => {
  it("lists only Permitted/Event day/Closeout cases by default, Maya Chen and Little League among them", () => {
    const cases = buildSeed();
    const rows = activeListRows(cases, TODAY);
    const ids = rows.map((r) => r.case.id);
    expect(ids).toContain(S1);
    expect(ids).toContain(F6);
    expect(ids).toContain(B16);
    // S5 and S6 are not live permits: S5 only holds its date, S6 has an ending-free Closeout state
    // that IS live (Closeout counts as active), so only S5 should be missing here.
    expect(ids).not.toContain(S5);
    expect(ids).toContain(S6);
  });

  it("is sorted by event date, soonest first", () => {
    const cases = buildSeed();
    const rows = activeListRows(cases, TODAY);
    const dates = rows.map((r) => r.date);
    expect(dates).toEqual([...dates].sort());
  });

  it("adds Quote sent holds, shown as held, only with includeHolds", () => {
    const cases = buildSeed();
    expect(activeListRows(cases, TODAY).map((r) => r.case.id)).not.toContain(S5);

    const withHolds = activeListRows(cases, TODAY, { includeHolds: true });
    const s5Row = withHolds.find((r) => r.case.id === S5);
    expect(s5Row).toBeDefined();
    expect(s5Row?.isHeld).toBe(true);
  });

  it("collapses a series to its next session with the rest counted as moreCount", () => {
    const cases = buildSeed();
    const row = activeListRows(cases, TODAY).find((r) => r.case.id === B16);
    expect(row).toBeDefined();
    const total = sessionDates(getCase(cases, B16)).length;
    expect(row?.moreCount).toBe(total - 1);
    expect(row?.moreCount).toBeGreaterThan(0);
  });

  it("flags a hold expiring tomorrow, and not one expiring later or already expired", () => {
    const cases = buildSeed();
    const s5 = getCase(cases, S5);
    const expiringTomorrow = { ...s5, dateHold: { ...s5.dateHold, expiresOn: addDaysISO(TODAY, 1) } };
    const expiringLater = { ...s5, dateHold: { ...s5.dateHold, expiresOn: addDaysISO(TODAY, 10) } };
    const rows = activeListRows([expiringTomorrow, expiringLater], TODAY, { includeHolds: true });
    expect(rows.find((r) => r.case === expiringTomorrow)?.holdExpiresTomorrow).toBe(true);
    expect(rows.find((r) => r.case === expiringLater)?.holdExpiresTomorrow).toBe(false);
  });

  it("expands a series to one row per held session when expandSessions is on", () => {
    const cases = buildSeed();
    const expanded = activeListRows(cases, TODAY, { expandSessions: true });
    const b16Rows = expanded.filter((r) => r.case.id === B16);
    expect(b16Rows).toHaveLength(sessionDates(getCase(cases, B16)).length);
    expect(b16Rows.every((r) => r.moreCount === 0)).toBe(true);
    // Every row's date is one of the case's own held session dates.
    expect(b16Rows.map((r) => r.date).sort()).toEqual([...sessionDates(getCase(cases, B16))].sort());
  });
});

describe("activeCalendarItems", () => {
  it("shows every June session of a weekly series, none collapsed", () => {
    const cases = buildSeed();
    const items = activeCalendarItems(cases);
    const juneTaiChi = items.filter((i) => i.date.startsWith("2027-06") && i.id.startsWith(B16));
    expect(juneTaiChi.map((i) => i.date)).toEqual(["2027-06-07", "2027-06-14", "2027-06-21", "2027-06-28"]);
    expect(juneTaiChi.every((i) => i.label.includes("Tai Chi"))).toBe(true);
  });

  it("marks a held item so it reads 'held' rather than permitted", () => {
    const cases = buildSeed();
    const withHolds = activeCalendarItems(cases, { includeHolds: true });
    const s5Item = withHolds.find((i) => i.id.startsWith(S5));
    expect(s5Item?.status).toBe("held");
    expect(s5Item?.label).toContain("(held)");
  });
});

describe("todayLine", () => {
  it("names today's one event by the seed's own wording", () => {
    const cases = buildSeed();
    expect(todayLine(cases, TODAY)).toBe("Mon, May 3: 1 event today");
  });

  it("reads 'no events today' on a day with nothing", () => {
    const cases = buildSeed();
    const emptyDay = findEmptyDay(cases);
    expect(todayLine(cases, emptyDay, { includeHolds: true })).toBe(`${fmtDateShort(emptyDay)}: no events today`);
  });
});

describe("activeMapHighlights", () => {
  it("excludes a held-only date until includeHolds is on, then includes the 5K's route", () => {
    const cases = buildSeed();
    expect(activeMapHighlights(cases, "2027-07-11")).toEqual([]);

    const withHolds = activeMapHighlights(cases, "2027-07-11", { includeHolds: true });
    const fiveK = withHolds.find((h) => h.id.startsWith(S5));
    expect(fiveK).toBeDefined();
    expect(fiveK?.status).toBe("held");
    expect(fiveK?.location.mode).toBe("route");
  });

  it("is empty on a day with nothing booked or held", () => {
    const cases = buildSeed();
    const emptyDay = findEmptyDay(cases);
    expect(activeMapHighlights(cases, emptyDay, { includeHolds: true })).toEqual([]);
  });
});

describe("blackoutLabelOn", () => {
  it("names the citywide blackout on Memorial Day", () => {
    expect(blackoutLabelOn("2027-05-31")).toMatch(/Memorial Day/);
    expect(blackoutLabelOn("2027-05-30")).toBeNull();
  });
});

describe("closeoutRows", () => {
  it("lists the Food Truck Festival, held by Public Works & Safety, with its remaining steps", () => {
    const cases = buildSeed();
    const rows = closeoutRows(cases, TODAY);
    const festival = rows.find((r) => r.case.id === S6);
    expect(festival).toBeDefined();
    expect(festival?.holders).toContain("pws");
    expect(festival?.remainingSteps.length).toBeGreaterThan(0);
  });
});

describe("role overlays", () => {
  it("Public Works & Safety: S6's five work orders are all done, S5's walkthrough is already scheduled", () => {
    const cases = buildSeed();
    const s6 = pwsOverlayForCase(getCase(cases, S6));
    expect(s6).toMatchObject({ workOrdersOpen: 0, workOrdersDone: 5 });

    const s5 = pwsOverlayForCase(getCase(cases, S5));
    expect(s5).toMatchObject({ workOrdersOpen: 0, workOrdersDone: 0, walkthroughsScheduled: 1, closuresScheduled: 0 });
  });

  it("Health & Legal: all 25 of the Food Truck Festival's vendor health permits are verified", () => {
    const cases = buildSeed();
    expect(hlOverlayForCase(getCase(cases, S6))).toEqual({ vendorsVerified: 25, vendorsTotal: 25 });
  });

  it("the side panel totals the permits on show, not every case in the store", () => {
    const cases = buildSeed();
    const shown = activePermits(cases, TODAY);
    // Every case, drafts and applications in review included, counts 52 vendor permits.
    expect(roleOverlayTotal("hl", cases)).toMatchObject({ vendorsVerified: 25, vendorsTotal: 52 });
    expect(roleOverlayTotal("hl", shown)).toMatchObject({ vendorsVerified: 25, vendorsTotal: 25 });
    expect(roleOverlayTotal("pws", shown)).toMatchObject({ workOrdersDone: 7, closuresScheduled: 3, walkthroughsScheduled: 3 });
  });

  it("\"Include held dates\" adds the held cases to what the side panel totals", () => {
    const cases = buildSeed();
    const without = roleOverlayTotal("pws", activePermits(cases, TODAY));
    const withHolds = roleOverlayTotal("pws", activePermits(cases, TODAY, { includeHolds: true }));
    if (without.role !== "pws" || withHolds.role !== "pws") throw new Error("not the pws overlay");
    // S5 holds its date and has a walkthrough scheduled.
    expect(withHolds.walkthroughsScheduled).toBeGreaterThan(without.walkthroughsScheduled);
  });

  it("the Clerk: the day-of contact, and no compliance log entries yet", () => {
    expect(clerkOverlay()).toEqual({ contactName: "Priya Natarajan", contactPhone: "(555) 014-2200", complianceLogCount: 0 });
  });
});

describe("month/week navigation", () => {
  it("monthAnchorOf and shiftMonth, including a year boundary", () => {
    expect(monthAnchorOf("2027-06-18")).toBe("2027-06-01");
    expect(shiftMonth("2027-06-01", 1)).toBe("2027-07-01");
    expect(shiftMonth("2027-01-01", -1)).toBe("2026-12-01");
  });

  it("weekStartOf and shiftWeek", () => {
    // Mon, May 3, 2027: its week starts on Sunday, May 2.
    expect(weekStartOf("2027-05-03")).toBe("2027-05-02");
    expect(shiftWeek("2027-05-02", 1)).toBe("2027-05-09");
    expect(shiftWeek("2027-05-02", -1)).toBe("2027-04-25");
  });
});
