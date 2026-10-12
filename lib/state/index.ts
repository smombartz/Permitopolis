/**
 * Public surface of the state machine. Phase 0 ships stubs with the final signatures;
 * workstream 1B replaces each one and adds the store in ./store. Keep the
 * `satisfies StateApi` check.
 */
import type { StateApi } from "./types";

export * from "./types";
export * from "./actions";

function todo(name: string): never {
  throw new Error(`lib/state: ${name}() is not implemented yet`);
}

export const newCase: StateApi["newCase"] = () => todo("newCase");
export const transition: StateApi["transition"] = () => todo("transition");
export const availableActions: StateApi["availableActions"] = () => todo("availableActions");
export const waitingOn: StateApi["waitingOn"] = () => todo("waitingOn");
export const nextMove: StateApi["nextMove"] = () => todo("nextMove");
export const boardColumn: StateApi["boardColumn"] = () => todo("boardColumn");
export const advanceClock: StateApi["advanceClock"] = () => todo("advanceClock");
export const isOpen: StateApi["isOpen"] = () => todo("isOpen");
export const isVisibleToCity: StateApi["isVisibleToCity"] = () => todo("isVisibleToCity");
export const involves: StateApi["involves"] = () => todo("involves");
export const applicantCases: StateApi["applicantCases"] = () => todo("applicantCases");
export const queueFor: StateApi["queueFor"] = () => todo("queueFor");
export const waitingOnOthers: StateApi["waitingOnOthers"] = () => todo("waitingOnOthers");
export const reviewClock: StateApi["reviewClock"] = () => todo("reviewClock");
export const daysUntilEvent: StateApi["daysUntilEvent"] = () => todo("daysUntilEvent");
export const eventDate: StateApi["eventDate"] = () => todo("eventDate");
export const caseTotals: StateApi["caseTotals"] = () => todo("caseTotals");
export const leadTimeRisk: StateApi["leadTimeRisk"] = () => todo("leadTimeRisk");
export const nextCaseId: StateApi["nextCaseId"] = () => todo("nextCaseId");

export const state = {
  newCase,
  transition,
  availableActions,
  waitingOn,
  nextMove,
  boardColumn,
  advanceClock,
  isOpen,
  isVisibleToCity,
  involves,
  applicantCases,
  queueFor,
  waitingOnOthers,
  reviewClock,
  daysUntilEvent,
  eventDate,
  caseTotals,
  leadTimeRisk,
  nextCaseId,
} satisfies StateApi;
