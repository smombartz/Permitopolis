import { describe, expect, it } from "vitest";
import { MAIN_1ST_TO_4TH, RIVERFRONT_5K_ROUTE } from "@/lib/data/streets";
import { classify, isBlockPartyException, whatIf } from "./classify";
import { DEFAULT_CONFIG } from "./config";
import { routing } from "./routing";
import { answers, addOns, areaLocation, inventoryLocation, routeLocation, schedule, streetsLocation } from "./test-helpers";

describe("classify: section 6.1 scenarios", () => {
  it("S1 picnic at Shelter 3 is Instant, 10-day lead time, no reviewers", () => {
    const cls = classify(
      answers({
        eventType: "picnic_party",
        location: inventoryLocation(["shelter-3"]),
        schedule: schedule({ date: "2027-05-22", start: "11:00", end: "16:00" }),
        attendance: 45,
      }),
    );
    expect(cls.tier).toBe("instant");
    expect(cls.leadTimeDays).toBe(10);
    expect(cls.reviewers).toEqual([]);
  });

  it("S2 weekly class at Field 4 is Instant, 10-day lead time, no reviewers", () => {
    const a = answers({
      eventType: "class_meetup",
      location: inventoryLocation(["field-4"]),
      schedule: schedule({
        date: "2027-06-06",
        start: "08:00",
        end: "09:00",
        recurrence: { frequency: "weekly", weekday: 0, until: "2027-08-29" },
      }),
      attendance: 20,
    });
    const cls = classify(a);
    expect(cls.tier).toBe("instant");
    expect(cls.leadTimeDays).toBe(10);
    expect(cls.reviewers).toEqual([]);
    expect(routing(a, cls)).toEqual([]);
  });

  it("S3 performance at City Hall Plaza is Reviewed with Public Works & Safety and Health & Legal, 30-day lead time", () => {
    const cls = classify(
      answers({
        eventType: "performance_rally",
        location: areaLocation("city-hall-plaza"),
        schedule: schedule({ date: "2027-06-18", start: "18:00", end: "21:00" }),
        attendance: 150,
        addOns: addOns({ amplifiedSound: true, foodVending: { vendors: 1, vendorNames: ["Rolling Dumpling Co."] } }),
      }),
    );
    expect(cls.tier).toBe("reviewed");
    expect(cls.leadTimeDays).toBe(30);
    expect(cls.reviewers.map((r) => r.dept)).toEqual(["pws", "hl"]);
    expect(cls.summary).toContain("$715");
  });

  it("S4 block party on Maple 400 is Reviewed by the block-party exception, not Special", () => {
    const cls = classify(
      answers({
        eventType: "block_party",
        location: streetsLocation(["maple-400"]),
        schedule: schedule({ date: "2027-06-26", start: "14:00", end: "20:00" }),
        attendance: 120,
        addOns: addOns({ cityServices: { barricades: 4, trash: false, power: false, policeOfficers: 0, policeHours: 0 } }),
      }),
    );
    expect(cls.blockPartyException).toBe(true);
    expect(cls.tier).toBe("reviewed");
    expect(cls.leadTimeDays).toBe(30);
    expect(cls.triggers.map((t) => t.id)).toContain("block_party");
    expect(cls.triggers.map((t) => t.id)).not.toContain("street");
    expect(cls.reviewers.map((r) => r.dept)).toEqual(["pws", "hl"]);
  });

  it("S5 the Riverfront 5K is Special with all three groups, 60-day lead time", () => {
    const cls = classify(
      answers({
        eventType: "race_parade",
        location: routeLocation(RIVERFRONT_5K_ROUTE, { miles: 3.1 }),
        schedule: schedule({ date: "2027-07-11", start: "07:00", end: "11:00" }),
        attendance: 1200,
        addOns: addOns({ amplifiedSound: true, cityServices: { barricades: 40, trash: false, power: false, policeOfficers: 8, policeHours: 5 } }),
      }),
    );
    expect(cls.tier).toBe("special");
    expect(cls.leadTimeDays).toBe(60);
    expect(cls.reviewers.map((r) => r.dept)).toEqual(["clerk", "pws", "hl"]);
    expect(cls.summary).toContain("$6,530");
  });

  it("S6 the Food Truck Festival is Special", () => {
    const cls = classify(
      answers({
        eventType: "market_festival",
        location: streetsLocation(MAIN_1ST_TO_4TH),
        schedule: schedule({ date: "2027-04-24", start: "12:00", end: "21:00" }),
        attendance: 3000,
        addOns: addOns({
          foodVending: { vendors: 25 },
          alcohol: true,
          tentsStages: { count: 1 },
          cityServices: { barricades: 20, trash: false, power: false, policeOfficers: 1, policeHours: 66 },
        }),
      }),
    );
    expect(cls.tier).toBe("special");
    expect(cls.leadTimeDays).toBe(60);
    expect(cls.reviewers.map((r) => r.dept)).toEqual(["clerk", "pws", "hl"]);
  });
});

