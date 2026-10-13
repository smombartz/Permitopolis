import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "@/lib/rules/config";
import { buildSeed } from "@/lib/state";
import type { EventCase } from "@/lib/types";
import {
  closeoutRows,
  damageRepairLine,
  existingFeeLines,
  feePresetsFor,
  isBlackoutDate,
  meetingDateValid,
  reviewMaterial,
  routingReasons,
  workOrderDetail,
} from "./reviewTools";

function caseById(cases: EventCase[], id: string): EventCase {
  const c = cases.find((candidate) => candidate.id === id);
  if (!c) throw new Error(`Seed is missing ${id}`);
  return c;
}

describe("reviewMaterial", () => {
  it("S3: Health & Legal sees its three sections, including the vendor's own health permit card by name", () => {
    const c = caseById(buildSeed(), "PMT-27-0118");
    const material = reviewMaterial(c, "hl");
    expect(material.map((m) => m.section)).toEqual(["Certificate of insurance", "Vendor list", "Health permit: Rolling Dumpling Co."]);

    const insurance = material.find((m) => m.section === "Certificate of insurance")!;
    expect(insurance.cards).toHaveLength(1);
    expect(insurance.cards[0].files.length).toBeGreaterThan(0);

    const vendorList = material.find((m) => m.section === "Vendor list")!;
    expect(vendorList.cards[0].rows.some((r) => r.label === "Vendors")).toBe(true);

    const healthPermit = material.find((m) => m.section === "Health permit: Rolling Dumpling Co.")!;
    expect(healthPermit.cards).toHaveLength(1);
    expect(healthPermit.cards[0].task.catalogId).toBe("vendor_health_permit");
  });

  it("S3: Public Works & Safety sees only its own routed section, with the applicant's sound-equipment answer", () => {
    const c = caseById(buildSeed(), "PMT-27-0118");
    const material = reviewMaterial(c, "pws");
    expect(material.map((m) => m.section)).toEqual(["Sound details"]);
    expect(material[0].cards[0].rows.find((r) => r.label === "Sound equipment")?.value).toContain("speakers");
  });

  it("S5: Public Works & Safety's seven sections and Health & Legal's two, each with its own cards", () => {
    const c = caseById(buildSeed(), "PMT-27-0097");
    const pws = reviewMaterial(c, "pws");
    expect(pws.map((m) => m.section)).toEqual([
      "Sound details",
      "City services request",
      "Site plan",
      "Traffic control plan",
      "Security and medical plan",
      "Emergency plan",
      "Cleanup plan",
    ]);
    expect(pws.every((m) => m.cards.length > 0)).toBe(true);

    const hl = reviewMaterial(c, "hl");
    expect(hl.map((m) => m.section)).toEqual(["Certificate of insurance", "Accessibility plan"]);
    expect(hl.every((m) => m.cards.length > 0)).toBe(true);
  });

  it("a department with nothing routed gets an empty list", () => {
    const c = caseById(buildSeed(), "PMT-27-0097");
    expect(reviewMaterial(c, "clerk")).toEqual([]);
  });
});

describe("routingReasons", () => {
  it("S5: Public Works & Safety's reasons name the triggers, in plain words", () => {
    const c = caseById(buildSeed(), "PMT-27-0097");
    const reasons = routingReasons(c, "pws", DEFAULT_CONFIG);
    expect(reasons).toContain("Amplified sound");
    expect(reasons.length).toBeGreaterThan(0);
  });
});

describe("feePresetsFor", () => {
  it("builds Public Works & Safety's presets from the applicant's own city-services request", () => {
    const c = caseById(buildSeed(), "PMT-27-0031"); // S6: 20 barricades, 11 officers x 6 hours
    const presets = feePresetsFor("pws", c, DEFAULT_CONFIG);
    const police = presets.find((p) => p.label === "Police")!;
    expect(police.qty).toBe(66);
    expect(police.unitPrice).toBe(DEFAULT_CONFIG.fees.policePerOfficerHour);
    const barricades = presets.find((p) => p.label === "Barricades")!;
    expect(barricades.qty).toBe(20);
    expect(barricades.unitPrice).toBe(DEFAULT_CONFIG.fees.barricadeEachPerDay);
  });

  it("builds Health & Legal's vendor-permit preset from the vendor count", () => {
    const c = caseById(buildSeed(), "PMT-27-0031");
    const presets = feePresetsFor("hl", c, DEFAULT_CONFIG);
    expect(presets).toEqual([{ dept: "hl", label: "Food or vendor permit", qty: 25, unit: "vendor", unitPrice: 75 }]);
  });

  it("builds the Clerk's alcohol-license preset at one day", () => {
    const c = caseById(buildSeed(), "PMT-27-0031");
    const presets = feePresetsFor("clerk", c, DEFAULT_CONFIG);
    expect(presets).toEqual([{ dept: "clerk", label: "Temporary alcohol license", qty: 1, unit: "day", unitPrice: 100 }]);
  });
});

