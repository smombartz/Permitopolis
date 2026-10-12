/**
 * State contract. FROZEN after Phase 0 (see lib/types.ts).
 */
import type { RulesConfig, RulesCtx } from "@/lib/rules/types";
import type {
  Actor,
  CaseState,
  Dept,
  Ending,
  EventAnswers,
  EventCase,
  ISODate,
  ISODateTime,
  Party,
  Task,
  Tier,
  WizardStep,
} from "@/lib/types";
import type { Action, ActionType } from "./actions";

export type TransitionResult =
  | { ok: true; case: EventCase; /** New cases created by the action, e.g. book_again. */ spawned?: EventCase[] }
  | { ok: false; reason: string };

export interface ActionAvailability {
  type: ActionType;
  label: string;
  enabled: boolean;
  /** Why it is disabled, e.g. "Waiting on 3 neighbor sign-offs". */
  reason?: string;
  primary?: boolean;
  /** The task this action would act on, when there is one. */
  taskId?: string;
}

export type PartyStanding = "up_now" | "done_for_now" | "waiting" | "not_involved";

/** One row of "Who's up". waitingOn() always returns four, in the order applicant, clerk, pws, hl. */
export interface PartyStatus {
  party: Party;
  status: PartyStanding;
  /** Tasks this party can act on now, oldest due first. */
  openTasks: Task[];
  oldestDue: ISODate | null;
  /** Days the case has sat with this party. 0 unless status is 'up_now'. */
  daysHolding: number;
  /** One line for the row, e.g. "Approved with conditions" or "Unlocks when paid and verified". */
  note: string;
  /** What this party covers on this case, e.g. "Insurance, accessibility". */
  scope: string;
}

export type QueueGroup = "overdue" | "this_week" | "later";

export interface QueueItem {
  case: EventCase;
  task: Task;
  group: QueueGroup;
  /** Days the case has waited on this role. */
  daysWaiting: number;
}

export interface WaitingOnOthersItem {
  case: EventCase;
  /** The parties that are up now, with since when. */
  parties: PartyStatus[];
}

export interface ReviewClockView {
  day: number;
  of: number;
  pausedDays: number;
  paused: boolean;
  /** e.g. "Day 9 of 21 · paused 2 days". */
  label: string;
}

export interface CaseTotals {
  fees: number;
  deposit: number;
  total: number;
  paid: number;
  due: number;
}

export interface DemoState {
  cases: EventCase[];
  demoToday: ISODate;
  cfg: RulesConfig;
  role: Party;
  /** The applicant persona in use. 'new' is the blank wizard run. */
  personaId: string;
  hints: boolean;
  lastPathByRole: Partial<Record<Party, string>>;
  /** False when localStorage is blocked; the app then runs in memory. */
  storageOk: boolean;
}

export interface DemoActions {
  /** Applies an action through transition() and stores the result. Actor defaults to the current role. */
  dispatch(caseId: string, action: Action, actor?: Actor): { ok: boolean; reason?: string; spawnedIds?: string[] };
  /** Creates a Draft and returns its id. */
  createDraft(applicantId: string, answers?: Partial<EventAnswers>): string;
  /** Autosave from the wizard. Only Drafts can be patched. */
  updateDraft(caseId: string, patch: Partial<EventAnswers> & { wizardStep?: WizardStep }): void;
  setRole(role: Party): void;
  setPersona(personaId: string): void;
  /** Moves the demo date and runs advanceClock() over every case. */
  setDemoToday(date: ISODate): void;
  setConfig(patch: Partial<RulesConfig>): void;
  rememberPath(role: Party, path: string): void;
  toggleHints(): void;
  /** Restores the seed exactly. */
  reset(): void;
}

export type DemoStore = DemoState & DemoActions;

/* ---------- seed scripts (written as data in Phase 1, replayed in Phase 2) ---------- */

export interface SeedStep {
  at: ISODateTime;
  actor: Actor;
  action: Action;
}

