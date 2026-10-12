import { describe, expect, it } from "vitest";
import { availability, occurrences } from "./availability";
import { ctx, eventCase, inventoryLocation, areaLocation } from "./test-helpers";

describe("availability: blackout", () => {
  it("all parks are blackout on 2027-05-31", () => {
    const shelter = availability(inventoryLocation(["shelter-1"]), { date: "2027-05-31", start: "10:00", end: "14:00" }, ctx());
    expect(shelter.status).toBe("blackout");
    expect(shelter.nextOpen).toHaveLength(3);
  });

  it("City Hall Plaza (not a park) is unaffected by the all-parks blackout", () => {
    const plaza = availability(areaLocation("city-hall-plaza"), { date: "2027-05-31", start: "10:00", end: "14:00" }, ctx());
    expect(plaza.status).toBe("open");
  });

  it("the Jul 4 fireworks blackout only applies once the window extends past 4 pm", () => {
    const early = availability(areaLocation("great-lawn"), { date: "2027-07-04", start: "10:00", end: "15:00" }, ctx());
    expect(early.status).toBe("open");
    const late = availability(areaLocation("great-lawn"), { date: "2027-07-04", start: "15:00", end: "18:00" }, ctx());
    expect(late.status).toBe("blackout");
  });
});

describe("availability: booked", () => {
  it("Shelter 3 on 2027-05-22 is booked by a Permitted case", () => {
    const other = eventCase({
      id: "PMT-27-0001",
      state: "permitted",
      location: inventoryLocation(["shelter-3"]),
      schedule: { date: "2027-05-22", start: "11:00", end: "16:00", occurrences: [] },
      name: "Maya Chen's 40th birthday picnic",
    });
    const result = availability(inventoryLocation(["shelter-3"]), { date: "2027-05-22", start: "11:00", end: "16:00" }, ctx({ cases: [other] }));
    expect(result.status).toBe("booked");
    expect(result.reason).toContain("Maya Chen's 40th birthday picnic");
  });

  it("a case holding the date (not yet Permitted) also books the slot", () => {
    const other = eventCase({
      id: "PMT-27-0002",
      state: "quote_sent",
      dateHold: { status: "held", placedOn: "2027-04-01", expiresOn: "2027-05-01" },
      location: inventoryLocation(["shelter-3"]),
      schedule: { date: "2027-05-22", start: "11:00", end: "16:00", occurrences: [] },
    });
    expect(availability(inventoryLocation(["shelter-3"]), { date: "2027-05-22", start: "11:00", end: "16:00" }, ctx({ cases: [other] })).status).toBe(
      "booked",
    );
  });

  it("ignoreCaseId excludes a case from its own booking check", () => {
    const other = eventCase({
      id: "PMT-27-0001",
      state: "permitted",
      location: inventoryLocation(["shelter-3"]),
      schedule: { date: "2027-05-22", start: "11:00", end: "16:00", occurrences: [] },
    });
    const result = availability(
      inventoryLocation(["shelter-3"]),
      { date: "2027-05-22", start: "11:00", end: "16:00" },
      ctx({ cases: [other] }),
      "PMT-27-0001",
    );
    expect(result.status).toBe("open");
  });

  it("the Great Lawn market (8 to 1) and movie night (5 to 10:30, setup from 5 pm) do not conflict on the same day", () => {
    const market = eventCase({
      id: "PMT-27-0010",
      state: "permitted",
      location: areaLocation("great-lawn"),
      schedule: { date: "2027-06-12", start: "08:00", end: "13:00", occurrences: [] },
    });
    const movieWindow = availability(areaLocation("great-lawn"), { date: "2027-06-12", start: "17:00", end: "22:30" }, ctx({ cases: [market] }));
    expect(movieWindow.status).toBe("open");
  });
});

describe("availability: impacted", () => {
  it("City Hall Plaza and Field 4 are impacted on 2027-07-11 (the 5K)", () => {
    expect(availability(areaLocation("city-hall-plaza"), { date: "2027-07-11", start: "06:00", end: "11:30" }, ctx()).status).toBe("impacted");
    expect(availability(inventoryLocation(["field-4"]), { date: "2027-07-11", start: "08:00", end: "09:00" }, ctx()).status).toBe("impacted");
  });

  it("impacted is a warning only, never a block, and holds at any time of day", () => {
    const result = availability(inventoryLocation(["field-4"]), { date: "2027-07-11", start: "20:00", end: "21:00" }, ctx());
    expect(result.status).toBe("impacted");
  });

  it("the impacted date never impacts the case that causes it", () => {
    const result = availability(areaLocation("city-hall-plaza"), { date: "2027-07-11", start: "06:00", end: "11:30" }, ctx(), "PMT-27-0097");
    expect(result.status).toBe("open");
  });
});

describe("occurrences", () => {
  it("one entry for a single event", () => {
    const occ = occurrences({ date: "2027-05-22", start: "11:00", end: "16:00", occurrences: [] }, inventoryLocation(["shelter-3"]), ctx());
    expect(occ).toHaveLength(1);
    expect(occ[0].billing).toBe("upcoming");
  });

  it("marks a blackout session 'skipped' and others 'upcoming'", () => {
    const occ = occurrences(
      { date: "2027-05-24", start: "10:00", end: "12:00", recurrence: { frequency: "weekly", weekday: 1, until: "2027-06-07" }, occurrences: [] },
      inventoryLocation(["shelter-1"]),
      ctx(),
    );
    expect(occ.map((o) => o.date)).toEqual(["2027-05-24", "2027-05-31", "2027-06-07"]);
    expect(occ.map((o) => o.billing)).toEqual(["upcoming", "skipped", "upcoming"]);
  });
});
