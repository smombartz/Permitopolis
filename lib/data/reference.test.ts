import { describe, expect, it } from "vitest";
import { BLACKOUTS, IMPACTED } from "./calendar";
import { CANCELLATION_SCHEDULE, FEE_SCHEDULE } from "./fees";
import { bookableSpaces, drawableAreas, getSpace } from "./inventory";
import { areConnected, getSegment, MAIN_1ST_TO_4TH, milesOf, RIVERFRONT_5K_ROUTE, SEGMENTS } from "./streets";
import { DEFAULT_CONFIG } from "@/lib/rules/config";

describe("inventory", () => {
  it("matches the PRD's capacities", () => {
    expect([1, 2, 3, 4].map((n) => getSpace(`shelter-${n}`)?.capacity)).toEqual([30, 40, 60, 120]);
    expect([1, 2, 3, 4].map((n) => getSpace(`field-${n}`)?.capacity)).toEqual([150, 150, 150, 150]);
    expect(getSpace("city-hall-plaza")?.maxPeople).toBe(2000);
    expect(bookableSpaces()).toHaveLength(8);
    expect(drawableAreas().map((s) => s.id)).toEqual(["great-lawn", "city-hall-plaza"]);
  });
});

describe("streets", () => {
  it("makes the 5K loop exactly 3.1 miles and connected", () => {
    expect(milesOf(RIVERFRONT_5K_ROUTE)).toBe(3.1);
    for (let i = 1; i < RIVERFRONT_5K_ROUTE.length; i++) {
      expect(areConnected(RIVERFRONT_5K_ROUTE[i - 1], RIVERFRONT_5K_ROUTE[i])).toBe(true);
    }
    expect(areConnected(RIVERFRONT_5K_ROUTE.at(-1)!, RIVERFRONT_5K_ROUTE[0])).toBe(true);
  });

  it("has five Main Street blocks, three of them between 1st and 4th", () => {
    expect(SEGMENTS.filter((s) => s.street === "Main Street")).toHaveLength(5);
    expect(MAIN_1ST_TO_4TH).toHaveLength(3);
  });

  it("marks residential blocks and their households", () => {
    expect(getSegment("maple-400")).toMatchObject({ kind: "residential", households: 12 });
    expect(getSegment("oak-100")?.kind).toBe("residential");
    expect(getSegment("main-1-2")?.kind).toBe("arterial");
  });
});

describe("fees and config", () => {
  it("reproduces the PRD's totals", () => {
    const f = FEE_SCHEDULE;
    expect(5 * f.shelterPerHour).toBe(125); // S1
    expect(13 * f.fieldPerHour).toBe(260); // S2
    expect(f.applicationFee.reviewed + f.cityHallPlazaPerDay + f.amplifiedSoundPerDay + f.vendorPermitEach + f.deposit.reviewed).toBe(715); // S3
    expect(f.applicationFee.reviewed + f.streetClosurePerBlockPerDay + 4 * f.barricadeEachPerDay + f.deposit.reviewed).toBe(510); // S4
    expect(
      f.applicationFee.special + 3.1 * f.routeClosurePerMile + f.amplifiedSoundPerDay + 8 * 5 * f.policePerOfficerHour + 40 * f.barricadeEachPerDay + f.deposit.special,
    ).toBe(6530); // S5
    expect(
      f.applicationFee.special + 3 * f.streetClosurePerBlockPerDay + f.alcoholLicensePerDay + 25 * f.vendorPermitEach + f.structureInspectionEach + 66 * f.policePerOfficerHour + 20 * f.barricadeEachPerDay + f.deposit.special,
    ).toBe(9645); // S6
    expect(6 * f.policePerOfficerHour + 4 * f.cleanupCrewPerWorkerHour).toBe(750); // S6 closeout
  });

  it("carries the flows doc's thresholds and lead times", () => {
    expect(DEFAULT_CONFIG.thresholds).toMatchObject({ reviewedAttendance: 100, specialAttendance: 1000, blockPartyMaxAttendance: 250 });
    expect(DEFAULT_CONFIG.leadTimeDays).toEqual({ instant: 10, reviewed: 30, special: 60 });
    expect(CANCELLATION_SCHEDULE.map((band) => band.minDaysBefore)).toEqual([30, 10, 0]);
  });
});

describe("calendar", () => {
  it("lists the blackout and impacted dates", () => {
    expect(BLACKOUTS.map((b) => b.date)).toEqual(["2027-05-31", "2027-07-04", "2027-07-05"]);
    expect(IMPACTED[0]).toMatchObject({ date: "2027-07-11", from: "06:00", to: "11:30" });
  });
});
