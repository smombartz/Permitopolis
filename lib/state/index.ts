/**
 * Public surface of the state machine: every function of StateApi, plus the store.
 */
import type { StateApi } from "./types";

export * from "./types";
export * from "./actions";

export { availableActions } from "./availableActions";
export { advanceClock, isSessionDate, lastSessionDate, sessionDates } from "./clock";
export { taskDueDate } from "./core";
export { classifyDraft, newCase, syncDraft } from "./newCase";
export {
  applicantCases,
  boardColumn,
  caseTotals,
  daysUntilEvent,
  eventDate,
  involves,
  isOpen,
  isVisibleToCity,
  leadTimeRisk,
  nextCaseId,
  queueFor,
  reviewClock,
  waitingOnOthers,
} from "./selectors";
export { demoToday, resetDemoStoreForTests, useDemo, useHydrated } from "./store";
export { transition } from "./transition";
export { isStalled, nextMove, waitingOn } from "./waitingOn";

import { availableActions } from "./availableActions";
import { advanceClock } from "./clock";
import { newCase } from "./newCase";
import {
  applicantCases,
  boardColumn,
  caseTotals,
  daysUntilEvent,
  eventDate,
  involves,
  isOpen,
  isVisibleToCity,
  leadTimeRisk,
  nextCaseId,
  queueFor,
  reviewClock,
  waitingOnOthers,
} from "./selectors";
import { transition } from "./transition";
import { nextMove, waitingOn } from "./waitingOn";

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
