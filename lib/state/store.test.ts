import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DEMO_TODAY } from "@/lib/rules/config";
import { resetDemoStoreForTests, useDemo } from "./store";

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

  it("dispatch reports a case-not-found error without throwing", () => {
    const result = useDemo.getState().dispatch("PMT-27-9999", { type: "add_note", text: "hi" });
    expect(result.ok).toBe(false);
  });

  it("dispatch runs the action through transition() and stores the result", () => {
    const id = useDemo.getState().createDraft("maya");
    const result = useDemo.getState().dispatch(id, { type: "add_note", text: "Called to confirm." }, "applicant");
    expect(result.ok).toBe(true);
    const draft = useDemo.getState().cases.find((c) => c.id === id);
    expect(draft?.activity).toHaveLength(1);
    expect(draft?.activity[0].text).toBe("Called to confirm.");
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
