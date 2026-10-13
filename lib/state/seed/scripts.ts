/**
 * Every seed script, in id order: the 13 PRD cases and the 25 background cases. buildSeed()
 * (./index.ts) replays them through the real engine to make the 38-case seed. The contract they
 * satisfy is the PRD's "Seed data" and "Filler cases" tables and sections 3.3 and 6.2 of
 * docs/plans/2026-10-12-permitopolis-prototype.md; tests/seed.test.ts holds the seed to it.
 */
import type { SeedScript } from "../types";
import { SCENARIO_SCRIPTS } from "./scenarios";
import { BACKGROUND_SCRIPTS } from "./background";

export const SEED_SCRIPTS: SeedScript[] = [...SCENARIO_SCRIPTS, ...BACKGROUND_SCRIPTS].sort((a, b) =>
  a.id.localeCompare(b.id),
);
