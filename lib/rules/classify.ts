/**
 * classify() and whatIf(). Tier, triggers and the block-party exception from the
 * wizard's answers. Works on partial answers: a null location, schedule or
 * attendance simply adds no trigger.
 */
import { fmtMoney, fmtNumber } from "@/lib/format";
import { getSegment } from "@/lib/data/streets";
import type { EventAnswers, Tier, Trigger, TriggerId } from "@/lib/types";
import { TIER_LABEL } from "@/lib/types";
import { estimateFees } from "./fees";
import { DEFAULT_CONFIG } from "./config";
import { permitComponents } from "./requirements";
import { buildRouting } from "./routing";
import { highestTier, trig } from "./shared";
import type { Classification, RulesConfig, WhatIf } from "./types";

/** Triggers that come from where the event is held, never offered by whatIf(). */
const LOCATION_TRIGGERS: Set<TriggerId> = new Set(["street", "route", "plaza_open_area", "block_party"]);
/** Triggers that come from how many people are coming, never offered by whatIf(). */
const ATTENDANCE_TRIGGERS: Set<TriggerId> = new Set(["attendance_100", "attendance_1000"]);

export function isBlockPartyException(a: EventAnswers, cfg: RulesConfig): boolean {
  if (a.eventType !== "block_party") return false;
  if (a.location?.mode !== "streets") return false;
  if (a.location.segmentIds.length !== 1) return false;
  const segment = getSegment(a.location.segmentIds[0]);
  if (!segment || segment.kind !== "residential") return false;
  if (a.addOns.foodVending !== null) return false;
  const attendance = a.attendance ?? 0;
  return attendance < cfg.thresholds.blockPartyMaxAttendance;
}

function buildTriggers(a: EventAnswers, cfg: RulesConfig, blockPartyException: boolean): Trigger[] {
  const triggers: Trigger[] = [];
  const addOns = a.addOns;

  if (a.location) {
    if (a.location.mode === "streets") {
      triggers.push(blockPartyException ? trig("block_party", "reviewed", "Block party") : trig("street", "special", "Street closure"));
    } else if (a.location.mode === "route") {
      triggers.push(trig("route", "special", "Route closure"));
    } else if (a.location.mode === "area") {
      triggers.push(trig("plaza_open_area", "reviewed", "Plaza or open area"));
    }
  }

  if (a.attendance !== null) {
    if (a.attendance >= cfg.thresholds.specialAttendance) {
      triggers.push(trig("attendance_1000", "special", `${fmtNumber(a.attendance)} people`));
    } else if (a.attendance >= cfg.thresholds.reviewedAttendance) {
      triggers.push(trig("attendance_100", "reviewed", `${fmtNumber(a.attendance)} people`));
    }
  }

  if (addOns.fireworksDrones) triggers.push(trig("fireworks_drones", "special", "Fireworks or drones"));

  const barricades = addOns.cityServices?.barricades ?? 0;
  const officers = addOns.cityServices?.policeOfficers ?? 0;
  if (officers > 0 || barricades > cfg.thresholds.heavyBarricades) {
    triggers.push(trig("heavy_resources", "special", "Heavy city resources"));
  }

  if (addOns.amplifiedSound) triggers.push(trig("amplified_sound", "reviewed", "Amplified sound"));
  if (addOns.alcohol) triggers.push(trig("alcohol", "reviewed", "Alcohol"));
  if (addOns.foodVending !== null) {
    triggers.push(trig("food_vending", "reviewed", `${fmtNumber(addOns.foodVending.vendors)} food vendor${addOns.foodVending.vendors === 1 ? "" : "s"}`));
  }
  if (addOns.tentsStages !== null) triggers.push(trig("tents_stages", "reviewed", "Tents or stages"));
  if (addOns.cookingGenerators) triggers.push(trig("cooking_generators", "reviewed", "Cooking or generators"));
  if (addOns.admission) triggers.push(trig("admission", "reviewed", "Admission charged"));
  if (addOns.cityServices !== null) triggers.push(trig("city_services", "reviewed", "City services"));

  return triggers;
}

function durationPhrase(t: Tier): string {
  if (t === "instant") return "book and pay today";
  if (t === "reviewed") return "about 3 weeks";
  return "about 2 months";
}

