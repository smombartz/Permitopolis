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
  /**
   * For a party that is 'waiting': the locked task it gets next, the one `note` says is waiting
   * ("Issue permit", for "Unlocks when paid and verified"). Absent when it has none.
   */
  nextTask?: Task;
  /** What this party covers on this case, e.g. "Insurance, accessibility". */
  scope: string;
}

/**
 * How a party stands to a case, before looking at what it has to do.
 * - 'active': it has work on this case, now or earlier.
 * - 'awaiting_routing': a department named as reviewer on a card of a case the Clerk has not
 *   routed yet. It is expected, but it has not started and may still be left out.
 * - 'none': not part of this case. A Draft is the applicant's alone; a department the Clerk
 *   routed the case without, and that holds no task, is not part of it either.
 */
export type Involvement = "active" | "awaiting_routing" | "none";

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

/** One held date of an active permit: a series has one entry per session. */
export interface PermitSession {
  case: EventCase;
  date: ISODate;
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
  /** False when localStorage is blocked; the app then runs in memory. Read it only once useHydrated() is true: the server has no storage. */
  storageOk: boolean;
}

export interface DemoActions {
  /**
   * Applies an action through transition() and stores the result. Actor defaults to the current
   * role. An action the actor may not raise is refused with a reason ("Only the City Clerk can
   * issue the permit."), and the case is left as it was: see `actorsFor()`.
   */
  dispatch(caseId: string, action: Action, actor?: Actor): { ok: boolean; reason?: string; spawnedIds?: string[] };
  /** Creates a Draft and returns its id. */
  createDraft(applicantId: string, answers?: Partial<EventAnswers>): string;
  /**
   * Autosave from the wizard. Only Drafts can be patched. The Draft's sessions, tier and triggers
   * are brought in step with the answers on every call. `lateFee` records the applicant's choice
   * at the date gate ("pay a late fee") in `flags.lateFee`: a date inside the lead time can then
   * be booked or submitted, and carries a "Late fee" line.
   */
  updateDraft(caseId: string, patch: Partial<EventAnswers> & { wizardStep?: WizardStep; lateFee?: boolean }): void;
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
  /**
   * One sentence naming the next move, starting with "Next:". Pass the applicant's name (the
   * persona's `name`) to get "Next: Downtown Arts Collective uploads ..."; without it the
   * sentence says "The applicant".
   */
  nextMove(c: EventCase, today: ISODate, applicantName?: string): string;
  boardColumn(task: Task): BoardColumn;
  /**
   * The applicant's board: their cards by column. Do now is in the PRD's order: a city request
   * pinned on top, then Submit application once it has unlocked, then by due date. The other
   * columns keep the order of the plan.
   */
  boardColumns(c: EventCase): Record<BoardColumn, Task[]>;
  /** The parties that are up now, in the order applicant, clerk, pws, hl. Empty when nobody is. */
  whoIsUp(c: EventCase, today: ISODate): Party[];
  /** The parties that may raise this action, e.g. ['applicant', 'clerk'] for `pay`. transition() refuses anyone else. */
  actorsFor(type: ActionType): Actor[];
  /** Applies the system transitions for every day from `from` (exclusive) to `to` (inclusive). */
  advanceClock(cases: EventCase[], from: ISODate, to: ISODate, cfg: RulesConfig): EventCase[];

  /* selectors */
  /** No ending and not Closed. */
  isOpen(c: EventCase): boolean;
  /** Drafts are the applicant's alone. */
  isVisibleToCity(c: EventCase): boolean;
  /**
   * The Clerk is involved in every non-draft case; a reviewing department when it is routed or
   * holds a task, and before routing when a card names it as reviewer (it reads "Waiting" in
   * Who's up then). Never true for a Draft and a city role. Same as `involvement() !== 'none'`.
   */
  involves(c: EventCase, role: Party): boolean;
  /** How a party stands to a case: see `Involvement`. */
  involvement(c: EventCase, party: Party): Involvement;
  applicantCases(cases: EventCase[], applicantId: string): EventCase[];
  /**
   * Tasks this role can act on now, across open cases, each with its My queue group. Sorted
   * oldest due first, across the groups as well as within them; a task with no date goes last.
   */
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

  /* active permits */
  /** A permit that is live: Permitted, on Event day or in Closeout, and not cancelled. */
  hasActivePermit(c: EventCase): boolean;
  /** Quote sent and holding its date: what the "holds" toggle on Active permits adds. */
  holdsDateAtQuote(c: EventCase): boolean;
  /**
   * The Active permits list: every live permit, by event date (the next session, or the last
   * one once all have passed), soonest first. `includeHolds` adds the Quote sent cases holding a date.
   */
  activePermits(cases: EventCase[], today: ISODate, options?: { includeHolds?: boolean }): EventCase[];
  /**
   * The Active permits calendar and map: one entry for each date an active permit is held, so a
   * series shows every session (a session skipped for a blackout is not one). In date order.
   * `from` and `to` are inclusive.
   */
  permitSessions(cases: EventCase[], options?: { from?: ISODate; to?: ISODate; includeHolds?: boolean }): PermitSession[];
}
