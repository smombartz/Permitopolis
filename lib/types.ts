/**
 * Domain model. FROZEN after Phase 0: every workstream builds against these
 * shapes. If you need a change, report it as a contract change request; do not
 * edit this file from a workstream.
 *
 * One EventCase carries an event from the first wizard answer to closeout.
 * Tier, state, the applicant's board and the city's queues are all views of it.
 */

export type ISODate = string; // '2027-05-03'
export type ISODateTime = string; // '2027-04-30T14:10'
export type HHmm = string; // '18:00'

export type Tier = "instant" | "reviewed" | "special";
export type Party = "applicant" | "clerk" | "pws" | "hl";
export type Dept = "clerk" | "pws" | "hl";
export type Actor = Party | "system" | "neighbor";

export type CaseState =
  | "draft"
  | "submitted"
  | "in_review"
  | "needs_info"
  | "quote_sent"
  | "permitted"
  | "event_day"
  | "closeout"
  | "closed";

/** Off-path endings. A case with an ending keeps the state it ended in. */
export type Ending = "withdrawn" | "denied" | "cancelled" | "hold_expired";

export type EventType =
  | "picnic_party"
  | "performance_rally"
  | "market_festival"
  | "race_parade"
  | "block_party"
  | "class_meetup";

export type WizardStep = "what" | "where" | "when" | "size" | "plan";

export type TriggerId =
  // raise to Special
  | "street"
  | "route"
  | "attendance_1000"
  | "fireworks_drones"
  | "heavy_resources"
  // raise to Reviewed
  | "plaza_open_area"
  | "attendance_100"
  | "amplified_sound"
  | "alcohol"
  | "food_vending"
  | "tents_stages"
  | "cooking_generators"
  | "admission"
  | "city_services"
  | "block_party";

export interface Trigger {
  id: TriggerId;
  raisesTo: Tier;
  /** Chip text, e.g. "Amplified sound" or "1,200 people". */
  label: string;
}

/* ---------- what the wizard collects ---------- */

export type LocationMode = "inventory" | "area" | "streets" | "route";

export interface Location {
  mode: LocationMode;
  /** Bookable spaces, e.g. ['shelter-3']. Empty unless mode is 'inventory'. */
  inventoryIds: string[];
  /** Set when mode is 'area'. */
  areaId?: "city-hall-plaza" | "great-lawn";
  /** Rectangle in the map's SVG viewBox units. Set when mode is 'area'. */
  areaRect?: { x: number; y: number; w: number; h: number };
  /** Street segment ids. Ordered when mode is 'route'. */
  segmentIds: string[];
  capacity?: number;
  squareFeet?: number;
  miles?: number;
  /** Plain-language place, e.g. "Shelter 3, Riverside Park". */
  label: string;
}

export interface Availability {
  status: "open" | "impacted" | "booked" | "blackout";
  /** Why, in plain language. Present for every status but 'open'. */
  reason?: string;
  /** Next open dates, offered when the status is 'booked' or 'blackout'. */
  nextOpen?: ISODate[];
}

export interface Occurrence {
  date: ISODate;
  availability: Availability;
  /** 'skipped' marks a session that falls on a blackout date. */
  billing: "upcoming" | "due" | "paid" | "skipped";
}

export interface Recurrence {
  frequency: "weekly" | "biweekly";
  /** 0 is Sunday. */
  weekday: number;
  until: ISODate;
}

export interface Schedule {
  /** The event date, or the first session of a series. */
  date: ISODate;
  start: HHmm;
  end: HHmm;
  setupStart?: HHmm;
  teardownEnd?: HHmm;
  recurrence?: Recurrence;
  /** One entry for a single event; one per session for a series. */
  occurrences: Occurrence[];
}

export interface CityServices {
  barricades: number;
  trash: boolean;
  power: boolean;
  policeOfficers: number;
  policeHours: number;
}

export interface AddOns {
  amplifiedSound: boolean;
  alcohol: boolean;
  foodVending: { vendors: number; vendorNames?: string[] } | null;
  tentsStages: { count: number } | null;
  cookingGenerators: boolean;
  fireworksDrones: boolean;
  admission: boolean;
  cityServices: CityServices | null;
}

