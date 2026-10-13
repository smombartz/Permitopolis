/**
 * Seed by replay. Every seeded case is a script (answers plus dated actions) run through the
 * real engine, so no seeded case can disagree with the rules: a Draft from the answers at
 * `createdAt`, then each step through transition() at its own time.
 *
 * The scripts are replayed together, in time order, never case by case. A case's availability
 * depends on what the others hold on that day ("the first complete application wins"), so
 * replaying one script to the end before starting the next would let a later application take
 * a date an earlier one was about to hold. Between steps the clock advances for every case
 * (hold expiry, Event day, Closeout), and at the end it runs on to `until`.
 */
import { dateOf } from "@/lib/dates";
import { DEFAULT_CONFIG, DEFAULT_DEMO_TODAY } from "@/lib/rules";
import type { RulesConfig } from "@/lib/rules/types";
import type { EventCase, ISODate, ISODateTime } from "@/lib/types";
import { advanceClock } from "../clock";
import { newCase, syncDraft } from "../newCase";
import { transition } from "../transition";
import type { SeedScript, SeedStep } from "../types";

export interface ReplayOptions {
  /** Replay up to and including this day; later steps are left out. Defaults to the demo date. */
  until?: ISODate;
  cfg?: RulesConfig;
}

/** A step the engine refused. The seed is wrong, or the engine is: either way it must not load. */
export class SeedReplayError extends Error {
  constructor(
    readonly scriptKey: string,
    readonly caseId: string,
    /** 1-based position in the script's steps. */
    readonly stepNumber: number,
    readonly step: SeedStep,
    readonly reason: string,
  ) {
    super(
      `Seed script ${scriptKey} (${caseId}): step ${stepNumber}, ${step.action.type} by ${step.actor} at ${step.at}, was refused: ${reason}`,
    );
    this.name = "SeedReplayError";
  }
}

interface ReplayEvent {
  at: ISODateTime;
  /** Position in the input, which settles two events at the same minute. */
  order: number;
  run(cases: EventCase[], today: ISODate): EventCase[];
}

function eventsOf(scripts: SeedScript[], cfg: RulesConfig): ReplayEvent[] {
  const events: ReplayEvent[] = [];
  for (const script of scripts) {
    events.push({
      at: script.createdAt,
      order: events.length,
      run: (cases, today) => {
        const blank = newCase({ id: script.id, applicantId: script.applicantId, createdAt: script.createdAt, answers: script.answers, wizardStep: script.wizardStep });
        // As the store's createDraft does: the sessions, tier and triggers come from the rules.
        return [...cases, syncDraft(blank, { today, now: script.createdAt, cases, cfg })];
      },
    });
    script.steps.forEach((step, i) => {
      events.push({
        at: step.at,
        order: events.length,
        run: (cases, today) => {
          const index = cases.findIndex((c) => c.id === script.id);
          const result = transition(cases[index], step.action, step.actor, { today, now: step.at, cases, cfg });
          if (!result.ok) throw new SeedReplayError(script.key, script.id, i + 1, step, result.reason);
          return [...cases.slice(0, index), result.case, ...cases.slice(index + 1), ...(result.spawned ?? [])];
        },
      });
    });
  }
  return events;
}

/**
 * Replays the scripts and returns the cases as they stand on `until`, in case-id order.
 * Throws a SeedReplayError naming the script, the step and the engine's reason when a step is
 * refused.
 */
export function replayScripts(scripts: SeedScript[], options: ReplayOptions = {}): EventCase[] {
  const cfg = options.cfg ?? DEFAULT_CONFIG;
  const until = options.until ?? DEFAULT_DEMO_TODAY;

  const due = eventsOf(scripts, cfg).filter((event) => dateOf(event.at) <= until);
  due.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.order - b.order));

  let cases: EventCase[] = [];
  let clock = due.length > 0 ? dateOf(due[0].at) : until;
  for (const event of due) {
    const day = dateOf(event.at);
    if (day > clock) {
      cases = advanceClock(cases, clock, day, cfg);
      clock = day;
    }
    cases = event.run(cases, day);
  }
  if (until > clock) cases = advanceClock(cases, clock, until, cfg);

  // A Draft nobody has touched since it was started still shows today's availability: other
  // cases have taken and released dates in the meantime. This is what the wizard's next
  // autosave would do. Sessions come from occurrences(), never from a list written here.
  cases = cases.map((c) => (c.state === "draft" ? syncDraft(c, { today: until, cases, cfg }) : c));

  return [...cases].sort((a, b) => a.id.localeCompare(b.id));
}
