/**
 * Public surface of the state machine: every function of StateApi, the store, the seed, and
 * the selectors screens share.
 */
import type { StateApi } from "./types";

export * from "./types";
export * from "./actions";

export { availableActions } from "./availableActions";
export { actorsFor } from "./checks";
export { advanceClock, isSessionDate, lastSessionDate, sessionDates } from "./clock";
export { taskDueDate } from "./core";
export { classifyDraft, newCase, syncDraft } from "./newCase";
export { buildSeed } from "./seed";
export {
  activePermits,
  applicantCases,
  boardColumn,
  boardColumns,
  caseTotals,
  daysUntilEvent,
  eventDate,
  hasActivePermit,
  holdsDateAtQuote,
  involves,
  isOpen,
  isVisibleToCity,
  leadTimeRisk,
  nextCaseId,
  permitSessions,
  queueFor,
  reviewClock,
  waitingOnOthers,
  whoIsUp,
} from "./selectors";
export { demoToday, resetDemoStoreForTests, useDemo, useHydrated } from "./store";
export { transition } from "./transition";
export { involvement, isStalled, nextMove, waitingOn } from "./waitingOn";

import { availableActions } from "./availableActions";
import { actorsFor } from "./checks";
import { advanceClock } from "./clock";
import { newCase } from "./newCase";
import {
  activePermits,
  applicantCases,
  boardColumn,
  boardColumns,
  caseTotals,
  daysUntilEvent,
  eventDate,
  hasActivePermit,
  holdsDateAtQuote,
  involves,
  isOpen,
  isVisibleToCity,
  leadTimeRisk,
  nextCaseId,
  permitSessions,
  queueFor,
  reviewClock,
  waitingOnOthers,
  whoIsUp,
} from "./selectors";
import { transition } from "./transition";
import { involvement, nextMove, waitingOn } from "./waitingOn";

export const state = {
  newCase,
  transition,
  availableActions,
  waitingOn,
  nextMove,
  boardColumn,
  boardColumns,
  whoIsUp,
  actorsFor,
  advanceClock,
  isOpen,
  isVisibleToCity,
  involves,
  involvement,
  applicantCases,
  queueFor,
  waitingOnOthers,
  reviewClock,
  daysUntilEvent,
  eventDate,
  caseTotals,
  leadTimeRisk,
  nextCaseId,
  hasActivePermit,
  holdsDateAtQuote,
  activePermits,
  permitSessions,
} satisfies StateApi;
