/**
 * Pure view-model for the command palette (Cmd+K): the items it offers for the current role
 * and persona, and the search that filters and ranks them. Nothing here reads the store or
 * navigates; CommandPalette passes in what it reads from the store and interprets an item's
 * `action` (a reset needs its own confirmation, which belongs to the component). Covered by
 * lib/view/palette.test.ts.
 *
 * Owned by workstream 5E (components/shell, lib/data/demoScript.ts, lib/view/coach.ts).
 */
import { applicantNameOf, NEW_PERSONA_ID, PERSONA_BY_ID, PICKABLE_PERSONA_IDS } from "@/lib/data/people";
import { DEMO_DATE_JUMPS, DEMO_PATHS, SCENARIO_JUMPS, type DemoPath, type ScenarioJump } from "@/lib/data/demoScript";
import { routes } from "@/lib/routes";
import { applicantCases, isVisibleToCity } from "@/lib/state";
import { CITY_CORE_LINKS, cityToolLinks, pathForCase } from "@/lib/view/shell";
import { PARTIES, PARTY_LABEL, type EventCase, type ISODate, type Party } from "@/lib/types";

export type PaletteGroup = "cases" | "goto" | "role" | "persona" | "demo";

export type PaletteAction =
  | { kind: "navigate"; href: string }
  | { kind: "switchRole"; role: Party }
  | { kind: "switchPersona"; personaId: string }
  | { kind: "scenarioJump"; jump: ScenarioJump }
  | { kind: "demoPath"; path: DemoPath }
  | { kind: "dateJump"; date: ISODate }
  | { kind: "toggleHints" }
  | { kind: "reset" };

export interface PaletteItem {
  id: string;
  group: PaletteGroup;
  label: string;
  sublabel?: string;
  /** Extra terms a search matches, beyond the label and sublabel (a case id, an applicant). */
  keywords?: string[];
  action: PaletteAction;
}

export interface PaletteContext {
  role: Party;
  personaId: string;
  cases: EventCase[];
  hints: boolean;
}

export const PALETTE_GROUP_LABEL: Record<PaletteGroup, string> = {
  cases: "Cases",
  goto: "Go to",
  role: "Switch role",
  persona: "Personas",
  demo: "Demo",
};

/** The order groups show in the palette. */
export const PALETTE_GROUP_ORDER: PaletteGroup[] = ["cases", "goto", "role", "persona", "demo"];

/** Cases the current role can see: the Applicant's own (a Draft included), or every case the city can. */
function visibleCases(ctx: PaletteContext): EventCase[] {
  return ctx.role === "applicant" ? applicantCases(ctx.cases, ctx.personaId) : ctx.cases.filter(isVisibleToCity);
}

function caseItem(c: EventCase, role: Party): PaletteItem {
  return {
    id: `case:${c.id}`,
    group: "cases",
    label: c.name || "Untitled event",
    sublabel: `${applicantNameOf(c)} · ${c.id}`,
    keywords: [c.id, applicantNameOf(c)],
    // Enter opens the case for the current role: the board for the Applicant, the case detail
    // for a city role.
    action: { kind: "navigate", href: pathForCase(role, c.id) },
  };
}

/** Every page the current role has: the applicant's two, or the city's shared pages plus its own tools. */
function gotoItems(role: Party): PaletteItem[] {
  if (role === "applicant") {
    return [
      { id: "goto:events", group: "goto", label: "My events", action: { kind: "navigate", href: routes.events() } },
      { id: "goto:apply", group: "goto", label: "Plan an event", action: { kind: "navigate", href: routes.apply() } },
    ];
  }
  return [...CITY_CORE_LINKS, ...cityToolLinks(role)].map((link) => ({
    id: `goto:${link.href}`,
    group: "goto" as const,
    label: link.label,
    action: { kind: "navigate" as const, href: link.href },
  }));
}

