import { describe, expect, it } from "vitest";
import { classify } from "./classify";
import { DEFAULT_CONFIG } from "./config";
import { routing } from "./routing";
import { answers, addOns, areaLocation, streetsLocation } from "./test-helpers";

describe("routing", () => {
  it("S3: Public Works & Safety (sound) and Health & Legal (vendor, insurance)", () => {
    const a = answers({
      location: areaLocation("city-hall-plaza"),
      attendance: 150,
      addOns: addOns({ amplifiedSound: true, foodVending: { vendors: 1 } }),
    });
    const cls = classify(a);
    const r = routing(a, cls);
    expect(r.map((x) => x.dept)).toEqual(["pws", "hl"]);
    const pws = r.find((x) => x.dept === "pws")!;
    expect(pws.reasons).toContain("Amplified sound");
    expect(pws.sections).toContain("Sound details");
    const hl = r.find((x) => x.dept === "hl")!;
    expect(hl.sections).toContain("Vendor list");
  });

  it("routing() includes the Clerk only when there is alcohol, never for Special alone", () => {
    const special = answers({ location: streetsLocation(["main-1-2", "main-2-3"]), attendance: 1200 });
    const cls = classify(special);
    expect(routing(special, cls).map((x) => x.dept)).not.toContain("clerk");

    const withAlcohol = answers({ ...special, addOns: addOns({ alcohol: true }) });
    const clsAlcohol = classify(withAlcohol);
    expect(routing(withAlcohol, clsAlcohol).map((x) => x.dept)).toContain("clerk");
  });

  it("Classification.reviewers includes the Clerk for every Special event, unlike routing()", () => {
    const special = answers({ location: streetsLocation(["main-1-2", "main-2-3"]), attendance: 1200 });
    const cls = classify(special);
    expect(cls.reviewers.map((x) => x.dept)).toContain("clerk");
    expect(routing(special, cls).map((x) => x.dept)).not.toContain("clerk");
  });

  it("every Reviewed and Special event routes Health & Legal for insurance even with no other add-on", () => {
    const a = answers({ location: areaLocation("great-lawn"), attendance: 150 });
    const cls = classify(a);
    const hl = routing(a, cls).find((x) => x.dept === "hl");
    expect(hl?.reasons).toContain("Insurance verification");
  });

  it("an Instant event has no reviewers", () => {
    const a = answers({});
    const cls = classify(a);
    expect(routing(a, cls)).toEqual([]);
  });

  it("S4: Public Works & Safety for the block party and its barricades, Health & Legal for insurance", () => {
    const a = answers({
      eventType: "block_party",
      location: streetsLocation(["maple-400"]),
      attendance: 120,
      addOns: addOns({ cityServices: { barricades: 4, trash: false, power: false, policeOfficers: 0, policeHours: 0 } }),
    });
    const r = routing(a, classify(a));
    expect(r.map((x) => [x.dept, x.reasons, x.sections])).toEqual([
      ["pws", ["Block party", "City services"], ["City services request"]],
      ["hl", ["Insurance verification"], ["Certificate of insurance"]],
    ]);
  });
});

describe("routing reads the classification and the config, never its own copy of a rule", () => {
  it("a block party too big for the exception is routed as the street closure it is", () => {
    // 300 people on one residential block: Special, not the block-party exception.
    const a = answers({ eventType: "block_party", location: streetsLocation(["maple-400"]), attendance: 300 });
    const cls = classify(a);
    expect(cls).toMatchObject({ tier: "special", blockPartyException: false });

    const pws = routing(a, cls).find((x) => x.dept === "pws")!;
    expect(pws.reasons).toContain("Street closure");
    // The exception swaps the traffic control plan for a barricade request. It does not apply here.
    expect(pws.sections).toContain("Traffic control plan");
    // No neighbor sign-off card exists on this plan, so nobody is told they review one.
    for (const reviewer of cls.reviewers) expect(reviewer.sections, reviewer.dept).not.toContain("Neighbor sign-off");
  });

  it("the same block party with vendors is not the exception either", () => {
    const a = answers({ eventType: "block_party", location: streetsLocation(["maple-400"]), attendance: 120, addOns: addOns({ foodVending: { vendors: 2 } }) });
    const cls = classify(a);
    expect(cls.blockPartyException).toBe(false);
    expect(cls.reviewers.find((x) => x.dept === "pws")?.sections).toContain("Traffic control plan");
  });

  it("the attendance reason names the configured threshold", () => {
    const crowd = answers({ location: areaLocation("great-lawn"), attendance: 1200 });
    const reasons = (cfg = DEFAULT_CONFIG) => routing(crowd, classify(crowd, cfg), cfg).find((x) => x.dept === "pws")?.reasons;
    expect(reasons()).toContain("1,000 or more attendees");

    const lower = { ...DEFAULT_CONFIG, thresholds: { ...DEFAULT_CONFIG.thresholds, specialAttendance: 750 } };
    expect(reasons(lower)).toContain("750 or more attendees");
    expect(classify(crowd, lower).reviewers.find((x) => x.dept === "pws")?.reasons).toContain("750 or more attendees");
  });
});
