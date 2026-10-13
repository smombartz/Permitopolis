/**
 * Low-level helpers shared by every transition handler. Nothing here is part of
 * StateApi; it is implementation detail for lib/state/transitions/*.
 */
import { classify, dueDate as dueDateRule, estimateFees } from "@/lib/rules";
import { CARD_BY_ID, type CardSpec, type CatalogId } from "@/lib/rules/catalog";
import { round2 } from "@/lib/rules/shared";
import type { RulesConfig, RulesCtx } from "@/lib/rules/types";
import type {
  Actor,
  DateHold,
  Dept,
  EventCase,
  ISODate,
  ISODateTime,
  Party,
  Task,
  TaskKind,
  TaskPayload,
  TaskPhase,
  TaskStatus,
  UnlockEvent,
} from "@/lib/types";

/** `${caseId}:${catalogId}`, plus `:${n}` for a repeated (per-vendor) card. */
export function taskId(caseId: string, catalogId: string, n?: number): string {
  return n === undefined ? `${caseId}:${catalogId}` : `${caseId}:${catalogId}:${n}`;
}

/** The part of a task id after `${caseId}:`, e.g. `vendor_health_permit:1`. */
export function idSuffix(c: EventCase, id: string): string {
  return id.slice(c.id.length + 1);
}

export function cloneCase(c: EventCase): EventCase {
  return structuredClone(c);
}

/**
 * The dates this case actually takes place on: every session except the ones a series skips
 * for a blackout. Falls back to the schedule's own date when no session is listed (or every
 * one is skipped), so a case with a schedule always has at least one date.
 */
export function heldSessionDates(c: EventCase): ISODate[] {
  if (!c.schedule) return [];
  const held = c.schedule.occurrences.filter((o) => o.billing !== "skipped").map((o) => o.date);
  return held.length > 0 ? held : [c.schedule.date];
}

/**
 * When a task is due. A reviewer's open request carries its own, sooner date ("due Wed,
 * May 5"), which wins over the card's own date for as long as the request is open.
 */
export function taskDueDate(task: Task): ISODate | null {
  return task.request && !task.request.resolved ? task.request.dueDate : task.dueDate;
}

/**
 * The day a card last went to the city: its most recent move to `submitted`, from its own
 * history. Null if it never has. The applicant's "N days with ..." and the city's "waiting N
 * days" both count from here.
 */
export function taskSubmittedOn(task: Task): ISODate | null {
  for (let i = task.history.length - 1; i >= 0; i--) {
    if (task.history[i].status === "submitted") return task.history[i].at.slice(0, 10) as ISODate;
  }
  return null;
}

/**
 * Sort order for tasks: oldest due first, by the date that applies now (see taskDueDate). A
 * task with no due date goes last; ties keep the order they had, which is the order of creation.
 */
export function byDueDate(a: Task, b: Task): number {
  const dueA = taskDueDate(a);
  const dueB = taskDueDate(b);
  if (dueA === dueB) return 0;
  if (dueA === null) return 1;
  if (dueB === null) return -1;
  return dueA < dueB ? -1 : 1;
}

/** A held date given up: the case ended, or the event is over and closed. Any other hold is left as it is. */
export function releaseHold(hold: DateHold): DateHold {
  return hold.status === "held" ? { ...hold, status: "released" } : hold;
}

/** `ctx.now`, defaulting to 9am on `ctx.today`. transition() never reads the real clock. */
export function nowOf(ctx: RulesCtx): ISODateTime {
  return ctx.now ?? `${ctx.today}T09:00`;
}

export function appendActivity(c: EventCase, actor: Actor, text: string, ctx: RulesCtx): EventCase {
  return { ...c, activity: [...c.activity, { at: nowOf(ctx), actor, text }] };
}

export function findTask(c: EventCase, id: string): Task | undefined {
  return c.tasks.find((t) => t.id === id);
}

function catalogSpecFor(catalogId: string): CardSpec | undefined {
  return (CARD_BY_ID as Record<string, CardSpec>)[catalogId];
}

