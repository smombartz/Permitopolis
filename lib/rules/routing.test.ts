import { describe, expect, it } from "vitest";
import { classify } from "./classify";
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
});
