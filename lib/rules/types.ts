/**
 * Rules contract. FROZEN after Phase 0 (see lib/types.ts).
 */
import type {
  Availability,
  CaseState,
  Dept,
  EventAnswers,
  EventCase,
  FeeLine,
  HHmm,
  ISODate,
  ISODateTime,
  Location,
  Occurrence,
  Schedule,
  Task,
  Tier,
  Trigger,
  TriggerId,
} from "@/lib/types";

export interface FeeSchedule {
  applicationFee: Record<Tier, number>;
  /** Per hour. */
  shelterPerHour: number;
  fieldPerHour: number;
  /** Per day. */
  cityHallPlazaPerDay: number;
  greatLawnPerDay: number;
  streetClosurePerBlockPerDay: number;
  routeClosurePerMile: number;
  amplifiedSoundPerDay: number;
  alcoholLicensePerDay: number;
  vendorPermitEach: number;
  structureInspectionEach: number;
  policePerOfficerHour: number;
  barricadeEachPerDay: number;
  /** Actuals only; never estimated. */
  cleanupCrewPerWorkerHour: number;
  deposit: Record<Tier, number>;
}

export interface CancellationBand {
  /** Applies when days before the event is at least this. Bands are checked from the largest down. */
  minDaysBefore: number;
  /** Share of space and permit fees refunded. */
  refundRate: number;
  /** Flat amount kept from the refund. */
  processingFee: number;
  /** Whether the application fee is kept by the city. */
  keepsApplicationFee: boolean;
  label: string;
}

export interface RulesConfig {
  thresholds: {
    /** At or above: Reviewed. */
    reviewedAttendance: number;
    /** At or above: Special event. */
    specialAttendance: number;
    /** Block-party exception applies below this. */
    blockPartyMaxAttendance: number;
    /** More than this many barricades counts as heavy city resources. */
    heavyBarricades: number;
    sqFtPerPerson: number;
  };
  leadTimeDays: Record<Tier, number>;
  hold: { daysAfterQuote: number };
  lateFee: { rate: number; minDaysBeforeEvent: number };
  sla: {
    intakeDays: number;
    reviewDays: Record<Tier, number>;
    requestResponseDays: number;
    verificationDays: number;
    preApplicationMeetingDaysAfterAcceptance: number;
    communityNoticeDaysBefore: number;
    vendorHealthPermitDaysBefore: number;
    coordinationMeetingDaysBefore: number;
    walkthroughDaysBefore: number;
    vendorFoodPermitsDaysBefore: number;
    closeoutDaysAfterEvent: number;
    finalBillDaysAfterInvoice: number;
    /** A computed due date that lands on a weekend moves to the Friday before. */
    rollWeekendsBack: boolean;
  };
  /** Days a case still needs from each state to reach Permitted; drives the lead-time risk flag. */
  risk: { daysNeeded: Partial<Record<CaseState, number>> };
  fees: FeeSchedule;
  cancellation: CancellationBand[];
}

/** Everything a rule or a transition may read besides the case itself. */
export interface RulesCtx {
  today: ISODate;
  /** The demo clock, used for activity timestamps. Defaults to `${today}T09:00`. */
  now?: ISODateTime;
  cases: EventCase[];
  cfg: RulesConfig;
}

export interface RoutingSuggestion {
  dept: Dept;
  /** One line per trigger, e.g. "Amplified sound". */
  reasons: string[];
  /** What the department checks, e.g. ['Sound details']. */
  sections: string[];
  /** One line for the applicant on what this department checks. */
  checks: string;
}

export type PermitComponentId =
  | "space_reservation"
  | "public_space_use"
  | "street_closure"
  | "amplified_sound"
  | "alcohol_license"
  | "food_vendor_permits"
  | "structure_fire"
  | "block_party"
  | "insurance_verification";

export interface PermitComponent {
  id: PermitComponentId;
  label: string;
  approvedBy: string;
}

export interface Classification {
  tier: Tier;
  triggers: Trigger[];
  blockPartyException: boolean;
  leadTimeDays: number;
  reviewers: RoutingSuggestion[];
  components: PermitComponent[];
  /** e.g. "This is a Reviewed event: about 3 weeks, $715 estimated". */
  summary: string;
}

export interface WhatIf {
  triggerId: TriggerId;
  /** The tier the event would drop to without this trigger. */
  tier: Tier;
  /** e.g. "Remove the beer garden: Instant, book today". */
  text: string;
}

export interface FeeEstimate {
  lines: FeeLine[];
  /** Sum of fee and late-fee lines. */
  fees: number;
  deposit: number;
  total: number;
  /** Series only: what one session costs. */
  perSession?: number;
  sessions?: number;
  /** Series only: due at booking (the first session). */
  dueNow?: number;
}

export type DateFix = "new_date" | "drop_addon" | "late_fee";