export interface EventAnswers {
  eventType: EventType | null;
  name: string;
  description?: string;
  location: Location | null;
  schedule: Schedule | null;
  attendance: number | null;
  addOns: AddOns;
}

/* ---------- what the case accumulates ---------- */

export type ReviewStatus =
  | "not_routed"
  | "pending"
  | "approved"
  | "approved_with_conditions"
  | "needs_info"
  | "denied";

export interface ReviewClock {
  startedOn: ISODate | null;
  /** Set while the clock is paused for a request to the applicant. */
  pausedSince: ISODate | null;
  /** Days paused in earlier, finished pauses. */
  pausedDays: number;
  allowedDays: number;
}

export interface Review {
  dept: Dept;
  /** What this department checks, e.g. ['Sound details', 'Traffic control']. */
  sections: string[];
  status: ReviewStatus;
  dueDate: ISODate | null;
  decidedOn: ISODate | null;
  clock: ReviewClock;
  /** City staff only. Never shown to the applicant. */
  internalNote: string;
  messageToApplicant: string;
}

export type TaskKind =
  | "document"
  | "form"
  | "action"
  | "payment"
  | "sign_off"
  | "meeting"
  | "review"
  | "inspection";

export type TaskStatus = "locked" | "todo" | "submitted" | "changes_requested" | "done";

export type TaskPhase =
  | "before_submitting"
  | "review"
  | "permit"
  | "before_event"
  | "event_day"
  | "after";

/** Events inside transition() that unlock locked tasks. */
export type UnlockEvent =
  | "presubmit_done"
  | "submitted"
  | "accepted"
  | "routed"
  | "quote_sent"
  | "signed"
  | "paid"
  | "permitted"
  | "event_day"
  | "closeout"
  | "hours_logged"
  | "invoice_issued"
  | "closed";

export interface FileRef {
  name: string;
  size: number;
  type: string;
}

export interface TaskRequest {
  from: Dept;
  message: string;
  at: ISODateTime;
  dueDate: ISODate;
  resolved: boolean;
}

/**
 * Loose bag for task-specific data. Known keys:
 * files, form, progress {done,total}, scheduledFor, amount, vendorName,
 * rejectedReason, cleanup, signature.
 */
export interface TaskPayload {
  files?: FileRef[];
  form?: Record<string, unknown>;
  progress?: { done: number; total: number };
  scheduledFor?: ISODate;
  amount?: number;
  vendorName?: string;
  rejectedReason?: string;
  [key: string]: unknown;
}

export interface TaskHistoryEntry {
  at: ISODateTime;
  actor: Actor;
  status: TaskStatus;
  note?: string;
}

/**
 * The applicant's to-do cards and the city's outstanding actions are the same
 * Task objects, filtered by owner. "Waiting on" is computed from them.
 */
export interface Task {
  /** `${caseId}:${catalogId}` plus `:${n}` for repeated cards. */
  id: string;
  /** Row of the card catalogue, or a city task id such as 'intake_check'. */
  catalogId: string;
  owner: Party;
  kind: TaskKind;
  title: string;
  /** The answer that created it, e.g. "Because you added amplified sound". */
  why: string;
  /** Who checks the applicant's work. Null when nobody has to. */
  reviewer: Dept | null;
  dueDate: ISODate | null;
  status: TaskStatus;
  /** What unlocks a locked task. Null once unlocked. */
  unlocksOn: UnlockEvent | null;
  phase: TaskPhase;
  /** A reviewer's open request pinned to this card. */
  request?: TaskRequest;
  payload: TaskPayload;
  history: TaskHistoryEntry[];
  tags: "amendment"[];
}

export interface FeeLine {
  id: string;
  dept: Dept;
  label: string;
  qty: number;
  unit: string;
  unitPrice: number;
  estimate: number;
  /** Filled in at closeout. */
  actual: number | null;
  kind: "fee" | "deposit" | "late_fee";
}