/**
 * A case is seeded by replaying its script through the real engine: createDraft with the
 * answers at `createdAt`, then each step through transition() on its date, with advanceClock()
 * run between steps. Nothing in a seeded case is written by hand.
 */
export interface SeedScript {
  /** Case id, e.g. 'PMT-27-0118'. */
  id: string;
  /** 'S1'..'S6', 'F1'..'F7', 'B01'..'B25'. */
  key: string;
  applicantId: string;
  createdAt: ISODateTime;
  answers: EventAnswers;
  /** Where a Draft's wizard is left. */
  wizardStep?: WizardStep;
  steps: SeedStep[];
  /** Asserted by tests/seed.test.ts on the demo date. */
  expect: { tier: Tier; state: CaseState; ending?: Ending };
  /** Which stress rows or coverage this case exists for. */
  notes?: string;
}

export interface Persona {
  id: string;
  /** Person or organization, as shown in the persona picker. */
  name: string;
  contactName: string;
  email: string;
  phone: string | null;
  /** Scenario key this persona opens, if any. */
  scenario?: string;
}

export interface CityStaff {
  dept: Dept;
  name: string;
  title: string;
  phone: string;
}

export type BoardColumn = "do_now" | "with_city" | "coming_up" | "done";

/**
 * The public surface of lib/state besides the store. The barrel (lib/state/index.ts) must
 * satisfy this interface; every function is pure and never reads the real clock.
 */
export interface StateApi {
  /** A blank Draft. */
  newCase(args: {
    id: string;
    applicantId: string;
    createdAt: ISODateTime;
    answers?: Partial<EventAnswers>;
    wizardStep?: WizardStep;
  }): EventCase;
  /** The only way a case changes. Checks preconditions, updates tasks, writes an activity entry. */
  transition(c: EventCase, action: Action, actor: Actor, ctx: RulesCtx): TransitionResult;
  /** What this role can do to this case now, with a reason for every disabled action. */
  availableActions(c: EventCase, role: Party, ctx: RulesCtx): ActionAvailability[];
  /** Who's up. Always four rows: applicant, clerk, pws, hl. */
  waitingOn(c: EventCase, today: ISODate): PartyStatus[];
  /** One sentence naming the next move, starting with "Next:". */
  nextMove(c: EventCase, today: ISODate): string;
  boardColumn(task: Task): BoardColumn;
  /** Applies the system transitions for every day from `from` (exclusive) to `to` (inclusive). */
  advanceClock(cases: EventCase[], from: ISODate, to: ISODate, cfg: RulesConfig): EventCase[];

  /* selectors */
  /** No ending and not Closed. */
  isOpen(c: EventCase): boolean;
  /** Drafts are the applicant's alone. */
  isVisibleToCity(c: EventCase): boolean;
  /** The Clerk is involved in every non-draft case; a reviewing department when it is routed or holds a task. */
  involves(c: EventCase, role: Party): boolean;
  applicantCases(cases: EventCase[], applicantId: string): EventCase[];
  /** Tasks this role can act on now, across cases, grouped for My queue. */
  queueFor(cases: EventCase[], role: Dept, today: ISODate): QueueItem[];
  /** Cases this role is involved in where the move is someone else's. */
  waitingOnOthers(cases: EventCase[], role: Dept, today: ISODate): WaitingOnOthersItem[];
  reviewClock(c: EventCase, dept: Dept, today: ISODate): ReviewClockView | null;
  /** Days to the next session; negative once the last one has passed. */
  daysUntilEvent(c: EventCase, today: ISODate): number;
  /** The next session on or after today, or the last one when all have passed. */
  eventDate(c: EventCase, today: ISODate): ISODate | null;
  caseTotals(c: EventCase): CaseTotals;
  leadTimeRisk(c: EventCase, today: ISODate, cfg: RulesConfig): "ok" | "at_risk";
  /** The next 'PMT-27-####' after the highest in use. */
  nextCaseId(cases: EventCase[]): string;
}
