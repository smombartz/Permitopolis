/**
 * The seed: all 38 cases as they stand on the demo date (Mon, May 3, 2027), built by replaying
 * the scripts in ./scripts through the real engine. Nothing in a seeded case is written by hand.
 */
import type { EventCase } from "@/lib/types";
import { replayScripts } from "./replay";
import { SEED_SCRIPTS } from "./scripts";

let computed: EventCase[] | null = null;
let fingerprint: number | null = null;

/** The replay runs once, the first time the seed is asked for. */
function seedOnce(): EventCase[] {
  computed ??= replayScripts(SEED_SCRIPTS);
  return computed;
}

/**
 * Every call hands out its own deep copy. The store calls this for its first state and again
 * on reset(), so a reset is exact (nothing a path changed can leak into it) and costs a copy,
 * not a replay.
 */
export function buildSeed(): EventCase[] {
  return structuredClone(seedOnce());
}

/**
 * A number that changes whenever the seed does: other scripts, or an engine change that alters
 * a seeded case. The store saves the demo under it, so a demo saved by an earlier build is
 * recognised as made from another seed and dropped. FNV-1a over the seed's JSON.
 */
export function seedFingerprint(): number {
  if (fingerprint === null) {
    const text = JSON.stringify(seedOnce());
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    // Unsigned, and never 0: persist treats the version as a plain number.
    fingerprint = (hash >>> 0) || 1;
  }
  return fingerprint;
}

export { replayScripts, SeedReplayError, type ReplayOptions } from "./replay";
export { SEED_SCRIPTS } from "./scripts";
