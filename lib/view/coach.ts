/**
 * Pure view-model for the demo coach: which of the seven demo paths is on screen, and which of
 * its steps is current. Nothing here reads the store; AppShell/CityShell's CoachStrip and the
 * demo guide pass in what they read from it. Covered by lib/view/coach.test.ts.
 *
 * The current step is derived from the case the path is built on (and the current role,
 * persona and demo date), never counted from clicks: `pathProgress()` reads the first step
 * whose outcome has not happened yet, so it is right after a reload, after the presenter
 * improvises, and after Reset. A step with nothing of its own to check (an "open the case and
 * look" step, or the final step of a path) is read as done once the presenter has moved on to
 * the context the next step needs — the role and persona switch the coach's own button makes.
 *
 * Owned by workstream 5E (components/shell, lib/data/demoScript.ts, lib/view/palette.ts).
 */
import { caseTotals } from "@/lib/state";
import { MAIN_PATH, type CaseState, type EventCase, type ISODate, type Party } from "@/lib/types";
import { DEMO_PATHS, SCENARIO_JUMPS, type DemoPath, type DemoStep, type ScenarioKey } from "@/lib/data/demoScript";
import { applicantCaseIdFromHref, caseIdFromPath } from "@/lib/view/shell";
import { routes } from "@/lib/routes";

export interface CoachContext {
  cases: EventCase[];
  role: Party;
  personaId: string;
  today: ISODate;
}

export interface PathProgress {
  path: DemoPath;
  /** 0-based index of the step now current; equals `totalSteps - 1` once every step is done. */
  stepIndex: number;
  totalSteps: number;
  done: boolean;
  /** The step to show now: the current one, or the last one once the path is done. */
  step: DemoStep;
}

function findCase(cases: EventCase[], id: string): EventCase | undefined {
  return cases.find((c) => c.id === id);
}

function caseFor(ctx: CoachContext, scenario: ScenarioKey): EventCase | undefined {
  const jump = SCENARIO_JUMPS.find((j) => j.id === scenario);
  return jump ? findCase(ctx.cases, jump.caseId) : undefined;
}

/** Has this case reached `state`, or one further along the main path (never true past an ending). */
function atLeastState(c: EventCase, state: CaseState): boolean {
  return MAIN_PATH.indexOf(c.state) >= MAIN_PATH.indexOf(state);
}

/** The presenter has switched to this role (and, when given, this persona). */
function roleReached(ctx: CoachContext, role: Party, persona?: string): boolean {
  return ctx.role === role && (!persona || ctx.personaId === persona);
}

function findTask(c: EventCase | undefined, suffix: string) {
  return c?.tasks.find((t) => t.id === `${c.id}:${suffix}`);
}

/**
 * Drafts belonging to `applicantId`, most recently created first. Path 2 (watching the tier
 * move) has no scenario of its own: it is demoed on whichever fresh draft the presenter is
 * filling in as a new applicant, so the latest one is the one on screen.
 */
