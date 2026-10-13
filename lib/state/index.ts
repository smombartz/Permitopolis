/**
 * Public surface of the state machine: every function of StateApi, the store, the seed, and
 * the selectors screens share.
 */
import type { StateApi } from "./types";

export * from "./types";
export * from "./actions";

export { availableActions } from "./availableActions";
export {
  actorsFor,
  // The checks `transition()` runs, one per action a panel offers: a screen calls the same
  // check to show the engine's own reason before the button is pressed.
  cardUnderVerification,
  checkAcceptComplete,
  checkCompleteCityTask,
  checkCompleteTask,
  checkConfirmRouting,
  checkDecideAmendment,
  checkIssuePermit,
  checkLogCloseout,
  checkReconcileClose,
  checkRequestInfo,
  checkPay,
  checkReviewDecide,
  checkScheduleMeeting,
  checkSendQuote,
  checkSendToCommission,
  checkVerifyOrReject,
  insideLeadTime,
  lateFeeApplies,
  meetingCardFor,
  nextUnpaidSession,
  type CheckResult,
} from "./checks";
// An amendment: where it stands, the plan the permit still covers, what it owes.
export {
  AMENDMENT_SUBMIT_CARD,
  amendmentBalance,
  amendmentCardsInFlight,
  amendmentPayOpen,
  amendmentPaymentDue,
  amendmentSignOpen,
  amendmentStage,
  pendingAmendment,
  permitCovers,
  permittedPlan,
  type AmendmentStage,
  type PendingAmendment,
} from "./amendment";
// The record under an amendment's answers, as `amend` builds it: the amendment wizard prices its diff from it.
export { amendedPlan, type AmendedPlan } from "./transitions/amendment";
export { advanceClock, isSessionDate, lastSessionDate, sessionDates } from "./clock";
// What a quote asks for and what is still owed on it ("What a quote asks for" in the readme).
export { dueAtQuote, quoteBalance, quotePaid, sessionPrice, taskDueDate, taskSubmittedOn, vendorHealthPermits } from "./core";
export { classifyDraft, newCase, syncDraft } from "./newCase";
export { buildSeed } from "./seed";
export {
  activePermits,
  applicantCases,
  boardColumn,
  boardColumns,
  caseTotals,
  closeoutSettlement,
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
  refundIfCancelled,
  reviewClock,
  waitingOnOthers,
  whoIsUp,
  type CancelRefund,
  type CloseoutSettlement,
} from "./selectors";
export { demoToday, hydrateDemoStore, resetDemoStoreForTests, useDemo, useHydrated } from "./store";
export { transition } from "./transition";
export { ENDING_PHRASE, involvement, isStalled, nextMove, waitingOn } from "./waitingOn";

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
