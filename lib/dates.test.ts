import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  at,
  dateOf,
  datesEvery,
  daysBetween,
  hoursBetween,
  isWeekend,
  rollBackToFriday,
  timesOverlap,
  weekdayOf,
} from "./dates";

describe("ISO date helpers", () => {
  it("does calendar arithmetic without time-zone drift", () => {
    expect(addDaysISO("2027-04-30", 5)).toBe("2027-05-05");
    expect(addDaysISO("2027-04-30", 14)).toBe("2027-05-14");
    expect(addDaysISO("2027-04-24", 364)).toBe("2028-04-22");
    expect(daysBetween("2027-05-03", "2027-05-22")).toBe(19);
    expect(daysBetween("2027-05-03", "2027-04-24")).toBe(-9);
    expect(dateOf("2027-04-30T14:10")).toBe("2027-04-30");
    expect(at("2027-05-03")).toBe("2027-05-03T09:00");
  });

  it("knows the demo's weekdays", () => {
    expect(weekdayOf("2027-05-03")).toBe(1); // Monday
    expect(weekdayOf("2027-06-06")).toBe(0); // Sunday
    expect(weekdayOf("2027-06-26")).toBe(6); // Saturday
    expect(isWeekend("2027-07-11")).toBe(true);
    expect(isWeekend("2027-06-18")).toBe(false);
  });

  it("rolls weekend due dates back to Friday", () => {
    expect(rollBackToFriday("2027-05-08")).toBe("2027-05-07"); // S6 closeout: Sat to Fri
    expect(rollBackToFriday("2027-07-04")).toBe("2027-07-02"); // Sun to Fri
    expect(rollBackToFriday("2027-05-05")).toBe("2027-05-05");
  });

  it("lists a weekly series", () => {
    const yoga = datesEvery("2027-06-06", "2027-08-29", 7);
    expect(yoga).toHaveLength(13);
    expect(yoga).toContain("2027-07-11");
    expect(datesEvery("2027-06-05", "2027-09-25", 7)).toHaveLength(17);
  });

  it("compares times", () => {
    expect(hoursBetween("11:00", "16:00")).toBe(5);
    expect(hoursBetween("08:00", "09:00")).toBe(1);
    expect(timesOverlap("08:00", "13:00", "17:00", "22:30")).toBe(false); // market and movie night
    expect(timesOverlap("17:00", "19:00", "16:00", "21:00")).toBe(true); // wedding photos and Jazz
    expect(timesOverlap("08:00", "09:00", "09:00", "10:00")).toBe(false);
  });
});