function draftsFor(cases: EventCase[], applicantId: string): EventCase[] {
  return cases
    .filter((c) => c.applicantId === applicantId && c.state === "draft" && c.ending === null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

/**
 * One boolean per step of the path with this id: has that step's own outcome happened yet.
 * `pathProgress()` takes the first `false` as the current step, so a check does not need to
 * guard on the ones before it.
 */
const PATH_CHECKS: Record<number, (ctx: CoachContext) => boolean[]> = {
  // Instant in two minutes (S2): the wizard reaches its plan step, then the first session is paid.
  1: (ctx) => {
    const c = caseFor(ctx, "S2");
    if (!c) return [false, false, false];
    return [c.wizardStep === "plan" || c.state !== "draft", c.state !== "draft", roleReached(ctx, "clerk")];
  },
  // Watch the tier move: no scenario case, so it reads the latest fresh "new" draft's own
  // fields. Path 5's own last step also drafts as "new" (a City Hall Plaza event for Jul 11),
  // so running path 5 to the end can read back here as progress on path 2 too, in the demo
  // guide's overview only — the coach strip never shows both at once, since it picks the path
  // from the case (or blank wizard) actually on screen. `activeDemoPath` on the store would
  // remove the overlap outright.
  2: (ctx) => {
    const draft = draftsFor(ctx.cases, "new")[0];
    if (!draft) return [false, false, false, false];
    return [
      Boolean(draft.location && draft.attendance != null),
      draft.tier !== "instant",
      draft.tier === "special",
      draft.triggers.some((t) => t.id === "attendance_1000"),
    ];
  },
  // Answer a request (S3): the health permit card, Health & Legal's decision, the quote, the
  // applicant's payment, and the issued permit.
  3: (ctx) => {
    const c = caseFor(ctx, "S3");
    if (!c) return [false, false, false, false, false];
    const card = findTask(c, "vendor_health_permit:1");
    const hl = c.reviews.find((r) => r.dept === "hl");
    return [
      Boolean(card && card.status !== "todo" && card.status !== "locked"),
      Boolean(hl?.decidedOn),
      atLeastState(c, "quote_sent"),
      c.flags.signed && caseTotals(c).due === 0,
      atLeastState(c, "permitted"),
    ];
  },
  // Neighbors and the date hold (S4): every sign-off in, the Clerk routes the case, Public
  // Works & Safety picks it up.
  4: (ctx) => {
    const c = caseFor(ctx, "S4");
    if (!c) return [false, false, false];
    return [findTask(c, "neighbor_signoff")?.status === "done", atLeastState(c, "in_review"), roleReached(ctx, "pws")];
  },
  // Two parties up at once (S5): Health & Legal verifies, the applicant signs and pays, the
  // Clerk issues, then a new draft shows the Impacted warning.
  5: (ctx) => {
    const c = caseFor(ctx, "S5");
    if (!c) return [false, false, false, false, false];
    return [
      roleReached(ctx, "hl"),
      findTask(c, "insurance_certificate")?.status === "done",
      c.flags.signed && caseTotals(c).due === 0,
      atLeastState(c, "permitted"),
      // A fresh City Hall Plaza draft for Jul 11, not just "the role is back to a new applicant"
      // (reset() alone lands there too).
      draftsFor(ctx.cases, "new").some((d) => d.schedule?.date === "2027-07-11"),
    ];
  },
  // Closeout (S6): hours logged, reconciled and closed, then the applicant sees the board.
  6: (ctx) => {
    const c = caseFor(ctx, "S6");
    if (!c) return [false, false, false];
    return [c.closeout.hoursLoggedOn !== null, atLeastState(c, "closed"), roleReached(ctx, "applicant", "main-street-business-alliance")];
  },
  // Amend up a tier (S1, P1): `amend` applies the tier change, the late fee and the new cards
  // in one transition, so these three become true together — the engine keeps no state between
  // them for the coach to read, and a P1 path is not worth a contract change for it.
  7: (ctx) => {
    const c = caseFor(ctx, "S1");
    if (!c) return [false, false, false];
    return [c.flags.lateFee, c.flags.amendmentPending, c.tasks.some((t) => t.tags.includes("amendment"))];
  },
};

/**
 * A step with nothing of its own to check (reading `roleReached()` alone) would otherwise
 * un-advance the moment the presenter moves on to a later role: once any later step's own
 * outcome has happened, every step before it reads done too, which is what lets a narrative
 * "open the case and look" step (and a path's last, narrative step) stay behind the presenter
 * instead of flapping back to current.
 */
function carryForward(raw: boolean[]): boolean[] {
  const out = raw.slice();
  for (let i = out.length - 2; i >= 0; i--) out[i] = out[i] || out[i + 1];
  return out;
}

/** Which step of `path` is current, and whether every step's outcome has happened. */
export function pathProgress(path: DemoPath, ctx: CoachContext): PathProgress {
  const raw = PATH_CHECKS[path.id]?.(ctx) ?? path.steps.map(() => false);
  const checks = carryForward(raw);
  const firstFalse = checks.findIndex((done) => !done);
  const done = firstFalse === -1;
  const stepIndex = done ? path.steps.length - 1 : firstFalse;
  return { path, stepIndex, totalSteps: path.steps.length, done, step: path.steps[stepIndex] };
}

/** Every demo path's progress, in path order. */
export function allPathProgress(ctx: CoachContext): PathProgress[] {
  return DEMO_PATHS.map((path) => pathProgress(path, ctx));
}

/**
 * Which demo path is "on screen", read from the case on screen (S3 on screen means path 3; a
 * blank wizard means path 2). There is no store field for which path the presenter picked yet
 * (an engine request: `activeDemoPath` on `DemoState`); until it lands, this is the fallback.
 */
export function activeDemoPathId(pathname: string, search = ""): number | null {
  const query = search.replace(/^\?/, "");
  const href = query ? `${pathname}?${query}` : pathname;
  const caseId = applicantCaseIdFromHref(href) ?? caseIdFromPath(pathname, "clerk");
  if (caseId) {
    const path = DEMO_PATHS.find((p) => SCENARIO_JUMPS.find((j) => j.id === p.scenario)?.caseId === caseId);
    return path?.id ?? null;
  }
  const bare = pathname.split("?")[0];
  return bare === routes.apply() ? 2 : null;
}
