import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/state";
import { buildPaletteItems, groupPaletteItems, matchPaletteItems, type PaletteContext, type PaletteItem } from "./palette";

const seed = buildSeed();

function ctx(overrides: Partial<PaletteContext> = {}): PaletteContext {
  return { role: "applicant", personaId: "new", cases: seed, hints: true, ...overrides };
}

describe("buildPaletteItems", () => {
  it("the Applicant sees only their own cases, a Draft included", () => {
    // B02 (riverside-garden-society) is a Draft with a board; nobody else's cases show.
    const items = buildPaletteItems(ctx({ personaId: "riverside-garden-society" }));
    const cases = items.filter((item) => item.group === "cases");
    expect(cases.map((item) => item.id)).toEqual(["case:PMT-27-0004"]);
  });

  it("a city role sees every case visible to the city, no Draft among them", () => {
    const items = buildPaletteItems(ctx({ role: "clerk", personaId: "new" }));
    const cases = items.filter((item) => item.group === "cases");
    expect(cases.length).toBeGreaterThan(30);
    expect(cases.map((item) => item.id)).not.toContain("case:PMT-27-0004");
    // Every city role sees the same cases: nothing here is Public Works & Safety's or Health & Legal's alone.
    expect(buildPaletteItems(ctx({ role: "pws" })).filter((item) => item.group === "cases")).toHaveLength(cases.length);
  });

  it("Go to lists the Applicant's two pages, or the city role's shared pages plus its own tools", () => {
    const applicant = buildPaletteItems(ctx()).filter((item) => item.group === "goto");
    expect(applicant.map((item) => item.label)).toEqual(["My events", "Plan an event"]);

    const clerk = buildPaletteItems(ctx({ role: "clerk" })).filter((item) => item.group === "goto");
    expect(clerk.map((item) => item.label)).toEqual(["My queue", "Cases", "Active permits", "Intake", "Payments", "Settings"]);

    const pws = buildPaletteItems(ctx({ role: "pws" })).filter((item) => item.group === "goto");
    expect(pws.map((item) => item.label)).toEqual(["My queue", "Cases", "Active permits", "Closures and routes", "Work orders"]);
  });

  it("Switch role offers the three roles that are not current", () => {
    const items = buildPaletteItems(ctx({ role: "hl" })).filter((item) => item.group === "role");
    expect(items.map((item) => item.label)).toEqual(["Switch to Applicant", "Switch to City Clerk", "Switch to Public Works & Safety"]);
  });

  it("Personas is empty for a city role, and leaves out the one already current", () => {
    expect(buildPaletteItems(ctx({ role: "clerk" })).filter((item) => item.group === "persona")).toEqual([]);
    const items = buildPaletteItems(ctx({ personaId: "maya-chen" })).filter((item) => item.group === "persona");
    expect(items.map((item) => item.label)).not.toContain("Maya Chen");
    expect(items.map((item) => item.label)).toContain("New applicant");
  });

  it("Demo lists the six scenarios, the seven paths, the three date jumps, hints and reset", () => {
    const items = buildPaletteItems(ctx()).filter((item) => item.group === "demo");
    expect(items.filter((item) => item.action.kind === "scenarioJump")).toHaveLength(6);
    expect(items.filter((item) => item.action.kind === "demoPath")).toHaveLength(7);
    expect(items.filter((item) => item.action.kind === "dateJump")).toHaveLength(3);
    expect(items.find((item) => item.action.kind === "toggleHints")?.label).toBe("Turn off demo hints");
    expect(items.find((item) => item.action.kind === "reset")?.label).toBe("Reset demo data");
  });

  it("hints off reads as an offer to turn them on", () => {
    const items = buildPaletteItems(ctx({ hints: false })).filter((item) => item.group === "demo");
    expect(items.find((item) => item.action.kind === "toggleHints")?.label).toBe("Turn on demo hints");
  });
});

describe("matchPaletteItems", () => {
  it("hides the cases group when nothing has been typed", () => {
    const items = buildPaletteItems(ctx({ role: "clerk" }));
    const shown = matchPaletteItems(items, "");
    expect(shown.some((item) => item.group === "cases")).toBe(false);
    expect(shown).toHaveLength(items.length - items.filter((item) => item.group === "cases").length);
  });

  it("matches a case by its name, case-insensitively", () => {
    const items = buildPaletteItems(ctx({ role: "clerk" }));
    const shown = matchPaletteItems(items, "5k");
    expect(shown.map((item) => item.id)).toContain("case:PMT-27-0097"); // Riverfront Summer 5K
  });

  it("matches a case by its id or its applicant", () => {
    const items = buildPaletteItems(ctx({ role: "clerk" }));
    expect(matchPaletteItems(items, "PMT-27-0097").map((item) => item.id)).toContain("case:PMT-27-0097");
    expect(matchPaletteItems(items, "Riverfront Running Club").map((item) => item.id)).toContain("case:PMT-27-0097");
  });

  it("ranks an exact match, then a prefix, then a contains", () => {
    const item = (id: string, label: string): PaletteItem => ({ id, group: "goto", label, action: { kind: "navigate", href: "/" } });
    const items = [item("contains", "The Payments Desk"), item("exact", "Payments"), item("prefix", "Payments due")];
    const shown = matchPaletteItems(items, "Payments");
    expect(shown.map((i) => i.id)).toEqual(["exact", "prefix", "contains"]);
  });

  it("keeps the original order between items that score the same", () => {
    const item = (id: string, label: string): PaletteItem => ({ id, group: "goto", label, action: { kind: "navigate", href: "/" } });
    const items = [item("a", "Payments for A"), item("b", "Payments for B")];
    expect(matchPaletteItems(items, "Payments").map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("matches outside the cases group too: a role, a page, a scenario", () => {
    const items = buildPaletteItems(ctx({ role: "clerk" }));
    expect(matchPaletteItems(items, "health").map((item) => item.label)).toContain("Switch to Health & Legal");
    expect(matchPaletteItems(items, "intake").map((item) => item.label)).toContain("Intake");
    expect(matchPaletteItems(items, "s5").map((item) => item.label).some((l) => l.includes("S5"))).toBe(true);
  });

  it("an empty result for a query nothing matches", () => {
    const items = buildPaletteItems(ctx({ role: "clerk" }));
    expect(matchPaletteItems(items, "zzz-nothing-like-this")).toEqual([]);
  });
});

describe("groupPaletteItems", () => {
  it("orders groups Cases, Go to, Switch role, Personas, Demo, and skips an empty one", () => {
    const items = buildPaletteItems(ctx());
    const groups = groupPaletteItems(items);
    // The Applicant has no Cases group with an empty query (filtered out before grouping here),
    // and city roles have no Personas group.
    expect(groups.map((g) => g.group)).toEqual(["goto", "role", "persona", "demo"]);

    const clerkGroups = groupPaletteItems(matchPaletteItems(buildPaletteItems(ctx({ role: "clerk" })), "a"));
    expect(clerkGroups.map((g) => g.group)).not.toContain("persona");
  });
});