describe("classify: boundaries", () => {
  const at = (attendance: number) => classify(answers({ location: inventoryLocation(["field-1"]), attendance })).tier;

  it("99 is Instant, 100 is Reviewed", () => {
    expect(at(99)).toBe("instant");
    expect(at(100)).toBe("reviewed");
  });

  it("999 is Reviewed, 1,000 is Special", () => {
    expect(at(999)).toBe("reviewed");
    expect(at(1000)).toBe("special");
  });

  it("249 at a block party is Reviewed by the exception; 250 is Special (the exception no longer applies)", () => {
    const base = {
      eventType: "block_party" as const,
      location: streetsLocation(["maple-400"]),
    };
    const at249 = classify(answers({ ...base, attendance: 249 }));
    const at250 = classify(answers({ ...base, attendance: 250 }));
    expect(at249.blockPartyException).toBe(true);
    expect(at249.tier).toBe("reviewed");
    expect(at250.blockPartyException).toBe(false);
    expect(at250.tier).toBe("special");
  });

  it("41 people at Shelter 2 (capacity 40) is still Instant: capacity never changes the tier", () => {
    const cls = classify(answers({ location: inventoryLocation(["shelter-2"]), attendance: 41 }));
    expect(cls.tier).toBe("instant");
  });
});

describe("classify: the block-party exception", () => {
  it("requires exactly one residential segment, no food vending and attendance under the threshold", () => {
    expect(isBlockPartyException(answers({ eventType: "block_party", location: streetsLocation(["maple-400"]), attendance: 100 }), DEFAULT_CONFIG)).toBe(
      true,
    );
    expect(isBlockPartyException(answers({ eventType: "block_party", location: streetsLocation(["main-1-2"]), attendance: 100 }), DEFAULT_CONFIG)).toBe(
      false,
    );
  });

  it("a block party with two blocks is not the exception", () => {
    const cls = classify(answers({ eventType: "block_party", location: streetsLocation(["maple-400", "maple-500"]), attendance: 100 }));
    expect(cls.blockPartyException).toBe(false);
    expect(cls.triggers.map((t) => t.id)).toContain("street");
  });

  it("a block party with food vending is not the exception", () => {
    const cls = classify(
      answers({ eventType: "block_party", location: streetsLocation(["maple-400"]), attendance: 100, addOns: addOns({ foodVending: { vendors: 1 } }) }),
    );
    expect(cls.blockPartyException).toBe(false);
  });

  it("a block party with fireworks is Special: the exception removes only the street trigger", () => {
    const cls = classify(
      answers({ eventType: "block_party", location: streetsLocation(["maple-400"]), attendance: 100, addOns: addOns({ fireworksDrones: true }) }),
    );
    expect(cls.blockPartyException).toBe(true);
    expect(cls.triggers.map((t) => t.id)).toEqual(expect.arrayContaining(["block_party", "fireworks_drones"]));
    expect(cls.tier).toBe("special");
  });

  it("a null attendance counts as below the block-party threshold", () => {
    const cls = classify(answers({ eventType: "block_party", location: streetsLocation(["maple-400"]), attendance: null }));
    expect(cls.blockPartyException).toBe(true);
  });
});