export interface Condition {
  id: string;
  dept: Dept;
  text: string;
  mergedByClerk: boolean;
  acceptedByApplicant: boolean;
}

export interface DateHold {
  status: "none" | "held" | "expired" | "released";
  placedOn: ISODate | null;
  expiresOn: ISODate | null;
}

export interface Payment {
  id: string;
  at: ISODateTime;
  /** Negative for a refund. */
  amount: number;
  method: "card" | "in_person";
  kind: "booking" | "quote" | "session" | "final_invoice" | "refund";
  occurrenceDate?: ISODate;
}

export interface Activity {
  at: ISODateTime;
  actor: Actor;
  text: string;
}

export interface Permit {
  issuedOn: ISODate;
  /** Typed full name from the quote. Null for Instant bookings. */
  signature: string | null;
}

export interface CaseFlags {
  sentToCommission: boolean;
  lateFee: boolean;
  /** The applicant accepted the conditions and signed. */
  signed: boolean;
  /** The Clerk accepted the application as complete. */
  acceptedComplete: boolean;
  /** An amendment is waiting for approval; the permit covers the original plan. */
  amendmentPending: boolean;
}

export interface Closeout {
  cleanup: "pass" | "issues" | null;
  notes: string;
  hoursLoggedOn: ISODate | null;
  /** Positive: the applicant owes this. Negative: refund beyond the deposit never happens. */
  balance: number | null;
  refund: number | null;
  feedback: { rating: number; comment?: string } | null;
}

export interface EventCase extends EventAnswers {
  /** e.g. 'PMT-27-0118'. */
  id: string;
  applicantId: string;
  tier: Tier;
  triggers: Trigger[];
  state: CaseState;
  ending: Ending | null;
  endingReason: string | null;
  dateHold: DateHold;
  reviews: Review[];
  tasks: Task[];
  conditions: Condition[];
  feeLines: FeeLine[];
  payments: Payment[];
  activity: Activity[];
  permit: Permit | null;
  flags: CaseFlags;
  closeout: Closeout;
  /** Where the applicant left the wizard. */
  wizardStep: WizardStep;
  createdAt: ISODateTime;
  submittedAt: ISODateTime | null;
  /** Set by "Book again next year". */
  clonedFrom: string | null;
}

/* ---------- labels shared by every screen ---------- */

export const TIER_LABEL: Record<Tier, string> = {
  instant: "Instant",
  reviewed: "Reviewed",
  special: "Special event",
};

export const PARTY_LABEL: Record<Party, string> = {
  applicant: "Applicant",
  clerk: "City Clerk",
  pws: "Public Works & Safety",
  hl: "Health & Legal",
};

export const STATE_LABEL: Record<CaseState, string> = {
  draft: "Draft",
  submitted: "Submitted",
  in_review: "In review",
  needs_info: "Needs info",
  quote_sent: "Quote sent",
  permitted: "Permitted",
  event_day: "Event day",
  closeout: "Closeout",
  closed: "Closed",
};

export const ENDING_LABEL: Record<Ending, string> = {
  withdrawn: "Withdrawn",
  denied: "Denied",
  cancelled: "Cancelled",
  hold_expired: "Hold expired",
};

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  picnic_party: "Picnic or party",
  performance_rally: "Performance or rally",
  market_festival: "Market or festival",
  race_parade: "Race or parade",
  block_party: "Block party",
  class_meetup: "Class or club meetup",
};

/** The eight states on the stepper. Needs info is a marker on In review. */
export const MAIN_PATH: CaseState[] = [
  "draft",
  "submitted",
  "in_review",
  "quote_sent",
  "permitted",
  "event_day",
  "closeout",
  "closed",
];

export const PARTIES: Party[] = ["applicant", "clerk", "pws", "hl"];
export const DEPTS: Dept[] = ["clerk", "pws", "hl"];

export const EMPTY_ADDONS: AddOns = {
  amplifiedSound: false,
  alcohol: false,
  foodVending: null,
  tentsStages: null,
  cookingGenerators: false,
  fireworksDrones: false,
  admission: false,
  cityServices: null,
};