function roleItems(current: Party): PaletteItem[] {
  return PARTIES.filter((role) => role !== current).map((role) => ({
    id: `role:${role}`,
    group: "role",
    label: `Switch to ${PARTY_LABEL[role]}`,
    action: { kind: "switchRole", role },
  }));
}

/** The persona picker's own options, minus the one already current. Applicant role only. */
function personaItems(ctx: PaletteContext): PaletteItem[] {
  if (ctx.role !== "applicant") return [];
  return PICKABLE_PERSONA_IDS.filter((id) => id !== ctx.personaId).map((id) => {
    const persona = PERSONA_BY_ID[id];
    return {
      id: `persona:${id}`,
      group: "persona" as const,
      label: id === NEW_PERSONA_ID ? "New applicant" : persona.name,
      action: { kind: "switchPersona" as const, personaId: id },
    };
  });
}

function demoItems(ctx: PaletteContext): PaletteItem[] {
  const items: PaletteItem[] = [];
  for (const jump of SCENARIO_JUMPS) {
    items.push({
      id: `scenario:${jump.id}`,
      group: "demo",
      label: `Jump to ${jump.label}`,
      sublabel: jump.state,
      keywords: [jump.caseId],
      action: { kind: "scenarioJump", jump },
    });
  }
  for (const path of DEMO_PATHS) {
    items.push({
      id: `path:${path.id}`,
      group: "demo",
      label: `Path ${path.id}: ${path.title}`,
      sublabel: path.summary,
      action: { kind: "demoPath", path },
    });
  }
  for (const jump of DEMO_DATE_JUMPS) {
    items.push({ id: `date:${jump.date}`, group: "demo", label: `Set demo date: ${jump.note}`, action: { kind: "dateJump", date: jump.date } });
  }
  items.push({ id: "demo:hints", group: "demo", label: ctx.hints ? "Turn off demo hints" : "Turn on demo hints", action: { kind: "toggleHints" } });
  items.push({ id: "demo:reset", group: "demo", label: "Reset demo data", action: { kind: "reset" } });
  return items;
}

/** Every item the palette can offer for this role and persona, unfiltered. */
export function buildPaletteItems(ctx: PaletteContext): PaletteItem[] {
  return [...visibleCases(ctx).map((c) => caseItem(c, ctx.role)), ...gotoItems(ctx.role), ...roleItems(ctx.role), ...personaItems(ctx), ...demoItems(ctx)];
}

function fieldsOf(item: PaletteItem): string[] {
  return [item.label, item.sublabel ?? "", ...(item.keywords ?? [])].map((s) => s.toLowerCase());
}

/** How well `query` matches one item (3 exact, 2 starts with, 1 contains, -1 no match). */
function matchScore(item: PaletteItem, query: string): number {
  const q = query.toLowerCase();
  let best = -1;
  for (const field of fieldsOf(item)) {
    if (field === q) best = Math.max(best, 3);
    else if (field.startsWith(q)) best = Math.max(best, 2);
    else if (field.includes(q)) best = Math.max(best, 1);
  }
  return best;
}

/**
 * Items matching `query`, best match first, ties keeping their original order. An empty query
 * returns every item except the cases group: the current role's cases can run to dozens, so
 * that group only appears once the presenter starts typing a name, an applicant or an id.
 */
export function matchPaletteItems(items: PaletteItem[], query: string): PaletteItem[] {
  const q = query.trim();
  if (!q) return items.filter((item) => item.group !== "cases");
  return items
    .map((item, index) => ({ item, index, score: matchScore(item, q) }))
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.item);
}

/** `items`, grouped and ordered for display; a group with nothing in it is left out. */
export function groupPaletteItems(items: PaletteItem[]): { group: PaletteGroup; label: string; items: PaletteItem[] }[] {
  return PALETTE_GROUP_ORDER.map((group) => ({ group, label: PALETTE_GROUP_LABEL[group], items: items.filter((item) => item.group === group) })).filter(
    (g) => g.items.length > 0,
  );
}
