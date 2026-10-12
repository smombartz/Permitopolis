import { describe, expect, it } from "vitest";
import { classify } from "./classify";
import { requirements } from "./requirements";
import { answers, addOns, areaLocation, inventoryLocation, streetsLocation } from "./test-helpers";

describe("requirements: S3 (Jazz in the Plaza)", () => {
  it("creates exactly the eight cards the plan names", () => {
    const a = answers({
      location: areaLocation("city-hall-plaza"),
      schedule: { date: "2027-06-18", start: "18:00", end: "21:00", occurrences: [] },
      attendance: 150,
      addOns: addOns({ amplifiedSound: true, foodVending: { vendors: 1, vendorNames: ["Rolling Dumpling Co."] } }),
    });
    const cls = classify(a);
    const tasks = requirements(a, cls, { caseId: "PMT-27-0118", today: "2027-04-16" });
    expect(tasks.map((t) => t.catalogId)).toEqual([
      "insurance_certificate",
      "sound_details",
      "vendor_list",
      "vendor_health_permit",
      "submit_application",
      "accept_and_sign",
      "pay_fees",
      "carry_permit",
    ]);
  });

  it("ids the per-vendor card :1 and names the vendor in its title", () => {
    const a = answers({
      location: areaLocation("city-hall-plaza"),
      schedule: { date: "2027-06-18", start: "18:00", end: "21:00", occurrences: [] },
      attendance: 150,
      addOns: addOns({ amplifiedSound: true, foodVending: { vendors: 1, vendorNames: ["Rolling Dumpling Co."] } }),
    });
    const cls = classify(a);
    const tasks = requirements(a, cls, { caseId: "PMT-27-0118", today: "2027-04-16" });
    const vendorCard = tasks.find((t) => t.catalogId === "vendor_health_permit")!;
    expect(vendorCard.id).toBe("PMT-27-0118:vendor_health_permit:1");
    expect(vendorCard.title).toBe("Health permit: Rolling Dumpling Co.");
  });

  it("locks every card after submit_application and leaves the pre-submit cards open", () => {
    const a = answers({
      location: areaLocation("city-hall-plaza"),
      schedule: { date: "2027-06-18", start: "18:00", end: "21:00", occurrences: [] },
      attendance: 150,
      addOns: addOns({ amplifiedSound: true, foodVending: { vendors: 1 } }),
    });
    const cls = classify(a);
    const tasks = requirements(a, cls, { caseId: "PMT-27-0118", today: "2027-04-16" });
    expect(tasks.find((t) => t.catalogId === "insurance_certificate")!.status).toBe("todo");
    expect(tasks.find((t) => t.catalogId === "accept_and_sign")!.status).toBe("locked");
    expect(tasks.find((t) => t.catalogId === "accept_and_sign")!.unlocksOn).toBe("quote_sent");
  });
});

describe("requirements: multiple vendors", () => {
  it("one health-permit card per vendor, named from vendorNames with a fallback", () => {
    const a = answers({
      location: areaLocation("city-hall-plaza"),
      attendance: 150,
      addOns: addOns({ foodVending: { vendors: 3, vendorNames: ["Alpha", "Beta"] } }),
    });
    const cls = classify(a);
    const tasks = requirements(a, cls, { caseId: "PMT-27-0999", today: "2027-01-01" });
    const vendorCards = tasks.filter((t) => t.catalogId === "vendor_health_permit");
    expect(vendorCards.map((t) => t.id)).toEqual(["PMT-27-0999:vendor_health_permit:1", "PMT-27-0999:vendor_health_permit:2", "PMT-27-0999:vendor_health_permit:3"]);
    expect(vendorCards.map((t) => t.title)).toEqual(["Health permit: Alpha", "Health permit: Beta", "Health permit: Vendor 3"]);
  });
});

describe("requirements: block party", () => {
  it("adds a neighbor sign-off card with progress out of the block's households, and no traffic control plan", () => {
    const a = answers({
      eventType: "block_party",
      location: streetsLocation(["maple-400"]),
      attendance: 100,
      addOns: addOns({ cityServices: { barricades: 4, trash: false, power: false, policeOfficers: 0, policeHours: 0 } }),
    });
    const cls = classify(a);
    const tasks = requirements(a, cls, { caseId: "PMT-27-0004", today: "2027-05-01" });
    const signoff = tasks.find((t) => t.catalogId === "neighbor_signoff")!;
    expect(signoff.payload.progress).toEqual({ done: 0, total: 12 });
    expect(tasks.find((t) => t.catalogId === "traffic_control_plan")).toBeUndefined();
    expect(tasks.find((t) => t.catalogId === "city_services_request")).toBeDefined();
  });
});

describe("requirements: pay_fees", () => {
  it("Instant events show 'Pay and book', open from the start, with the total as the amount", () => {
    const a = answers({ location: inventoryLocation(["shelter-3"]), schedule: { date: "2027-05-22", start: "11:00", end: "16:00", occurrences: [] }, attendance: 45 });
    const cls = classify(a);
    const tasks = requirements(a, cls, { caseId: "PMT-27-0001", today: "2027-05-01" });
    const pay = tasks.find((t) => t.catalogId === "pay_fees")!;
    expect(pay.title).toBe("Pay and book");
    expect(pay.status).toBe("todo");
    expect(pay.unlocksOn).toBeNull();
    expect(pay.payload.amount).toBe(125);
  });

  it("a Reviewed or Special event's pay_fees stays locked until the quote is sent, with the total due", () => {
    const a = answers({ location: areaLocation("city-hall-plaza"), schedule: { date: "2027-06-18", start: "18:00", end: "21:00", occurrences: [] }, attendance: 150 });
    const cls = classify(a);
    const tasks = requirements(a, cls, { caseId: "PMT-27-0118", today: "2027-04-16" });
    const pay = tasks.find((t) => t.catalogId === "pay_fees")!;
    expect(pay.title).toBe("Pay fees and deposit");
    expect(pay.status).toBe("locked");
    expect(pay.unlocksOn).toBe("quote_sent");
  });

  it("a series' pay_fees shows what's due now (the first session), not the full total", () => {
    const occs = [
      { date: "2027-06-06", availability: { status: "open" as const }, billing: "upcoming" as const },
      { date: "2027-06-13", availability: { status: "open" as const }, billing: "upcoming" as const },
    ];
    const a = answers({
      location: inventoryLocation(["field-4"]),
      schedule: { date: "2027-06-06", start: "08:00", end: "09:00", recurrence: { frequency: "weekly", weekday: 0, until: "2027-06-13" }, occurrences: occs },
      attendance: 20,
    });
    const cls = classify(a);
    const tasks = requirements(a, cls, { caseId: "PMT-27-0142", today: "2027-05-01" });
    const pay = tasks.find((t) => t.catalogId === "pay_fees")!;
    expect(pay.payload.amount).toBe(20);
  });
});

describe("requirements: why", () => {
  it("every card names the answer that created it", () => {
    const a = answers({ location: areaLocation("city-hall-plaza"), attendance: 150, addOns: addOns({ amplifiedSound: true }) });
    const cls = classify(a);
    const tasks = requirements(a, cls, { caseId: "PMT-27-0001", today: "2027-01-01" });
    for (const task of tasks) expect(task.why.length).toBeGreaterThan(0);
    expect(tasks.find((t) => t.catalogId === "sound_details")!.why).toMatch(/sound/i);
  });
});
