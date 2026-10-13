import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { classify, estimateFees } from "@/lib/rules";
import { DEFAULT_DEMO_TODAY } from "@/lib/rules/config";
import { resetDemoStoreForTests, useDemo, useHydrated } from "./store";

vi.mock("./seed", () => ({ buildSeed: () => [] }));

beforeEach(() => {
  resetDemoStoreForTests();
});

describe("useDemo", () => {
  it("starts from the seed and the defaults", () => {
    const state = useDemo.getState();
    expect(state.demoToday).toBe(DEFAULT_DEMO_TODAY);
    expect(state.role).toBe("applicant");
    expect(state.personaId).toBe("new");
    expect(state.hints).toBe(true);
    expect(state.cases).toEqual([]);
  });

  it("createDraft adds a Draft and returns its id", () => {
    const id = useDemo.getState().createDraft("maya", { name: "Birthday picnic" });
    const cases = useDemo.getState().cases;
    expect(cases).toHaveLength(1);
    expect(cases[0].id).toBe(id);
    expect(cases[0].state).toBe("draft");
    expect(cases[0].name).toBe("Birthday picnic");
  });

  it("updateDraft patches only a Draft's answers and wizardStep", () => {
    const id = useDemo.getState().createDraft("maya");
    useDemo.getState().updateDraft(id, { attendance: 45, wizardStep: "size" });
    const draft = useDemo.getState().cases.find((c) => c.id === id);
    expect(draft?.attendance).toBe(45);
    expect(draft?.wizardStep).toBe("size");
  });

  it("a Draft carries the tier its answers classify to, before the plan is confirmed", () => {
    const id = useDemo.getState().createDraft("maya", { eventType: "picnic_party", attendance: 40 });
    const draft = () => useDemo.getState().cases.find((c) => c.id === id);
    expect(draft()?.tier).toBe("instant");
    expect(draft()?.triggers).toEqual([]);

    useDemo.getState().updateDraft(id, { attendance: 150 });
    expect(draft()?.tier).toBe("reviewed");
    expect(draft()?.triggers.map((t) => t.id)).toContain("attendance_100");

    useDemo.getState().updateDraft(id, { attendance: 1200 });
    expect(draft()?.tier).toBe("special");

    useDemo.getState().updateDraft(id, { attendance: 40 });
    expect(draft()?.tier).toBe("instant");
  });

  it("a Draft lists its own sessions, so a new weekly series is billed for every one of them", () => {
    // What the wizard stores when "repeat weekly" is switched on: the rule, and no list of dates.
    const yoga = {
      eventType: "class_meetup" as const,
      attendance: 20,
      location: { mode: "inventory" as const, inventoryIds: ["field-4"], segmentIds: [], label: "Field 4, Riverside Park" },
      schedule: { date: "2027-06-06", start: "08:00", end: "09:00", recurrence: { frequency: "weekly" as const, weekday: 0, until: "2027-08-29" }, occurrences: [] },
    };
    const id = useDemo.getState().createDraft("sunrise-yoga-club", yoga);
    const draft = () => useDemo.getState().cases.find((c) => c.id === id)!;
    const estimate = () => estimateFees(draft(), classify(draft()));

    expect(draft().schedule?.occurrences).toHaveLength(13);
    expect(draft().schedule?.occurrences.find((o) => o.date === "2027-07-11")?.availability.status).toBe("impacted");
    expect(estimate()).toMatchObject({ sessions: 13, perSession: 20, total: 260, dueNow: 20 });

    // Ending the series a month in: the stored list follows, and so does the price.
    useDemo.getState().updateDraft(id, { schedule: { ...yoga.schedule, recurrence: { ...yoga.schedule.recurrence, until: "2027-06-27" } } });
    expect(draft().schedule?.occurrences.map((o) => o.date)).toEqual(["2027-06-06", "2027-06-13", "2027-06-20", "2027-06-27"]);
    expect(estimate()).toMatchObject({ sessions: 4, total: 80 });
  });

  it("updateDraft records the late fee the applicant chose at the date gate", () => {
    const id = useDemo.getState().createDraft("maya", { name: "Birthday picnic" });
    const draft = () => useDemo.getState().cases.find((c) => c.id === id)!;
    expect(draft().flags.lateFee).toBe(false);
    useDemo.getState().updateDraft(id, { lateFee: true });
    expect(draft().flags.lateFee).toBe(true);
    expect(draft()).not.toHaveProperty("lateFee");
    // A later autosave of the answers leaves the choice alone.
    useDemo.getState().updateDraft(id, { attendance: 45 });
    expect(draft().flags.lateFee).toBe(true);
    useDemo.getState().updateDraft(id, { lateFee: false });
    expect(draft().flags.lateFee).toBe(false);
  });

  it("dispatch reports a case-not-found error without throwing", () => {
    const result = useDemo.getState().dispatch("PMT-27-9999", { type: "add_note", text: "hi" });
    expect(result.ok).toBe(false);
  });

  it("dispatch runs the action through transition() and stores the result", () => {
    const id = useDemo.getState().createDraft("maya");
    const result = useDemo.getState().dispatch(id, { type: "add_note", text: "Called to confirm." }, "clerk");
    expect(result.ok).toBe(true);
    const draft = useDemo.getState().cases.find((c) => c.id === id);
    expect(draft?.activity.map((a) => a.text)).toEqual(["Started a draft.", "Called to confirm."]);
  });

  it("dispatch acts as the current role unless told otherwise, and reports why an action was refused", () => {
    const id = useDemo.getState().createDraft("maya");
    // The store starts in the Applicant role, and a note is for city staff.
    expect(useDemo.getState().dispatch(id, { type: "add_note", text: "Hello" })).toEqual({ ok: false, reason: "Only city staff can add a note." });
    useDemo.getState().setRole("clerk");
    expect(useDemo.getState().dispatch(id, { type: "add_note", text: "Hello" }).ok).toBe(true);
  });

  it("setRole, setPersona and toggleHints update the store", () => {
    useDemo.getState().setRole("clerk");
    useDemo.getState().setPersona("s3");
    useDemo.getState().toggleHints();
    const state = useDemo.getState();
    expect(state.role).toBe("clerk");
    expect(state.personaId).toBe("s3");
    expect(state.hints).toBe(false);
  });

  it("setDemoToday just sets the date moving backwards", () => {
    useDemo.getState().setDemoToday("2027-05-01");
    expect(useDemo.getState().demoToday).toBe("2027-05-01");
  });

  it("setDemoToday runs advanceClock moving forward", () => {
    const id = useDemo.getState().createDraft("maya");
    useDemo.setState({
      cases: [
        {
          ...useDemo.getState().cases.find((c) => c.id === id)!,
          state: "permitted",
          schedule: { date: "2027-05-05", start: "11:00", end: "16:00", occurrences: [{ date: "2027-05-05", availability: { status: "open" }, billing: "paid" }] },
        },
      ],
    });
    useDemo.getState().setDemoToday("2027-05-05");
    const updated = useDemo.getState().cases.find((c) => c.id === id);
    expect(updated?.state).toBe("event_day");
    expect(useDemo.getState().demoToday).toBe("2027-05-05");
  });

  it("reset() restores the seed and the defaults exactly", () => {
    useDemo.getState().createDraft("maya");
    useDemo.getState().setRole("clerk");
    useDemo.getState().reset();
    const state = useDemo.getState();
    expect(state.cases).toEqual([]);
    expect(state.role).toBe("applicant");
    expect(state.demoToday).toBe(DEFAULT_DEMO_TODAY);
  });
});

describe("useHydrated", () => {
  it("is false in server-rendered HTML, like the first render in the browser, so the two match", () => {
    // This file runs in node, where there is no window: exactly what the server sees.
    const Probe = () => createElement("p", null, useHydrated() ? "content" : "skeleton");
    expect(renderToString(createElement(Probe))).toBe("<p>skeleton</p>");
  });
});
