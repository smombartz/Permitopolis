import { describe, expect, it } from "vitest";
import { classify } from "./classify";
import { dateGate } from "./dateGate";
import { answers, addOns, ctx, inventoryLocation, schedule } from "./test-helpers";

describe("dateGate", () => {
  it("S1 plain picnic on May 3 is ok: 19 days meets the 10-day Instant lead time", () => {
    const a = answers({ location: inventoryLocation(["shelter-3"]), schedule: schedule({ date: "2027-05-22", start: "11:00", end: "16:00" }), attendance: 45 });
    const cls = classify(a);
    const gate = dateGate(a, cls, ctx({ today: "2027-05-03" }));
    expect(gate.daysUntil).toBe(19);
    expect(gate.leadTimeOk).toBe(true);
    expect(gate.ok).toBe(true);
    expect(gate.fixes).toEqual([]);
  });

  it("S1 with amplified sound on May 3: Reviewed needs 30 days, only 19 are left, so new date, drop sound or a late fee", () => {
    const a = answers({
      location: inventoryLocation(["shelter-3"]),
      schedule: schedule({ date: "2027-05-22", start: "11:00", end: "16:00" }),
      attendance: 45,
      addOns: addOns({ amplifiedSound: true }),
    });
    const cls = classify(a);
    expect(cls.tier).toBe("reviewed");
    const gate = dateGate(a, cls, ctx({ today: "2027-05-03" }));
    expect(gate.daysUntil).toBe(19);
    expect(gate.leadTimeOk).toBe(false);
    expect(gate.ok).toBe(false);
    expect(gate.fixes).toEqual(expect.arrayContaining(["new_date", "drop_addon", "late_fee"]));
    expect(gate.droppable).toContain("amplified_sound");
    expect(gate.lateFeeAmount).toBeGreaterThan(0);
  });

  it("earliestDate meets the lead time and is open or impacted", () => {
    const a = answers({ location: inventoryLocation(["shelter-1"]), schedule: schedule({ date: "2027-05-10", start: "10:00", end: "12:00" }) });
    const cls = classify(a);
    const gate = dateGate(a, cls, ctx({ today: "2027-05-03" }));
    expect(gate.earliestDate >= "2027-05-13").toBe(true);
  });

  it("a blackout date fails even when the lead time is met", () => {
    const a = answers({ location: inventoryLocation(["shelter-1"]), schedule: schedule({ date: "2027-05-31", start: "10:00", end: "12:00" }) });
    const cls = classify(a);
    const gate = dateGate(a, cls, ctx({ today: "2027-05-03" }));
    expect(gate.availability.status).toBe("blackout");
    expect(gate.ok).toBe(false);
    expect(gate.fixes).toContain("new_date");
  });
});