/**
 * The one-line result: "This is a Reviewed event: about 3 weeks, $465 estimated". `total` is
 * null before a place is chosen. A total that carries a late fee says so, with the fee
 * ("$518.75 with the $53.75 late fee"), so the line cannot disagree with the total printed under it.
 */
export function tierSummary(t: Tier, total: number | null, lateFee: number | null = null): string {
  const article = t === "instant" ? "an" : "a";
  const tierNoun = t === "special" ? TIER_LABEL.special : `${TIER_LABEL[t]} event`;
  const lead = `This is ${article} ${tierNoun}: ${durationPhrase(t)}`;
  if (total === null) return lead;
  return lateFee ? `${lead}, ${fmtMoney(total)} with the ${fmtMoney(lateFee)} late fee` : `${lead}, ${fmtMoney(total)} estimated`;
}

export const classify = (a: EventAnswers, cfg: RulesConfig = DEFAULT_CONFIG): Classification => {
  const blockPartyException = isBlockPartyException(a, cfg);
  const triggers = buildTriggers(a, cfg, blockPartyException);
  const t = highestTier(triggers);
  const reviewers = buildRouting(a, { tier: t, triggers, blockPartyException }, { includeClerkForSpecial: true, cfg });
  const components = permitComponents(a, triggers, blockPartyException);

  const feeTotal = a.location ? estimateFees(a, { tier: t } as Classification, cfg).total : null;
  const summary = tierSummary(t, feeTotal);

  return {
    tier: t,
    triggers,
    blockPartyException,
    leadTimeDays: cfg.leadTimeDays[t],
    reviewers,
    components,
    summary,
  };
};

function removalLabel(id: TriggerId): string {
  const labels: Partial<Record<TriggerId, string>> = {
    fireworks_drones: "fireworks or drones",
    heavy_resources: "the extra police or barricades",
    amplified_sound: "amplified sound",
    alcohol: "alcohol",
    food_vending: "food or vending",
    tents_stages: "tents or stages",
    cooking_generators: "cooking or generators",
    admission: "admission",
    city_services: "city services",
  };
  return labels[id] ?? id;
}

/** A counterfactual answers object with one add-on trigger switched off. */
function withoutAddOn(a: EventAnswers, id: TriggerId, cfg: RulesConfig): EventAnswers {
  const addOns = { ...a.addOns };
  switch (id) {
    case "fireworks_drones":
      addOns.fireworksDrones = false;
      break;
    case "amplified_sound":
      addOns.amplifiedSound = false;
      break;
    case "alcohol":
      addOns.alcohol = false;
      break;
    case "food_vending":
      addOns.foodVending = null;
      break;
    case "tents_stages":
      addOns.tentsStages = null;
      break;
    case "cooking_generators":
      addOns.cookingGenerators = false;
      break;
    case "admission":
      addOns.admission = false;
      break;
    case "city_services":
      addOns.cityServices = null;
      break;
    case "heavy_resources":
      if (addOns.cityServices) {
        addOns.cityServices = { ...addOns.cityServices, policeOfficers: 0, barricades: Math.min(addOns.cityServices.barricades, cfg.thresholds.heavyBarricades) };
      }
      break;
    default:
      break;
  }
  return { ...a, addOns };
}

export const whatIf = (a: EventAnswers, cfg: RulesConfig = DEFAULT_CONFIG): WhatIf[] => {
  const base = classify(a, cfg);
  const results: WhatIf[] = [];
  for (const t of base.triggers) {
    if (LOCATION_TRIGGERS.has(t.id) || ATTENDANCE_TRIGGERS.has(t.id)) continue;
    const without = withoutAddOn(a, t.id, cfg);
    const without_cls = classify(without, cfg);
    if (without_cls.tier !== base.tier) {
      results.push({
        triggerId: t.id,
        tier: without_cls.tier,
        text: `Remove ${removalLabel(t.id)}: ${TIER_LABEL[without_cls.tier]}, ${without_cls.tier === "instant" ? "book today" : durationPhrase(without_cls.tier)}`,
      });
    }
  }
  return results;
};
