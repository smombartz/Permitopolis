/**
 * Test-only replay of seed scripts through the two real engines, the way the plan describes
 * the seed: a Draft from the answers at `createdAt`, then every step through transition() at
 * its own time, with advanceClock() run between days. Scripts are replayed together, in time
 * order, so a case sees the dates the others already hold.
 *
 * Workstream 2A owns the real one (lib/state/seed/replay.ts and buildSeed()); this exists so
 * engine tests can start from a seeded case before then. Not a test file itself.
 */
import { DEFAULT_CONFIG, DEFAULT_DEMO_TODAY } from "@/lib/rules";
import { advanceClock, newCase, syncDraft, transition, type SeedScript } from "@/lib/state";
import type { EventCase, ISODate } from "@/lib/types";

export interface Replay {
  cases: EventCase[];
  /** Steps the engine refused, as "S4 submit at 2027-04-13T09:00: <reason>". Empty for a sound seed. */
  refused: string[];
}

/** Replays the scripts up to and including `until`; later steps are left out. */
export function replay(scripts: SeedScript[], until: ISODate = DEFAULT_DEMO_TODAY): Replay {
  const cfg = DEFAULT_CONFIG;
  const refused: string[] = [];
  type Event = { at: string; order: number; run: (cases: EventCase[], today: ISODate) => EventCase[] };
  const events: Event[] = [];

  for (const script of scripts) {
    events.push({
      at: script.createdAt,
      order: events.length,
      run: (cases, today) => {
        const blank = newCase({ id: script.id, applicantId: script.applicantId, createdAt: script.createdAt, answers: script.answers, wizardStep: script.wizardStep });
        return [...cases, syncDraft(blank, { today, cases, cfg })];
      },
    });
    for (const step of script.steps) {
      events.push({
        at: step.at,
        order: events.length,
        run: (cases, today) => {
          const index = cases.findIndex((c) => c.id === script.id);
          const result = transition(cases[index], step.action, step.actor, { today, now: step.at, cases, cfg });
          if (!result.ok) {
            refused.push(`${script.key} ${step.action.type} at ${step.at}: ${result.reason}`);
            return cases;
          }
          return [...cases.slice(0, index), result.case, ...cases.slice(index + 1), ...(result.spawned ?? [])];
        },
      });
    }
  }

  const due = events.filter((event) => event.at.slice(0, 10) <= until);
  due.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.order - b.order));

  let cases: EventCase[] = [];
  let clock = due[0]?.at.slice(0, 10) ?? until;
  for (const event of due) {
    const day = event.at.slice(0, 10);
    if (day > clock) {
      cases = advanceClock(cases, clock, day, cfg);
      clock = day;
    }
    cases = event.run(cases, day);
  }
  if (until > clock) cases = advanceClock(cases, clock, until, cfg);
  return { cases, refused };
}
