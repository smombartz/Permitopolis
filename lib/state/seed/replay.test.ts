/**
 * replayScripts() on small scripts made for the purpose. What the real 38 scripts produce on the
 * demo date is asserted in tests/seed.test.ts.
 */
import { describe, expect, it } from "vitest";
import type { EventAnswers } from "@/lib/types";
import type { SeedScript, SeedStep } from "../types";
import { addOns, inventoryLocation, singleSchedule } from "./helpers";
import { replayScripts, SeedReplayError } from "./replay";

/** A picnic at Shelter 3 on Sat, May 22, as S1 books it. */
const picnic = (name: string, date = "2027-05-22"): EventAnswers => ({
  eventType: "picnic_party",
  name,
  location: inventoryLocation(["shelter-3"]),
  schedule: singleSchedule(date, "11:00", "16:00"),
  attendance: 45,
  addOns: addOns({}),
});

function script(key: string, id: string, createdAt: string, answers: EventAnswers, steps: SeedStep[]): SeedScript {
  return { key, id, applicantId: "test", createdAt, answers, steps, expect: { tier: "instant", state: "permitted" } };
}

const book = (at: string): SeedStep[] => [
  { at, actor: "applicant", action: { type: "create_board" } },
  { at: at.replace(/:00$/, ":05"), actor: "applicant", action: { type: "book_and_pay", method: "card" } },
];

describe("replayScripts", () => {
  it("builds each case through the engine: a Draft from the answers, then every step at its own time", () => {
    const [c] = replayScripts([script("T1", "PMT-27-9001", "2027-04-26T09:00", picnic("Picnic"), book("2027-04-26T09:00"))]);
    expect(c).toMatchObject({ id: "PMT-27-9001", tier: "instant", state: "permitted", createdAt: "2027-04-26T09:00" });
    expect(c.activity.map((a) => a.at)).toEqual(["2027-04-26T09:00", "2027-04-26T09:00", "2027-04-26T09:05"]);
    expect(c.payments).toMatchObject([{ at: "2027-04-26T09:05", kind: "booking", amount: 125 }]);
    // The session list is the rules engine's, not the script's.
    expect(c.schedule?.occurrences).toEqual([{ date: "2027-05-22", availability: { status: "open" }, billing: "paid" }]);
  });

  it("a refused step throws, naming the script, the step and the engine's reason", () => {
    const twice = script("T1", "PMT-27-9001", "2027-04-26T09:00", picnic("Picnic"), [
      ...book("2027-04-26T09:00"),
      { at: "2027-04-27T10:00", actor: "applicant", action: { type: "book_and_pay", method: "card" } },
    ]);
    expect(() => replayScripts([twice])).toThrow(
      "Seed script T1 (PMT-27-9001): step 3, book_and_pay by applicant at 2027-04-27T10:00, was refused: This case is permitted.",
    );
    try {
      replayScripts([twice]);
    } catch (error) {
      expect(error).toBeInstanceOf(SeedReplayError);
      expect(error).toMatchObject({ scriptKey: "T1", caseId: "PMT-27-9001", stepNumber: 3, reason: "This case is permitted." });
    }
  });

  it("a step by a party that may not take it is refused like any other", () => {
    const wrongActor = script("T1", "PMT-27-9001", "2027-04-26T09:00", picnic("Picnic"), [{ at: "2027-04-26T09:00", actor: "clerk", action: { type: "create_board" } }]);
    expect(() => replayScripts([wrongActor])).toThrow("was refused: Only the applicant can confirm the plan.");
  });

  describe("all cases interleaved in time order", () => {
    // Two picnics want Shelter 3 on May 22. "Early" starts its draft first and books last.
    const early = script("EARLY", "PMT-27-9001", "2027-04-20T09:00", picnic("Early picnic"), book("2027-04-28T09:00"));
    const late = script("LATE", "PMT-27-9002", "2027-04-25T09:00", picnic("Late picnic"), book("2027-04-26T09:00"));

    it("the case that books first in time holds the slot, whichever script comes first in the list", () => {
      // Replayed case by case, "Early" would book on Apr 28 with nobody in its way.
      for (const scripts of [[early, late], [late, early]]) {
        expect(() => replayScripts(scripts)).toThrow("Seed script EARLY (PMT-27-9001): step 2, book_and_pay by applicant at 2027-04-28T09:05, was refused: Late picnic has this date held");
      }
    });

    it("up to the day before, both are still on their way", () => {
      const cases = replayScripts([early, late], { until: "2027-04-27" });
      expect(cases.map((c) => [c.id, c.state])).toEqual([
        ["PMT-27-9001", "draft"],
        ["PMT-27-9002", "permitted"],
      ]);
    });

    it("a Draft left untouched shows the availability of the day the replay ends on", () => {
      const draftOnly = script("DRAFT", "PMT-27-9001", "2027-04-20T09:00", picnic("Early picnic"), []);
      const [draft] = replayScripts([draftOnly, late]);
      // Open when it was started on Apr 20; Late booked the slot on Apr 26.
      expect(draft.schedule?.occurrences[0].availability).toMatchObject({ status: "booked", reason: "Late picnic has this date held" });
    });
  });

  it("the clock advances for every case between steps and on to the end date", () => {
    const april = script("T1", "PMT-27-9001", "2027-04-01T09:00", picnic("April picnic", "2027-04-17"), book("2027-04-01T09:00"));
    const stateOn = (until: string) => replayScripts([april], { until })[0].state;
    expect(stateOn("2027-04-16")).toBe("permitted");
    expect(stateOn("2027-04-17")).toBe("event_day");
    // An Instant event with nothing to reconcile closes itself the day after.
    expect(stateOn("2027-04-18")).toBe("closed");
    expect(stateOn("2027-05-03")).toBe("closed");

    // A second case's steps move the clock for the first one too.
    const may = script("T2", "PMT-27-9002", "2027-04-17T08:00", picnic("May picnic"), book("2027-04-30T09:00"));
    const both = replayScripts([april, may], { until: "2027-04-30" });
    expect(both.map((c) => c.state)).toEqual(["closed", "permitted"]);
    expect(both[0].activity.at(-1)).toMatchObject({ at: "2027-04-18T09:00", actor: "system" });
  });

  it("leaves out steps after the end date, and cases not yet started", () => {
    const a = script("T1", "PMT-27-9001", "2027-04-26T09:00", picnic("Picnic"), book("2027-04-28T09:00"));
    const b = script("T2", "PMT-27-9002", "2027-05-02T09:00", picnic("Later picnic", "2027-06-19"), []);
    expect(replayScripts([a, b], { until: "2027-04-27" }).map((c) => [c.id, c.state])).toEqual([["PMT-27-9001", "draft"]]);
    expect(replayScripts([a, b]).map((c) => [c.id, c.state])).toEqual([
      ["PMT-27-9001", "permitted"],
      ["PMT-27-9002", "draft"],
    ]);
  });

  it("returns the cases in case-id order and is deterministic", () => {
    const a = script("T1", "PMT-27-9007", "2027-04-20T09:00", picnic("Seventh", "2027-06-19"), []);
    const b = script("T2", "PMT-27-9003", "2027-04-26T09:00", picnic("Third"), book("2027-04-26T09:00"));
    expect(replayScripts([a, b]).map((c) => c.id)).toEqual(["PMT-27-9003", "PMT-27-9007"]);
    expect(replayScripts([a, b])).toEqual(replayScripts([b, a]));
  });
});
