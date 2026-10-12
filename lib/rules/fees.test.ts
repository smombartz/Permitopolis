import { describe, expect, it } from "vitest";
import { MAIN_1ST_TO_4TH, milesOf, RIVERFRONT_5K_ROUTE } from "@/lib/data/streets";
import { classify } from "./classify";
import { estimateFees } from "./fees";
import { occurrences } from "./availability";
import { answers, addOns, areaLocation, ctx, inventoryLocation, routeLocation, schedule, streetsLocation } from "./test-helpers";

describe("estimateFees: section 6.1 totals", () => {
  it("S1: $125", () => {
    const a = answers({
      location: inventoryLocation(["shelter-3"]),
      schedule: schedule({ date: "2027-05-22", start: "11:00", end: "16:00" }),
      attendance: 45,
    });
    const cls = classify(a);
    expect(estimateFees(a, cls).total).toBe(125);
  });

  it("S2: $20 a session, 13 sessions, $260 in all, $20 due now", () => {
    const location = inventoryLocation(["field-4"]);
    const baseSchedule = schedule({
      date: "2027-06-06",
      start: "08:00",
      end: "09:00",
      recurrence: { frequency: "weekly", weekday: 0, until: "2027-08-29" },
    });
    const occs = occurrences(baseSchedule, location, ctx());
    expect(occs).toHaveLength(13);
    const a = answers({ location, schedule: { ...baseSchedule, occurrences: occs }, attendance: 20 });
    const cls = classify(a);
    const est = estimateFees(a, cls);
    expect(est.perSession).toBe(20);
    expect(est.sessions).toBe(13);
    expect(est.total).toBe(260);
    expect(est.dueNow).toBe(20);
  });

  it("S3: application 50 + plaza 300 + sound 40 + 1 vendor 75 + deposit 250 = $715", () => {
    const a = answers({
      location: areaLocation("city-hall-plaza"),
      schedule: schedule({ date: "2027-06-18", start: "18:00", end: "21:00" }),
      attendance: 150,
      addOns: addOns({ amplifiedSound: true, foodVending: { vendors: 1 } }),
    });
    const cls = classify(a);
    const est = estimateFees(a, cls);
    expect(est.total).toBe(715);
    expect(est.lines.find((l) => l.label === "Application fee")?.estimate).toBe(50);
    expect(est.lines.find((l) => l.label.includes("Plaza"))?.estimate).toBe(300);
    expect(est.lines.find((l) => l.label === "Amplified sound")?.estimate).toBe(40);
    expect(est.lines.find((l) => l.label === "Food or vendor permit")?.estimate).toBe(75);
    expect(est.lines.find((l) => l.kind === "deposit")?.estimate).toBe(250);
  });

  it("S4: application 50 + 1 block closure 150 + 4 barricades 60 + deposit 250 = $510", () => {
    const a = answers({
      eventType: "block_party",
      location: streetsLocation(["maple-400"]),
      schedule: schedule({ date: "2027-06-26", start: "14:00", end: "20:00" }),
      attendance: 120,
      addOns: addOns({ cityServices: { barricades: 4, trash: false, power: false, policeOfficers: 0, policeHours: 0 } }),
    });
    const cls = classify(a);
    expect(estimateFees(a, cls).total).toBe(510);
  });

  it("S5: application 250 + route 1,240 + sound 40 + police 3,400 + barricades 600 + deposit 1,000 = $6,530", () => {
    expect(milesOf(RIVERFRONT_5K_ROUTE)).toBe(3.1);
    const a = answers({
      location: routeLocation(RIVERFRONT_5K_ROUTE, { miles: 3.1 }),
      schedule: schedule({ date: "2027-07-11", start: "07:00", end: "11:00" }),
      attendance: 1200,
      addOns: addOns({ amplifiedSound: true, cityServices: { barricades: 40, trash: false, power: false, policeOfficers: 8, policeHours: 5 } }),
    });
    const cls = classify(a);
    const est = estimateFees(a, cls);
    expect(est.lines.find((l) => l.label === "Route closure")?.estimate).toBe(1240);
    expect(est.lines.find((l) => l.label === "Police")?.estimate).toBe(3400);
    expect(est.total).toBe(6530);
  });

  it("S6: $9,645", () => {
    const a = answers({
      location: streetsLocation(MAIN_1ST_TO_4TH),
      schedule: schedule({ date: "2027-04-24", start: "12:00", end: "21:00" }),
      attendance: 3000,
      addOns: addOns({
        foodVending: { vendors: 25 },
        alcohol: true,
        tentsStages: { count: 1 },
        cityServices: { barricades: 20, trash: false, power: false, policeOfficers: 1, policeHours: 66 },
      }),
    });
    const cls = classify(a);
    expect(estimateFees(a, cls).total).toBe(9645);
  });
});

describe("estimateFees: late fee", () => {
  it("adds 25% of the fees excluding the deposit", () => {
    const a = answers({
      location: inventoryLocation(["shelter-3"]),
      schedule: schedule({ date: "2027-05-22", start: "11:00", end: "16:00" }),
      attendance: 45,
      addOns: addOns({ amplifiedSound: true }),
    });
    const cls = classify(a);
    const withoutLate = estimateFees(a, cls);
    const withLate = estimateFees(a, cls, undefined, { lateFee: true });
    const lateLine = withLate.lines.find((l) => l.kind === "late_fee");
    expect(lateLine).toBeDefined();
    const feesExclDeposit = withoutLate.lines.filter((l) => l.kind === "fee").reduce((s, l) => s + l.estimate, 0);
    expect(lateLine!.estimate).toBeCloseTo(feesExclDeposit * 0.25, 5);
  });
});

describe("estimateFees: line ids", () => {
  it("are caseId:fee:n when a caseId is given, else fee:n", () => {
    const a = answers({ location: inventoryLocation(["shelter-3"]), schedule: schedule({ date: "2027-05-22", start: "11:00", end: "16:00" }) });
    const cls = classify(a);
    expect(estimateFees(a, cls).lines[0].id).toBe("fee:1");
    expect(estimateFees(a, cls, undefined, { caseId: "PMT-27-0001" }).lines[0].id).toBe("PMT-27-0001:fee:1");
  });
});
