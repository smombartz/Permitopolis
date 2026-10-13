/**
 * What the store does with a demo it finds in localStorage. A stored demo belongs to the seed
 * it grew from: one made from another seed (an earlier build, other scripts, an engine fix
 * that changed a seeded case) is dropped on load instead of being shown against rules it was
 * not made with. Runs in node, with a stand-in for window.localStorage.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY } from "@/lib/rules";
import { buildSeed, seedFingerprint } from "./seed";
import { hydrateDemoStore, resetDemoStoreForTests, useDemo } from "./store";

const stored = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => void stored.set(key, value),
  removeItem: (key: string) => void stored.delete(key),
};

const storedDemo = () => JSON.parse(stored.get(STORAGE_KEY) ?? "null") as { version: number; state: { cases: unknown[]; role: string } } | null;

beforeEach(() => {
  stored.clear();
  vi.stubGlobal("window", { localStorage });
  resetDemoStoreForTests();
  stored.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the seed's fingerprint", () => {
  it("is a whole number that stays the same from call to call", () => {
    expect(Number.isInteger(seedFingerprint())).toBe(true);
    expect(seedFingerprint()).toBeGreaterThan(0);
    expect(seedFingerprint()).toBe(seedFingerprint());
  });

  it("is the version the demo is stored under, in the PRD's storage key", async () => {
    expect(useDemo.persist.getOptions()).toMatchObject({ name: "permitopolis-demo-v1", version: seedFingerprint() });
    await hydrateDemoStore();
    useDemo.getState().setRole("clerk");
    expect(storedDemo()).toMatchObject({ version: seedFingerprint(), state: { role: "clerk" } });
  });
});

describe("nothing is written before the stored demo has been read", () => {
  /** A demo the presenter left behind: a note on the first case, as the Clerk, on Jun 18. */
  function leaveADemoBehind() {
    const cases = buildSeed();
    cases[0].activity.push({ at: "2027-05-03T09:00", actor: "clerk", text: "Called the organizer." });
    stored.set(STORAGE_KEY, JSON.stringify({ version: seedFingerprint(), state: { cases, role: "clerk", personaId: "maya-chen", demoToday: "2027-06-18", hints: false, lastPathByRole: { clerk: "/city/cases" } } }));
    return cases;
  }

  it("a change made on a page that has not hydrated (a landing-page door, a demo-guide jump) leaves the stored demo as it was", () => {
    const left = leaveADemoBehind();
    const before = stored.get(STORAGE_KEY);

    // A fresh page load: the store holds the seed in memory, and nothing has read storage yet.
    useDemo.getState().setRole("pws");
    useDemo.getState().setPersona("sunrise-yoga-club");
    useDemo.getState().rememberPath("pws", "/city/queue");

    expect(stored.get(STORAGE_KEY)).toBe(before);
    expect(storedDemo()?.state.cases).toEqual(left);
    expect(storedDemo()?.state.cases[0]).toMatchObject({ activity: expect.arrayContaining([expect.objectContaining({ text: "Called the organizer." })]) });
  });

  it("the read that follows brings the stored demo in, and from then on every change is saved", async () => {
    const left = leaveADemoBehind();
    useDemo.getState().setRole("pws");

    await hydrateDemoStore();
    expect(useDemo.getState()).toMatchObject({ role: "clerk", personaId: "maya-chen", demoToday: "2027-06-18", hints: false });
    expect(useDemo.getState().cases).toEqual(left);

    useDemo.getState().setRole("hl");
    expect(storedDemo()).toMatchObject({ state: { role: "hl", demoToday: "2027-06-18" } });
    expect(storedDemo()?.state.cases).toEqual(left);
  });

  it("reads storage once per page load, however many shells mount", async () => {
    leaveADemoBehind();
    const getItem = vi.spyOn(localStorage, "getItem");
    await Promise.all([hydrateDemoStore(), hydrateDemoStore()]);
    await hydrateDemoStore();
    expect(getItem.mock.calls.filter(([key]) => key === STORAGE_KEY)).toHaveLength(1);
    getItem.mockRestore();
  });

  it("with nothing stored, the first change after the read saves the seed with it", async () => {
    await hydrateDemoStore();
    expect(storedDemo()).toBeNull();
    useDemo.getState().setRole("clerk");
    expect(storedDemo()).toMatchObject({ version: seedFingerprint(), state: { role: "clerk" } });
    expect(storedDemo()?.state.cases).toHaveLength(38);
  });
});

describe("loading a stored demo", () => {
  it("keeps a demo made from this seed: the presenter's changes survive a reload", async () => {
    const cases = buildSeed();
    cases[0].name = "Renamed by the presenter";
    stored.set(STORAGE_KEY, JSON.stringify({ version: seedFingerprint(), state: { cases, role: "pws", personaId: "maya-chen", demoToday: "2027-05-04", hints: false } }));

    await useDemo.persist.rehydrate();
    expect(useDemo.getState()).toMatchObject({ role: "pws", personaId: "maya-chen", demoToday: "2027-05-04", hints: false });
    expect(useDemo.getState().cases[0].name).toBe("Renamed by the presenter");
    expect(useDemo.getState().cases).toHaveLength(38);
  });

  it("drops a demo made from another seed and starts from the seed, without an error in the console", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    // What an earlier build left behind: its version, and the empty seed it had.
    stored.set(STORAGE_KEY, JSON.stringify({ version: 1, state: { cases: [], role: "clerk", personaId: "maya-chen", demoToday: "2027-06-18", hints: false } }));

    await useDemo.persist.rehydrate();
    expect(useDemo.getState().cases).toEqual(buildSeed());
    expect(useDemo.getState()).toMatchObject({ role: "applicant", personaId: "new", demoToday: "2027-05-03", hints: true });
    expect(error).not.toHaveBeenCalled();
    // The stale demo is replaced in storage too, so the next load is clean.
    expect(storedDemo()).toMatchObject({ version: seedFingerprint(), state: { role: "applicant" } });
    expect(storedDemo()?.state.cases).toHaveLength(38);
    error.mockRestore();
  });

  it("starts from the seed when storage holds something that is not a demo at all", async () => {
    stored.set(STORAGE_KEY, "{not json");
    await useDemo.persist.rehydrate();
    expect(useDemo.getState().cases).toEqual(buildSeed());
  });
});
