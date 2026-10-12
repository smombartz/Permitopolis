import { describe, expect, it } from "vitest";
import {
  fmtDate,
  fmtDateShort,
  fmtDateTime,
  fmtDaysToGo,
  fmtDue,
  fmtDueFull,
  fmtFileSize,
  fmtMiles,
  fmtMoney,
  fmtTime,
  fmtTimeRange,
  isOverdue,
  plural,
} from "./format";

describe("dates", () => {
  it("reads like the PRD", () => {
    expect(fmtDate("2027-06-26")).toBe("Sat, Jun 26, 2027");
    expect(fmtDate("2027-05-03")).toBe("Mon, May 3, 2027");
    expect(fmtDateShort("2027-05-05")).toBe("Wed, May 5");
    expect(fmtDateTime("2027-04-30T14:10")).toBe("Fri, Apr 30, 2027, 2:10 pm");
  });
});

describe("times", () => {
  it("formats single times", () => {
    expect(fmtTime("18:00")).toBe("6 pm");
    expect(fmtTime("11:30")).toBe("11:30 am");
    expect(fmtTime("12:00")).toBe("noon");
    expect(fmtTime("00:00")).toBe("midnight");
    expect(fmtTime("12:30")).toBe("12:30 pm");
  });

  it("formats ranges the way the scenarios do", () => {
    expect(fmtTimeRange("18:00", "21:00")).toBe("6 to 9 pm");
    expect(fmtTimeRange("11:00", "16:00")).toBe("11 am to 4 pm");
    expect(fmtTimeRange("12:00", "21:00")).toBe("noon to 9 pm");
    expect(fmtTimeRange("06:00", "11:30")).toBe("6 to 11:30 am");
    expect(fmtTimeRange("08:00", "09:00")).toBe("8 to 9 am");
  });
});

describe("money", () => {
  it("shows cents only when there are some", () => {
    expect(fmtMoney(1240)).toBe("$1,240");
    expect(fmtMoney(62.5)).toBe("$62.50");
    expect(fmtMoney(0)).toBe("$0");
    expect(fmtMoney(9645)).toBe("$9,645");
    expect(fmtMoney(-250)).toBe("-$250");
  });
});

describe("relative dates", () => {
  const today = "2027-05-03";

  it("counts days to the event", () => {
    expect(fmtDaysToGo("2027-06-18", today)).toBe("46 days to go");
    expect(fmtDaysToGo("2027-07-11", today)).toBe("69 days to go");
    expect(fmtDaysToGo("2027-04-24", today)).toBe("9 days ago");
    expect(fmtDaysToGo(today, today)).toBe("Today");
    expect(fmtDaysToGo("2027-05-04", today)).toBe("Tomorrow");
  });

  it("describes due dates", () => {
    expect(fmtDue("2027-05-05", today)).toBe("Due in 2 days");
    expect(fmtDue("2027-05-04", today)).toBe("Due tomorrow");
    expect(fmtDue(today, today)).toBe("Due today");
    expect(fmtDue("2027-05-01", today)).toBe("Overdue by 2 days");
    expect(fmtDue("2027-05-02", today)).toBe("Overdue by 1 day");
    expect(fmtDueFull("2027-05-05", today)).toBe("Due in 2 days · Wed, May 5");
    expect(isOverdue("2027-05-02", today)).toBe(true);
    expect(isOverdue(today, today)).toBe(false);
    expect(isOverdue(null, today)).toBe(false);
  });
});

describe("small helpers", () => {
  it("pluralizes and formats units", () => {
    expect(plural(1, "session")).toBe("1 session");
    expect(plural(13, "session")).toBe("13 sessions");
    expect(plural(1200, "person", "people")).toBe("1,200 people");
    expect(fmtMiles(3.1)).toBe("3.1 miles");
    expect(fmtMiles(1)).toBe("1 mile");
    expect(fmtFileSize(248 * 1024)).toBe("248 KB");
    expect(fmtFileSize(1.2 * 1024 * 1024)).toBe("1.2 MB");
  });
});