describe("classify: who approves a space reservation", () => {
  const reservation = (a: ReturnType<typeof answers>) => classify(a).components.find((c) => c.id === "space_reservation")?.approvedBy;

  it("is automatic on an Instant plan, and says so only there", () => {
    const picnic = answers({ location: inventoryLocation(["shelter-2"]), attendance: 40 });
    expect(classify(picnic).tier).toBe("instant");
    expect(reservation(picnic)).toBe("City Clerk (automatic for Instant)");
  });

  it("on a Reviewed or Special plan the Clerk approves it like the rest: the picnic once alcohol is on, a gala for 1,200", () => {
    const withAlcohol = answers({ location: inventoryLocation(["shelter-2"]), attendance: 40, addOns: addOns({ alcohol: true }) });
    expect(classify(withAlcohol).tier).toBe("reviewed");
    expect(reservation(withAlcohol)).toBe("City Clerk");
    const gala = answers({ location: inventoryLocation(["shelter-2"]), attendance: 1200 });
    expect(classify(gala).tier).toBe("special");
    expect(reservation(gala)).toBe("City Clerk");
  });
});

describe("classify: partial answers", () => {
  it("works with nothing answered yet", () => {
    const cls = classify(answers({}));
    expect(cls.tier).toBe("instant");
    expect(cls.triggers).toEqual([]);
  });

  it("a null location, schedule or attendance adds no trigger", () => {
    const cls = classify(answers({ addOns: addOns({ amplifiedSound: true }) }));
    expect(cls.triggers.map((t) => t.id)).toEqual(["amplified_sound"]);
  });
});

describe("whatIf", () => {
  it("demo path 2: Shelter 2 with 40 is Instant; alcohol makes it Reviewed and whatIf offers the way back", () => {
    const base = answers({ location: inventoryLocation(["shelter-2"]), attendance: 40 });
    expect(classify(base).tier).toBe("instant");

    const withAlcohol = answers({ ...base, addOns: addOns({ alcohol: true }) });
    const cls = classify(withAlcohol);
    expect(cls.tier).toBe("reviewed");
    const offers = whatIf(withAlcohol);
    expect(offers.map((o) => o.triggerId)).toContain("alcohol");
    expect(offers.find((o) => o.triggerId === "alcohol")?.tier).toBe("instant");
  });

  it("demo path 2: two Main Street blocks is Special", () => {
    const cls = classify(answers({ location: streetsLocation(MAIN_1ST_TO_4TH.slice(0, 2)) }));
    expect(cls.tier).toBe("special");
  });

  it("demo path 2: 1,200 people with no street is still Special", () => {
    const cls = classify(answers({ location: inventoryLocation(["field-1"]), attendance: 1200 }));
    expect(cls.tier).toBe("special");
  });

  it("never offers to drop an attendance or location trigger", () => {
    const offers = whatIf(answers({ location: streetsLocation(MAIN_1ST_TO_4TH.slice(0, 2)), attendance: 1200 }));
    expect(offers.map((o) => o.triggerId)).not.toContain("street");
    expect(offers.map((o) => o.triggerId)).not.toContain("attendance_1000");
  });

  it("text reads like 'Remove alcohol: Instant, book today'", () => {
    const offers = whatIf(answers({ location: inventoryLocation(["shelter-2"]), attendance: 40, addOns: addOns({ alcohol: true }) }));
    expect(offers[0].text).toBe("Remove alcohol: Instant, book today");
  });
});
