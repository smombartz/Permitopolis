/**
 * closeoutCards(): the after-event cards from the catalogue, all locked.
 * capacityWarning(): attendance over a bookable space's capacity.
 */
import { CARD_CATALOG } from "./catalog";
import { DEFAULT_CONFIG } from "./config";
import { SPACES, SPACE_BY_ID, type Space } from "@/lib/data/inventory";
import type { CapacityWarning, Classification, RulesConfig } from "./types";
import type { EventAnswers, EventCase, Task } from "@/lib/types";

export const closeoutCards = (c: EventCase, cfg: RulesConfig = DEFAULT_CONFIG): Task[] => {
  const cls: Classification = {
    tier: c.tier,
    triggers: c.triggers,
    blockPartyException: false,
    leadTimeDays: cfg.leadTimeDays[c.tier],
    reviewers: [],
    components: [],
    summary: "",
  };
  const tasks: Task[] = [];
  for (const spec of CARD_CATALOG) {
    if (spec.stage !== "closeout") continue;
    if (!spec.when(c, cls)) continue;
    tasks.push({
      id: `${c.id}:${spec.id}`,
      catalogId: spec.id,
      owner: "applicant",
      kind: spec.kind,
      title: spec.title,
      why: spec.why,
      reviewer: spec.reviewer,
      dueDate: null,
      status: "locked",
      unlocksOn: spec.unlocksOn,
      phase: spec.phase,
      payload: {},
      history: [],
      tags: [],
    });
  }
  return tasks;
};

export const capacityWarning = (a: EventAnswers): CapacityWarning | null => {
  if (a.location?.mode !== "inventory" || a.attendance === null) return null;
  const spaces = a.location.inventoryIds.map((id) => SPACE_BY_ID[id]).filter((s): s is Space => s !== undefined);
  if (spaces.length === 0) return null;

  const capacity = spaces.reduce((sum, s) => sum + (s.capacity ?? 0), 0);
  if (a.attendance <= capacity) return null;

  const over = a.attendance - capacity;
  const kind = spaces[0].kind;
  const bigger = SPACES.filter((s) => s.kind === kind && (s.capacity ?? 0) >= a.attendance!)
    .sort((x, y) => (x.capacity ?? 0) - (y.capacity ?? 0))[0];

  const text = bigger
    ? `${spaces[0].name} holds ${capacity} people. ${bigger.name} holds ${bigger.capacity}.`
    : `${spaces[0].name} holds ${capacity} people. No larger space of that kind is available.`;

  return { capacity, over, suggestionId: bigger?.id ?? null, text };
};
