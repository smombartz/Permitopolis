/**
 * What the store does with a demo it finds in localStorage. A stored demo belongs to the seed
 * it grew from: one made from another seed (an earlier build, other scripts, an engine fix
 * that changed a seeded case) is dropped on load instead of being shown against rules it was
 * not made with. Runs in node, with a stand-in for window.localStorage.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY } from "@/lib/rules";
import { buildSeed, seedFingerprint } from "./seed";
import { resetDemoStoreForTests, useDemo } from "./store";

const stored = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => void stored.set(key, value),
  removeItem: (key: string) => void stored.delete(key),
};

const storedDemo = () => JSON.parse(stored.get(STORAGE_KEY) ?? "null") as { version: number; state: { cases: { id: string; name: string }[]; role: string } } | null;

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

  it("is the version the demo is stored under, in the PRD's storage key", () => {
    expect(useDemo.persist.getOptions()).toMatchObject({ name: "permitopolis-demo-v1", version: seedFingerprint() });
    useDemo.getState().setRole("clerk");
    expect(storedDemo()).toMatchObject({ version: seedFingerprint(), state: { role: "clerk" } });
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
