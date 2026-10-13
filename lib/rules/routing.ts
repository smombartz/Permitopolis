/**
 * routing(): suggested reviewers with reasons, sections and a one-line "checks"
 * sentence for the applicant. Also builds Classification.reviewers, which adds
 * the City Clerk for every Special event (not only for alcohol).
 *
 * Nothing here decides a rule of its own: the tier, the triggers and the
 * block-party exception come from the classification, and thresholds from the config.
 */
import { fmtNumber } from "@/lib/format";
import { CARD_CATALOG } from "./catalog";
import { DEFAULT_CONFIG } from "./config";
import type { Classification, RoutingSuggestion, RulesConfig } from "./types";
import type { Dept, EventAnswers, TriggerId } from "@/lib/types";
import { PARTY_LABEL } from "@/lib/types";

const DEPT_FOR_TRIGGER: Partial<Record<TriggerId, Dept[]>> = {
  street: ["pws"],
  route: ["pws"],
  attendance_1000: ["pws"],
  fireworks_drones: ["pws"],
  heavy_resources: ["pws"],
  amplified_sound: ["pws"],
  alcohol: ["clerk", "pws"],
  food_vending: ["hl"],
  tents_stages: ["pws"],
  cooking_generators: ["pws"],
  city_services: ["pws"],
  block_party: ["pws"],
};

/** Why a trigger routes a case to a department. The crowd threshold is the configured one. */
function reasonFor(id: TriggerId, cfg: RulesConfig): string | undefined {
  const labels: Partial<Record<TriggerId, string>> = {
    street: "Street closure",
    route: "Route closure",
    attendance_1000: `${fmtNumber(cfg.thresholds.specialAttendance)} or more attendees`,
    fireworks_drones: "Fireworks or drones",
    heavy_resources: "Heavy city resources",
    amplified_sound: "Amplified sound",
    alcohol: "Alcohol",
    food_vending: "Food or vending",
    tents_stages: "Tents or stages",
    cooking_generators: "Cooking or generators",
    city_services: "City services",
    block_party: "Block party",
  };
  return labels[id];
}

/** What routing needs of a classification. classify() calls this before it has the rest. */
export type RoutingBasis = Pick<Classification, "tier" | "triggers" | "blockPartyException">;

function sectionsFor(dept: Dept, a: EventAnswers, basis: RoutingBasis): string[] {
  // A card's `when` reads only the tier and the block-party exception.
  return CARD_CATALOG.filter((c) => c.stage === "plan" && c.reviewer === dept && c.when(a, basis as Classification)).map((c) => c.title);
}

function checksSentence(dept: Dept, sections: string[]): string {
  if (sections.length === 0) return `${PARTY_LABEL[dept]} reviews your application.`;
  const list = sections.length === 1 ? sections[0] : `${sections.slice(0, -1).join(", ")} and ${sections.at(-1)}`;
  return `${PARTY_LABEL[dept]} checks your ${list.replace(/^[A-Z]/, (ch) => ch.toLowerCase())}.`;
}

export function buildRouting(
  a: EventAnswers,
  basis: RoutingBasis,
  opts: { includeClerkForSpecial: boolean; cfg?: RulesConfig },
): RoutingSuggestion[] {
  const cfg = opts.cfg ?? DEFAULT_CONFIG;
  const { tier, triggers } = basis;
  const depts = new Map<Dept, Set<string>>();
  const add = (dept: Dept, reason: string) => {
    if (!depts.has(dept)) depts.set(dept, new Set());
    depts.get(dept)!.add(reason);
  };

  for (const t of triggers) {
    for (const dept of DEPT_FOR_TRIGGER[t.id] ?? []) {
      add(dept, reasonFor(t.id, cfg) ?? t.label);
    }
  }

  if (tier !== "instant") {
    add("hl", "Insurance verification");
    if (tier === "special") add("hl", "Accessibility plan");
  }

  if (opts.includeClerkForSpecial && tier === "special") {
    add("clerk", "Coordinates every Special event");
  }

  const order: Dept[] = ["clerk", "pws", "hl"];
  return order
    .filter((d) => depts.has(d))
    .map((dept) => {
      const reasons = [...depts.get(dept)!];
      const sections = sectionsFor(dept, a, basis);
      return { dept, reasons, sections, checks: checksSentence(dept, sections) };
    });
}

/**
 * The same pws and hl entries as Classification.reviewers, and the Clerk only for alcohol.
 * Pass the config the classification was made with when it is not the default one.
 */
export const routing = (a: EventAnswers, cls: Classification, cfg: RulesConfig = DEFAULT_CONFIG): RoutingSuggestion[] =>
  buildRouting(a, cls, { includeClerkForSpecial: false, cfg });
