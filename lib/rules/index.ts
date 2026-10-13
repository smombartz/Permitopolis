/**
 * Public surface of the rules engine. Every function is pure; see the
 * individual files for the rule it implements. Keep the `satisfies RulesApi`
 * check — it is what keeps this barrel honest after a signature changes.
 */
import type { RulesApi } from "./types";

export * from "./types";
export * from "./catalog";
export { DEFAULT_CONFIG, DEFAULT_DEMO_TODAY, STORAGE_KEY } from "./config";

export { classify, whatIf, isBlockPartyException } from "./classify";
export { routing, buildRouting, type RoutingBasis } from "./routing";
export { requirements, permitComponents } from "./requirements";
export { estimateFees } from "./fees";
export { availability, occurrences } from "./availability";
export { dateGate } from "./dateGate";
export { cancellationRefund } from "./cancellation";
export { planTimeline } from "./timeline";
export { closeoutCards, capacityWarning } from "./closeout";
export { occupiedWindow, locationsOverlap, dueDate } from "./shared";

import { classify, whatIf } from "./classify";
import { routing } from "./routing";
import { requirements } from "./requirements";
import { estimateFees } from "./fees";
import { availability, occurrences } from "./availability";
import { dateGate } from "./dateGate";
import { cancellationRefund } from "./cancellation";
import { planTimeline } from "./timeline";
import { closeoutCards, capacityWarning } from "./closeout";
import { occupiedWindow, locationsOverlap, dueDate } from "./shared";

export const rules = {
  classify,
  whatIf,
  routing,
  requirements,
  estimateFees,
  availability,
  occurrences,
  dateGate,
  cancellationRefund,
  planTimeline,
  occupiedWindow,
  locationsOverlap,
  dueDate,
  closeoutCards,
  capacityWarning,
} satisfies RulesApi;
