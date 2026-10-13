/**
 * `pathProgress()` against the real store: each of the seven demo
 * paths is replayed step by step the way tests/demo-paths.test.ts does, and the derived step
 * must advance exactly once per coach step and read done at the end; after reset() it is back
 * at step 1. See lib/view/coach.ts for why path 7's three steps land together.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PATHS } from "@/lib/data/demoScript";
import { EMPTY_ADDONS, type EventAnswers } from "@/lib/types";
import { resetDemoStoreForTests, useDemo } from "@/lib/state";
import { pageIsFor } from "./shell";
import { activeDemoPathOf, demoPathIdForScenario, pathProgress } from "./coach";

const store = () => useDemo.getState();
const ctx = () => ({ cases: store().cases, role: store().role, personaId: store().personaId, today: store().demoToday });

function path(id: number) {
  return DEMO_PATHS.find((p) => p.id === id)!;
}

/** The current step (1-based, for readable assertions) and whether the path is done. */
function progress(id: number): { step: number; done: boolean } {
  const p = pathProgress(path(id), ctx());
  return { step: p.stepIndex + 1, done: p.done };
}

function as(role: ReturnType<typeof store>["role"], personaId?: string) {
  store().setRole(role);
  if (personaId) store().setPersona(personaId);
}

function act(caseId: string, action: Parameters<ReturnType<typeof store>["dispatch"]>[1]) {
  const result = store().dispatch(caseId, action);
  if (!result.ok) throw new Error(`${action.type} was refused: ${result.reason}`);
}

beforeEach(() => {
  resetDemoStoreForTests();
});

