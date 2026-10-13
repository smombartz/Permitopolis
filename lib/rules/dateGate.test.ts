import { describe, expect, it } from "vitest";
import { classify } from "./classify";
import { dateGate } from "./dateGate";
import { answers, addOns, areaLocation, ctx, eventCase, inventoryLocation, schedule } from "./test-helpers";

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
    // Plan 6.1: exactly the three fixes, in the order the wizard offers them.
    expect(gate.fixes).toEqual(["new_date", "drop_addon", "late_fee"]);
    expect(gate.droppable).toEqual(["amplified_sound"]);
    // 25% of the fees without the deposit: shelter $125, sound $40 and the application fee $50.
    expect(gate.lateFeeAmount).toBe(53.75);
    // The first open date 30 days out.
    expect(gate.earliestDate).toBe("2027-06-02");
  });

  describe("which fixes are offered", () => {
    const shelter3 = inventoryLocation(["shelter-3"]);
    const withSound = (date: string) =>
      answers({ location: shelter3, schedule: schedule({ date, start: "11:00", end: "16:00" }), attendance: 45, addOns: addOns({ amplifiedSound: true }) });
    /** Another permit on Shelter 3 that day, at the same hours. */
    const rival = (date: string) =>
      eventCase({ id: "PMT-27-0900", name: "Another picnic", state: "permitted", location: shelter3, schedule: schedule({ date, start: "11:00", end: "16:00" }) });

    it("none when the gate passes, even with an add-on that could be dropped", () => {
      // Sat, Jun 19 is 47 days out: a Reviewed event needs 30.
      const a = withSound("2027-06-19");
      const gate = dateGate(a, classify(a), ctx({ today: "2027-05-03" }));
      expect(gate).toMatchObject({ ok: true, leadTimeOk: true, fixes: [], droppable: [] });
    });

    it("only a new date when the date is booked: dropping an add-on or paying a late fee does not free it", () => {
      const a = withSound("2027-06-19");
      const gate = dateGate(a, classify(a), ctx({ today: "2027-05-03", cases: [rival("2027-06-19")] }));
      expect(gate.availability.status).toBe("booked");
      expect(gate).toMatchObject({ ok: false, leadTimeOk: true, fixes: ["new_date"], droppable: [] });
    });

    it("only a new date on a blackout date", () => {
      const a = withSound("2027-05-31");
      const gate = dateGate(a, classify(a), ctx({ today: "2027-04-01" }));
      expect(gate.availability.status).toBe("blackout");
      expect(gate).toMatchObject({ ok: false, leadTimeOk: true, fixes: ["new_date"], droppable: [] });
    });

    it("only a new date when the date is both too close and booked", () => {
      const a = withSound("2027-05-22");
      const gate = dateGate(a, classify(a), ctx({ today: "2027-05-03", cases: [rival("2027-05-22")] }));
      expect(gate).toMatchObject({ ok: false, leadTimeOk: false, fixes: ["new_date"] });
    });

    it("a new date or the late fee when no add-on can be dropped (a plaza is Reviewed by its location)", () => {
      const a = answers({ location: areaLocation("city-hall-plaza"), schedule: schedule({ date: "2027-05-22", start: "11:00", end: "16:00" }), attendance: 45 });
      const gate = dateGate(a, classify(a), ctx({ today: "2027-05-03" }));
      expect(gate).toMatchObject({ ok: false, leadTimeOk: false, fixes: ["new_date", "late_fee"], droppable: [] });
    });
  });

  it("with no date yet there is nothing to fail: no lead-time failure and no fixes", () => {
    const a = answers({ location: inventoryLocation(["shelter-3"]), attendance: 45, addOns: addOns({ amplifiedSound: true }) });
    const cls = classify(a);
    const gate = dateGate(a, cls, ctx({ today: "2027-05-03" }));
    expect(gate).toMatchObject({ leadTimeOk: true, ok: true, fixes: [], droppable: [], availability: { status: "open" } });
    // Still worth showing: the first day this tier could be held.
    expect(gate.earliestDate).toBe("2027-06-02");
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
