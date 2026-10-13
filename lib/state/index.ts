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
  type PermitSession,
} from "./selectors";
export { demoToday, resetDemoStoreForTests, useDemo, useHydrated } from "./store";
export { transition } from "./transition";
export { involvement, isStalled, nextMove, waitingOn, type Involvement } from "./waitingOn";

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
