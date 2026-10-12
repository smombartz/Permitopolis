import { describe, expect, it } from "vitest";
import { EMPTY_ADDONS } from "@/lib/types";
import { newCase } from "./newCase";

describe("newCase", () => {
  it("is a blank Draft: tier instant, empty collections, EMPTY_ADDONS, no hold, no ending", () => {
    const c = newCase({ id: "PMT-27-0001", applicantId: "p1", createdAt: "2027-05-03T09:00" });
    expect(c.state).toBe("draft");
    expect(c.tier).toBe("instant");
    expect(c.triggers).toEqual([]);
    expect(c.tasks).toEqual([]);
    expect(c.reviews).toEqual([]);
    expect(c.conditions).toEqual([]);
    expect(c.feeLines).toEqual([]);
    expect(c.payments).toEqual([]);
    // The case's first activity entry: plan 6.2's "one activity entry" row is a Draft and nothing else.
    expect(c.activity).toEqual([{ at: "2027-05-03T09:00", actor: "applicant", text: "Started a draft." }]);
    expect(c.addOns).toEqual(EMPTY_ADDONS);
    expect(c.dateHold).toEqual({ status: "none", placedOn: null, expiresOn: null });
    expect(c.ending).toBeNull();
    expect(c.permit).toBeNull();
    expect(c.clonedFrom).toBeNull();
  });

  it("applies partial answers given to it", () => {
    const c = newCase({ id: "PMT-27-0002", applicantId: "p1", createdAt: "2027-05-03T09:00", answers: { name: "Birthday picnic", attendance: 45 } });
    expect(c.name).toBe("Birthday picnic");
    expect(c.attendance).toBe(45);
  });
});