export interface DateGate {
  /** The worst of the sessions' availabilities. Open when no place or no date is chosen yet. */
  availability: Availability;
  /** Days from today to the first session. 0, and meaningless, when no date is chosen yet. */
  daysUntil: number;
  /** True when the tier's lead time is met, and when no date is chosen yet. */
  leadTimeOk: boolean;
  /** True when the date is open or impacted and the lead time is met. With no date yet, nothing fails. */
  ok: boolean;
  /** The earliest date that meets the lead time and is open. */
  earliestDate: ISODate;
  /**
   * What to offer, in this order. Empty when the gate passes. A date that is only too close
   * offers a new date, dropping an add-on (when `droppable` has one) and the late fee. A date
   * that is booked or blacked out offers a new date and nothing else.
   */
  fixes: DateFix[];
  /** Triggers whose removal lowers the tier far enough to meet the lead time. Empty when the gate passes. */
  droppable: TriggerId[];
  /** What the late fee would add. */
  lateFeeAmount: number;
}

export interface TimelineStep {
  key: "submit_by" | "reviews_done_by" | "quote_paid_by" | "walkthrough" | "event_day";
  label: string;
  date: ISODate;
}

export interface CancellationResult {
  refund: number;
  kept: number;
  /** The band that applied, in plain language. */
  rule: string;
}

/**
 * The public surface of lib/rules. The barrel (lib/rules/index.ts) must satisfy this
 * interface; every function is pure.
 */
export interface RulesApi {
  /** Tier, triggers, reviewers and permit components for a set of answers. Works on partial answers. */
  classify(answers: EventAnswers, cfg?: RulesConfig): Classification;
  /** One entry per trigger whose removal alone lowers the tier, found by re-running classify without it. */
  whatIf(answers: EventAnswers, cfg?: RulesConfig): WhatIf[];
  /**
   * Suggested reviewers with reasons. The Clerk can adjust them. Pass the config when it is not
   * the default: the crowd reason quotes the configured Special threshold.
   */
  routing(answers: EventAnswers, cls: Classification, cfg?: RulesConfig): RoutingSuggestion[];
  /**
   * The applicant's cards for this plan, all created up front. Cards for later stages are
   * 'locked' with `unlocksOn`. Task ids are `${caseId}:${catalogId}` (plus `:${n}` when repeated).
   * City tasks are not created here; transition() creates them.
   */
  requirements(
    answers: EventAnswers,
    cls: Classification,
    ctx: { caseId: string; today: ISODate; cfg?: RulesConfig },
  ): Task[];
  /** Fee lines, deposit and total. Line ids are `${caseId}:fee:${n}` when caseId is given. */
  estimateFees(
    answers: EventAnswers,
    cls: Classification,
    cfg?: RulesConfig,
    options?: { lateFee?: boolean; caseId?: string },
  ): FeeEstimate;
  /**
   * Is this place free in this window? A slot is taken by another case that holds the date
   * (dateHold 'held') or is Permitted, on Event day or in Closeout, whose location overlaps
   * and whose setup-to-teardown window overlaps. Blackout beats booked beats impacted.
   */
  availability(
    location: Location,
    window: { date: ISODate; start: HHmm; end: HHmm },
    ctx: RulesCtx,
    ignoreCaseId?: string,
  ): Availability;
  /** Every session of a schedule with its availability. One entry for a single event. */
  occurrences(schedule: Schedule, location: Location, ctx: RulesCtx, ignoreCaseId?: string): Occurrence[];
  /** The lead-time and availability gate, with the fixes to offer when it fails. */
  dateGate(answers: EventAnswers, cls: Classification, ctx: RulesCtx, ignoreCaseId?: string): DateGate;
  /** What cancelling today refunds, excluding the deposit (always refunded in full). */
  cancellationRefund(c: EventCase, today: ISODate, cfg?: RulesConfig): CancellationResult;
  /** Milestones worked back from the event date. */
  planTimeline(answers: EventAnswers, cls: Classification, today: ISODate, cfg?: RulesConfig): TimelineStep[];
  /** Setup start (or start) to teardown end (or end). */
  occupiedWindow(schedule: Schedule): { start: HHmm; end: HHmm };
  locationsOverlap(a: Location, b: Location): boolean;
  /** `base` plus `offsetDays`, moved to the Friday before when it lands on a weekend and the config says so. */
  dueDate(base: ISODate, offsetDays: number, cfg?: RulesConfig): ISODate;
  /**
   * The after-event cards from the catalogue (stage 'closeout'), all 'locked'. transition()
   * calls this when a case enters Closeout, or Closed for an Instant event that skips Closeout.
   */
  closeoutCards(c: EventCase, cfg?: RulesConfig): Task[];
  /** Set when attendance exceeds a bookable space's capacity. Never changes the tier. */
  capacityWarning(answers: EventAnswers): CapacityWarning | null;
}

export interface CapacityWarning {
  capacity: number;
  /** How many people over capacity. */
  over: number;
  /** A larger bookable space that fits, by id, or null when none does. */
  suggestionId: string | null;
  /** e.g. "Shelter 2 holds 40 people. Shelter 3 holds 60." */
  text: string;
}