describe("pathProgress", () => {
  it("path 1 (S2): the wizard, the payment, then the clerk's view of Active permits", () => {
    const S2 = "PMT-27-0142";
    as("applicant", "sunrise-yoga-club");
    expect(progress(1)).toEqual({ step: 1, done: false });

    store().updateDraft(S2, { wizardStep: "size" });
    store().updateDraft(S2, { wizardStep: "plan" });
    expect(progress(1)).toEqual({ step: 2, done: false });

    act(S2, { type: "book_and_pay", method: "card" });
    expect(progress(1)).toEqual({ step: 3, done: false });

    as("clerk");
    expect(progress(1)).toEqual({ step: 3, done: true });

    store().reset();
    expect(progress(1)).toEqual({ step: 1, done: false });
  });

  it("path 2 (no scenario): the latest fresh draft's own tier and triggers", () => {
    as("applicant", "new");
    expect(progress(2)).toEqual({ step: 1, done: false });

    const id = store().createDraft("new", { eventType: "picnic_party", name: "Summer picnic" });
    expect(progress(2)).toEqual({ step: 1, done: false }); // no location or attendance yet

    const space = (inventoryId: string, label: string) => ({ mode: "inventory" as const, inventoryIds: [inventoryId], segmentIds: [], label });
    store().updateDraft(id, { location: space("shelter-2", "Shelter 2, Riverside Park") });
    store().updateDraft(id, { attendance: 40 });
    expect(progress(2)).toEqual({ step: 2, done: false });

    store().updateDraft(id, { addOns: { ...EMPTY_ADDONS, alcohol: true } });
    expect(progress(2)).toEqual({ step: 3, done: false });

    store().updateDraft(id, {
      location: { mode: "streets", inventoryIds: [], segmentIds: ["main-1-2", "main-2-3"], miles: 0.2, label: "Main Street, 1st to 3rd Avenue" },
    });
    expect(progress(2)).toEqual({ step: 4, done: false });

    store().updateDraft(id, { location: space("shelter-2", "Shelter 2, Riverside Park"), attendance: 1200 });
    expect(progress(2)).toEqual({ step: 4, done: true });

    store().reset();
    expect(progress(2)).toEqual({ step: 1, done: false });
  });

  it("path 3 (S3): the applicant's answer, Health & Legal's decision, the quote, payment, the permit", () => {
    const S3 = "PMT-27-0118";
    const health = `${S3}:vendor_health_permit:1`;

    expect(progress(3)).toEqual({ step: 1, done: false });

    as("applicant", "downtown-arts-collective");
    act(S3, { type: "respond_to_request", taskId: health, files: [{ name: "sample-health-permit.pdf", size: 248_000, type: "application/pdf" }] });
    expect(progress(3)).toEqual({ step: 2, done: false });

    as("hl");
    act(S3, { type: "verify_document", taskId: health });
    expect(progress(3)).toEqual({ step: 2, done: false }); // Health & Legal's own turn isn't done until it decides
    act(S3, { type: "review_decide", decision: "approve", conditions: [], feeLines: [] });
    expect(progress(3)).toEqual({ step: 3, done: false });

    as("clerk");
    act(S3, { type: "send_quote", conditions: [], feeLines: [] });
    expect(progress(3)).toEqual({ step: 4, done: false });

    as("applicant");
    act(S3, { type: "accept_and_sign", signature: "Jordan Alvarez" });
    act(S3, { type: "pay", amount: 715, method: "card", kind: "quote" });
    expect(progress(3)).toEqual({ step: 5, done: false });

    as("clerk");
    act(S3, { type: "issue_permit" });
    expect(progress(3)).toEqual({ step: 5, done: true });

    store().reset();
    expect(progress(3)).toEqual({ step: 1, done: false });
  });

  it("path 4 (S4): three sign-offs, routing, then Public Works & Safety's queue", () => {
    const S4 = "PMT-27-0126";
    expect(progress(4)).toEqual({ step: 1, done: false });

    as("applicant", "maple-street-block-captain");
    act(S4, { type: "simulate_signoff" });
    act(S4, { type: "simulate_signoff" });
    act(S4, { type: "simulate_signoff" });
    expect(progress(4)).toEqual({ step: 2, done: false });

    as("clerk");
    act(S4, { type: "accept_complete" });
    const reviewers = [
      { dept: "pws" as const, sections: ["City services request"], dueDate: "2027-05-17" },
      { dept: "hl" as const, sections: ["Certificate of insurance"], dueDate: "2027-05-17" },
    ];
    act(S4, { type: "confirm_routing", reviewers });
    expect(progress(4)).toEqual({ step: 3, done: false });

    as("pws");
    expect(progress(4)).toEqual({ step: 3, done: true });

    store().reset();
    expect(progress(4)).toEqual({ step: 1, done: false });
  });

  it("path 5 (S5): Health & Legal verifies, the applicant pays, the Clerk issues, then a new draft", () => {
    const S5 = "PMT-27-0097";
    const insurance = `${S5}:insurance_certificate`;

    as("clerk");
    expect(progress(5)).toEqual({ step: 1, done: false });

    as("hl");
    expect(progress(5)).toEqual({ step: 2, done: false }); // switching to Health & Legal clears step 1
    act(S5, { type: "verify_document", taskId: insurance });
    expect(progress(5)).toEqual({ step: 3, done: false });

    as("applicant", "riverfront-running-club");
    act(S5, { type: "accept_and_sign", signature: "Simone Dubois" });
    act(S5, { type: "pay", amount: 6530, method: "card", kind: "quote" });
    expect(progress(5)).toEqual({ step: 4, done: false });

    as("clerk");
    act(S5, { type: "issue_permit" });
    expect(progress(5)).toEqual({ step: 5, done: false }); // step 4 is done; step 5 needs the new Jul 11 draft

    as("applicant", "new");
    store().createDraft("new", {
      eventType: "performance_rally",
      name: "Plaza brass band",
      location: { mode: "area", inventoryIds: [], areaId: "city-hall-plaza", areaRect: { x: 40, y: 30, w: 40, h: 20 }, segmentIds: [], squareFeet: 800, capacity: 80, label: "City Hall Plaza" },
      schedule: { date: "2027-07-11", start: "13:00", end: "15:00", occurrences: [] },
      attendance: 80,
    });
    expect(progress(5)).toEqual({ step: 5, done: true });

    store().reset();
    expect(progress(5)).toEqual({ step: 1, done: false });
  });

  it("path 6 (S6): the cleanup log, reconciliation, then the applicant's board", () => {
    const S6 = "PMT-27-0031";
    as("pws");
    expect(progress(6)).toEqual({ step: 1, done: false });

    const police = store()
      .cases.find((c) => c.id === S6)!
      .feeLines.find((line) => line.label === "Police")!;
    act(S6, {
      type: "log_closeout",
      cleanup: "pass",
      notes: "Street swept and reopened by 11 pm.",
      actuals: [{ feeLineId: police.id, qty: 72 }],
      extraLines: [{ dept: "pws", label: "Cleanup crew", qty: 4, unit: "worker-hour", unitPrice: store().cfg.fees.cleanupCrewPerWorkerHour }],
    });
    expect(progress(6)).toEqual({ step: 2, done: false });

    as("clerk");
    act(S6, { type: "reconcile_close" });
    expect(progress(6)).toEqual({ step: 3, done: false }); // reconciled, but the applicant hasn't looked yet

    as("applicant", "main-street-business-alliance");
    expect(progress(6)).toEqual({ step: 3, done: true });

    store().reset();
    expect(progress(6)).toEqual({ step: 1, done: false });
  });

  it("path 7 (S1, P1): amend applies the tier change, the late fee and the new cards together", () => {
    const S1 = "PMT-27-0109";
    as("applicant", "maya-chen");
    expect(progress(7)).toEqual({ step: 1, done: false });

    const original = store().cases.find((c) => c.id === S1)!;
    const withDj: EventAnswers = {
      eventType: original.eventType,
      name: original.name,
      description: original.description,
      location: original.location,
      schedule: original.schedule,
      attendance: original.attendance,
      addOns: { ...original.addOns, amplifiedSound: true },
    };
    // The engine keeps no intermediate state between the tier change, the late fee and the new
    // cards: all three land in the same transition, so the derived step jumps straight to done.
    act(S1, { type: "amend", answers: withDj, lateFee: true });
    expect(progress(7)).toEqual({ step: 3, done: true });

    store().reset();
    expect(progress(7)).toEqual({ step: 1, done: false });
  });
});

