import { describe, expect, it } from "vitest";
import { capacityWarning, closeoutCards } from "./closeout";
import { answers, eventCase, inventoryLocation } from "./test-helpers";

describe("capacityWarning", () => {
  it("40 people at Shelter 2 (capacity 40) is fine", () => {
    expect(capacityWarning(answers({ location: inventoryLocation(["shelter-2"]), attendance: 40 }))).toBeNull();
  });

  it("41 people at Shelter 2 warns and suggests Shelter 3 (capacity 60)", () => {
    const warning = capacityWarning(answers({ location: inventoryLocation(["shelter-2"]), attendance: 41 }));
    expect(warning).not.toBeNull();
    expect(warning!.over).toBe(1);
    expect(warning!.suggestionId).toBe("shelter-3");
    expect(warning!.text).toBe("Shelter 2 holds 40 people. Shelter 3 holds 60.");
  });

  it("never applies outside inventory mode", () => {
    expect(capacityWarning(answers({ attendance: 10000 }))).toBeNull();
  });
});

describe("closeoutCards", () => {
  it("S6 (Special, Closeout): final bill, feedback and book again, all locked", () => {
    const s6 = eventCase({ id: "PMT-27-0006", tier: "special", state: "closeout" });
    const cards = closeoutCards(s6);
    expect(cards.map((c) => c.catalogId).sort()).toEqual(["book_again", "feedback", "final_bill_or_refund"]);
    expect(cards.every((c) => c.status === "locked")).toBe(true);
  });

  it("an Instant event skips the final bill but still gets feedback and book again", () => {
    const instant = eventCase({ id: "PMT-27-0007", tier: "instant", state: "closed" });
    const cards = closeoutCards(instant);
    expect(cards.map((c) => c.catalogId).sort()).toEqual(["book_again", "feedback"]);
  });
});
