/**
 * The Phase 1 test helper, kept only so anything written against it during the parallel build
 * still runs. The real replay is replayScripts() in lib/state/seed/replay.ts, and the seed
 * itself is buildSeed() from "@/lib/state". Nothing in this repo imports this file any more:
 * delete it once the Phase 2 branches are merged and that is still true.
 *
 * One difference from the Phase 1 version: a refused step now throws (a SeedReplayError naming
 * the script, the step and the reason), so `refused` is always empty.
 */
import { DEFAULT_DEMO_TODAY } from "@/lib/rules";
import type { SeedScript } from "@/lib/state";
import { replayScripts } from "@/lib/state/seed/replay";
import type { EventCase, ISODate } from "@/lib/types";

export interface Replay {
  cases: EventCase[];
  refused: string[];
}

/** @deprecated Use replayScripts(scripts, { until }) or buildSeed(). */
export function replay(scripts: SeedScript[], until: ISODate = DEFAULT_DEMO_TODAY): Replay {
  return { cases: replayScripts(scripts, { until }), refused: [] };
}