describe("which path the coach is on", () => {
  it("a jump to a scenario puts the coach on the path built on it", () => {
    expect(demoPathIdForScenario("S1")).toBe(7);
    expect(demoPathIdForScenario("S2")).toBe(1);
    expect(demoPathIdForScenario("S3")).toBe(3);
    expect(demoPathIdForScenario("S4")).toBe(4);
    expect(demoPathIdForScenario("S5")).toBe(5);
    expect(demoPathIdForScenario("S6")).toBe(6);
    // Every scenario has a path, and path 2 (the tier-watching one) is the only path with none.
    expect(DEMO_PATHS.filter((p) => p.scenario === null).map((p) => p.id)).toEqual([2]);
  });

  it("is the store's activeDemoPath: none until the presenter picks one, and none again after Reset", () => {
    expect(activeDemoPathOf(store().activeDemoPath)).toBeUndefined();
    store().setActiveDemoPath(5);
    expect(activeDemoPathOf(store().activeDemoPath)?.title).toBe("Two parties up at once");
    store().reset();
    expect(activeDemoPathOf(store().activeDemoPath)).toBeUndefined();
    // A number that names no path (a stored demo from a build with another script) shows nothing.
    expect(activeDemoPathOf(12)).toBeUndefined();
  });

  it("every step's page is a page of the role the step is for", () => {
    for (const p of DEMO_PATHS) {
      for (const step of p.steps) {
        expect(pageIsFor(step.role, step.page), `path ${p.id}, ${step.id}: ${step.page} as ${step.role}`).toBe(true);
      }
    }
  });
});
