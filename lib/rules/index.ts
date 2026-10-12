/**
 * Public surface of the rules engine. Phase 0 ships stubs with the final signatures;
 * workstream 1A replaces each one. Keep the `satisfies RulesApi` check.
 */
import type { RulesApi } from "./types";

export * from "./types";
export { DEFAULT_CONFIG, DEFAULT_DEMO_TODAY, STORAGE_KEY } from "./config";

function todo(name: string): never {
  throw new Error(`lib/rules: ${name}() is not implemented yet`);
}

export const classify: RulesApi["classify"] = () => todo("classify");
export const whatIf: RulesApi["whatIf"] = () => todo("whatIf");
export const routing: RulesApi["routing"] = () => todo("routing");
export const requirements: RulesApi["requirements"] = () => todo("requirements");
export const estimateFees: RulesApi["estimateFees"] = () => todo("estimateFees");
export const availability: RulesApi["availability"] = () => todo("availability");
export const occurrences: RulesApi["occurrences"] = () => todo("occurrences");
export const dateGate: RulesApi["dateGate"] = () => todo("dateGate");
export const cancellationRefund: RulesApi["cancellationRefund"] = () => todo("cancellationRefund");
export const planTimeline: RulesApi["planTimeline"] = () => todo("planTimeline");
export const occupiedWindow: RulesApi["occupiedWindow"] = () => todo("occupiedWindow");
export const locationsOverlap: RulesApi["locationsOverlap"] = () => todo("locationsOverlap");
export const dueDate: RulesApi["dueDate"] = () => todo("dueDate");

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
} satisfies RulesApi;