/** Patches fields on one task without touching history (payload-only edits). */
export function patchTask(c: EventCase, id: string, patch: Partial<Task>): EventCase {
  return { ...c, tasks: c.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
}

/** Moves a task to a new status, appending the history entry the status change needs. */
export function moveTask(
  c: EventCase,
  id: string,
  status: TaskStatus,
  ctx: RulesCtx,
  actor: Actor,
  extra: Partial<Task> = {},
  note?: string,
): EventCase {
  return {
    ...c,
    tasks: c.tasks.map((t) =>
      t.id === id
        ? { ...t, ...extra, status, history: [...t.history, { at: nowOf(ctx), actor, status, note }] }
        : t,
    ),
  };
}

export function addTask(c: EventCase, task: Task): EventCase {
  return { ...c, tasks: [...c.tasks, task] };
}

export function addTasks(c: EventCase, tasks: Task[]): EventCase {
  return { ...c, tasks: [...c.tasks, ...tasks] };
}

export interface NewTaskArgs {
  id: string;
  catalogId: string;
  owner: Party;
  kind: TaskKind;
  title: string;
  why?: string;
  reviewer?: Dept | null;
  dueDate?: ISODate | null;
  status?: TaskStatus;
  unlocksOn?: UnlockEvent | null;
  phase?: TaskPhase;
  payload?: TaskPayload;
}

/** Builds one task with the defaults the rest of the engine relies on (payload, history, tags). */
export function newTask(args: NewTaskArgs, ctx: RulesCtx, actor: Actor): Task {
  const status = args.status ?? "todo";
  return {
    id: args.id,
    catalogId: args.catalogId,
    owner: args.owner,
    kind: args.kind,
    title: args.title,
    why: args.why ?? "",
    reviewer: args.reviewer ?? null,
    dueDate: args.dueDate ?? null,
    status,
    unlocksOn: args.unlocksOn ?? null,
    phase: args.phase ?? "review",
    payload: args.payload ?? {},
    history: [{ at: nowOf(ctx), actor, status }],
    tags: [],
  };
}

/**
 * Flips every locked task with `unlocksOn === event` to "todo", recording it in task.history,
 * and sets the due date for due rules `after_unlock` and `hold_expiry`. A no-op when nothing
 * matches.
 */
export function applyUnlockEvent(c: EventCase, event: UnlockEvent, ctx: RulesCtx): EventCase {
  let changed = false;
  const tasks = c.tasks.map((t) => {
    if (t.status !== "locked" || t.unlocksOn !== event) return t;
    changed = true;
    const spec = catalogSpecFor(t.catalogId);
    let dueDate = t.dueDate;
    if (t.payload.scheduledFor) {
      // A meeting scheduled while its card was still locked keeps the day it was set for.
      dueDate = t.payload.scheduledFor;
    } else if (spec?.due.type === "after_unlock") {
      dueDate = dueDateRule(ctx.today, ctx.cfg.sla[spec.due.sla] as number, ctx.cfg);
    } else if (spec?.due.type === "hold_expiry") {
      dueDate = c.dateHold.expiresOn;
    } else if (spec?.due.type === "event_day" && event === "event_day") {
      // A series opens "Carry your permit" again for each session: it is for today's.
      dueDate = ctx.today;
    }
    return {
      ...t,
      status: "todo" as const,
      unlocksOn: null,
      dueDate,
      history: [...t.history, { at: nowOf(ctx), actor: "system" as const, status: "todo" as const }],
    };
  });
  return changed ? { ...c, tasks } : c;
}

/**
 * While a department waits on the applicant's answer, its own open review (or the Clerk's
 * intake check) cannot move, so it is parked: 'locked', out of the queue and out of "Up now".
 * The PRD's transitions table has the asker get its task back when the applicant responds.
 */
export function parkTasksAwaitingAnswer(c: EventCase, dept: Dept, ctx: RulesCtx): EventCase {
  return {
    ...c,
    tasks: c.tasks.map((t) => {
      const parkable = t.owner === dept && t.kind === "review" && !t.catalogId.startsWith("verify:");
      if (!parkable || (t.status !== "todo" && t.status !== "changes_requested")) return t;
      return {
        ...t,
        status: "locked" as const,
        payload: { ...t.payload, awaitingAnswer: true },
        history: [...t.history, { at: nowOf(ctx), actor: "system" as const, status: "locked" as const, note: "Waiting on the applicant's response" }],
      };
    }),
  };
}

/** The reverse of parkTasksAwaitingAnswer(), once the department has no request left open. */
export function resumeTasksAwaitingAnswer(c: EventCase, dept: Dept, ctx: RulesCtx): EventCase {
  if (c.tasks.some((t) => t.request && !t.request.resolved && t.request.from === dept)) return c;
  return {
    ...c,
    tasks: c.tasks.map((t) => {
      if (t.owner !== dept || t.status !== "locked" || t.payload.awaitingAnswer !== true) return t;
      return {
        ...t,
        status: "todo" as const,
        payload: { ...t.payload, awaitingAnswer: false },
        history: [...t.history, { at: nowOf(ctx), actor: "system" as const, status: "todo" as const, note: "The applicant responded" }],
      };
    }),
  };
}

export function isCatalogId(id: string): id is CatalogId {
  return id in CARD_BY_ID;
}

/** Every card that has to be in before Submit application is 'submitted' or 'done'. */
export function preSubmitCardsIn(c: EventCase): boolean {
  return c.tasks.filter((t) => catalogSpecFor(t.catalogId)?.preSubmit).every((t) => t.status === "submitted" || t.status === "done");
}

/** Neighbor sign-offs a block party still needs; 0 when it has them all or needs none. */
export function signoffsLeft(c: EventCase): number {
  const signoff = findTask(c, taskId(c.id, "neighbor_signoff"));
  if (!signoff || signoff.status === "done") return 0;
  const progress = signoff.payload.progress;
  return progress ? Math.max(0, progress.total - progress.done) : 0;
}

/** Every open (actionable) task owned by this party, optionally narrowed further. */
export function openTasksFor(c: EventCase, owner: Party, extra?: (t: Task) => boolean): Task[] {
  return c.tasks.filter(
    (t) => t.owner === owner && (t.status === "todo" || t.status === "changes_requested") && (!extra || extra(t)),
  );
}

export function hasOpenReviewTask(c: EventCase, dept: Dept): boolean {
  return c.tasks.some(
    (t) => t.owner === dept && t.kind === "review" && (t.status === "todo" || t.status === "changes_requested"),
  );
}

export function reviewFor(c: EventCase, dept: Dept) {
  return c.reviews.find((r) => r.dept === dept);
}

/**
 * What a fee line comes to. Money is kept to the cent everywhere: 3.1 miles at $400 is
 * 1240.0000000000002 in floating point, and a sum of cent amounts drifts the same way, so every
 * product and every total is rounded before it is stored or compared.
 */
export function lineAmount(qty: number, unitPrice: number): number {
  return round2(qty * unitPrice);
}

/** Sum of fee-line estimates (or actuals once closeout has filled them in), by kind. */
export function sumFeeLines(c: EventCase, kinds: Array<"fee" | "deposit" | "late_fee">): number {
  return round2(c.feeLines.filter((f) => kinds.includes(f.kind)).reduce((s, f) => s + (f.actual ?? f.estimate), 0));
}

export function totalPaid(c: EventCase): number {
  return round2(c.payments.reduce((s, p) => s + p.amount, 0));
}

export function caseTotal(c: EventCase): number {
  return sumFeeLines(c, ["fee", "late_fee", "deposit"]);
}

/**
 * What the quote asks for now. A single event pays everything on it. A series pays its one-off
 * lines (application fee, permits, inspections, deposit, late fee) and its first session; the
 * later sessions are billed on schedule (PRD, the quote: "A series shows the first session now
 * and the rest on schedule"). The later sessions are taken off at the fee schedule's own
 * per-session price, so lines a reviewer or the Clerk added stay due now.
 */
export function dueAtQuote(c: EventCase, cfg: RulesConfig): number {
  const total = caseTotal(c);
  if (!c.schedule?.recurrence) return total;
  const estimate = estimateFees(c, classify(c, cfg), cfg);
  const laterSessions = Math.max(0, (estimate.sessions ?? 1) - 1);
  return Math.max(0, round2(total - laterSessions * (estimate.perSession ?? 0)));
}

/** What is still owed on the quote, to the cent. Zero or less once it is covered. */
export function quoteBalance(c: EventCase, cfg: RulesConfig): number {
  return round2(dueAtQuote(c, cfg) - totalPaid(c));
}

/** The applicant has paid what the quote asks for now. Issue permit and the date hold both turn on it. */
export function quotePaid(c: EventCase, cfg: RulesConfig): boolean {
  return quoteBalance(c, cfg) <= 0;
}
