/**
 * Every seed script, in id order. Workstream 2A replays each one through the real engine to
 * build the 38-case seed. See docs/plans/2026-10-12-permitopolis-prototype.md section 3.3 and
 * 6.2 for the contract this satisfies.
 */
import type { SeedScript } from "../types";
import { SCENARIO_SCRIPTS } from "./scenarios";
import { BACKGROUND_SCRIPTS } from "./background";

export const SEED_SCRIPTS: SeedScript[] = [...SCENARIO_SCRIPTS, ...BACKGROUND_SCRIPTS].sort((a, b) =>
  a.id.localeCompare(b.id),
);
