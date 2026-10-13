/**
 * The seed: all 38 cases as they stand on the demo date (Mon, May 3, 2027), built by replaying
 * the scripts in ./scripts through the real engine. Nothing in a seeded case is written by hand.
 */
import type { EventCase } from "@/lib/types";
import { replayScripts } from "./replay";
import { SEED_SCRIPTS } from "./scripts";

let computed: EventCase[] | null = null;

/**
 * The replay runs once; every call hands out its own deep copy. The store calls this for its
 * first state and again on reset(), so a reset is exact (nothing a path changed can leak into
 * it) and costs a copy, not a replay.
 */
export function buildSeed(): EventCase[] {
  computed ??= replayScripts(SEED_SCRIPTS);
  return structuredClone(computed);
}

export { replayScripts, SeedReplayError, type ReplayOptions } from "./replay";
export { SEED_SCRIPTS } from "./scripts";