describe("existingFeeLines", () => {
  it("S6: lists the lines Public Works & Safety's plan already carries, so a preset never doubles one up", () => {
    const c = caseById(buildSeed(), "PMT-27-0031");
    const lines = existingFeeLines(c, "pws");
    expect(lines.map((l) => l.label).sort()).toEqual(["Barricades", "Police", "Structure fire inspection"]);
  });
});

describe("closeoutRows", () => {
  it("S6: 72 officer-hours against an estimate of 66, plus 4 crew-hours, reads $750 over", () => {
    const c = caseById(buildSeed(), "PMT-27-0031");
    const police = existingFeeLines(c, "pws").find((l) => l.label === "Police")!;
    expect(police.qty).toBe(66);

    const summary = closeoutRows(c, "pws", { [police.id]: 72 }, [damageRepairLine("Cleanup crew", 0), { dept: "pws", label: "Cleanup crew", qty: 4, unit: "worker-hour", unitPrice: 60 }]);
    const policeRow = summary.rows.find((r) => r.label === "Police")!;
    expect(policeRow.actualAmount).toBe(72 * 85);
    expect(policeRow.difference).toBe(510);
    // Barricades and the fire inspection were left alone, so they keep their estimate.
    const barricadesRow = summary.rows.find((r) => r.label === "Barricades")!;
    expect(barricadesRow.actualQty).toBeNull();
    expect(barricadesRow.difference).toBe(0);
    expect(summary.runningTotal).toBe(750);
  });

  it("a line left untouched keeps its estimate", () => {
    const c = caseById(buildSeed(), "PMT-27-0031");
    const summary = closeoutRows(c, "pws", {});
    expect(summary.rows.every((r) => r.actualQty === null && r.difference === 0)).toBe(true);
    expect(summary.runningTotal).toBe(0);
  });
});

describe("damageRepairLine", () => {
  it("labels the extra line from the issue, as F7's seed script writes it", () => {
    expect(damageRepairLine("Broken picnic table", 95)).toEqual({ dept: "pws", label: "Broken picnic table repair", qty: 1, unit: "item", unitPrice: 95 });
  });
});

describe("isBlackoutDate", () => {
  it("flags Memorial Day and the fireworks closures", () => {
    expect(isBlackoutDate("2027-05-31")).toBe(true);
    expect(isBlackoutDate("2027-07-04")).toBe(true);
    expect(isBlackoutDate("2027-06-01")).toBe(false);
  });
});

describe("meetingDateValid", () => {
  it("S5: a walkthrough cannot be scheduled after the event", () => {
    const c = caseById(buildSeed(), "PMT-27-0097"); // the 5K is Jul 11
    expect(meetingDateValid(c, "2027-07-20", "2027-05-03").ok).toBe(false);
    expect(meetingDateValid(c, "2027-07-11", "2027-05-03").ok).toBe(false); // not on the event day itself
    expect(meetingDateValid(c, "2027-06-15", "2027-05-03").ok).toBe(true);
  });

  it("refuses a date before today or on a citywide blackout", () => {
    const c = caseById(buildSeed(), "PMT-27-0097");
    expect(meetingDateValid(c, "2027-04-01", "2027-05-03").ok).toBe(false);
    expect(meetingDateValid(c, "2027-05-31", "2027-05-03").ok).toBe(false);
  });
});

describe("workOrderDetail", () => {
  it("B14: the barricades work order names its quantity, event and due date", () => {
    const c = caseById(buildSeed(), "PMT-27-0030");
    const task = c.tasks.find((t) => t.catalogId === "work_order:barricades")!;
    const detail = workOrderDetail(c, task);
    expect(detail.what).toBe("Deliver barricades");
    expect(detail.quantity).toBe("30 barricades");
    expect(detail.eventName).toBe(c.name);
    expect(detail.eventDate).toBe("2027-08-14");
  });

  it("B14: the police work order reads officers and hours", () => {
    const c = caseById(buildSeed(), "PMT-27-0030");
    const task = c.tasks.find((t) => t.catalogId === "work_order:police")!;
    expect(workOrderDetail(c, task).quantity).toBe("6 officers × 4h");
  });
});
