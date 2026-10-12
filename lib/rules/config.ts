/**
 * Tier thresholds, lead times, service levels and fees: configured rules, not code.
 * Components and rule functions read these values; nothing hardcodes them.
 */
import { CANCELLATION_SCHEDULE, FEE_SCHEDULE } from "@/lib/data/fees";
import type { RulesConfig } from "./types";

export const DEFAULT_CONFIG: RulesConfig = {
  thresholds: {
    reviewedAttendance: 100,
    specialAttendance: 1000,
    blockPartyMaxAttendance: 250,
    heavyBarricades: 20,
    sqFtPerPerson: 10,
  },
  leadTimeDays: { instant: 10, reviewed: 30, special: 60 },
  hold: { daysAfterQuote: 14 },
  lateFee: { rate: 0.25, minDaysBeforeEvent: 0 },
  sla: {
    intakeDays: 3,
    reviewDays: { instant: 0, reviewed: 14, special: 21 },
    requestResponseDays: 5,
    verificationDays: 7,
    preApplicationMeetingDaysAfterAcceptance: 7,
    communityNoticeDaysBefore: 30,
    vendorHealthPermitDaysBefore: 14,
    coordinationMeetingDaysBefore: 21,
    walkthroughDaysBefore: 7,
    vendorFoodPermitsDaysBefore: 7,
    closeoutDaysAfterEvent: 14,
    finalBillDaysAfterInvoice: 14,
    rollWeekendsBack: true,
  },
  risk: {
    daysNeeded: { submitted: 21, in_review: 14, needs_info: 14, quote_sent: 3 },
  },
  fees: FEE_SCHEDULE,
  cancellation: CANCELLATION_SCHEDULE,
};

/** The fixed demo date. The store holds the live value; this is only its default. */
export const DEFAULT_DEMO_TODAY = "2027-05-03";

/** localStorage key for the whole demo. */
export const STORAGE_KEY = "permitopolis-demo-v1";
