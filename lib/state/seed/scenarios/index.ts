/** The 13 PRD cases: six scenarios (S1-S6) and seven fillers (F1-F7), in that order. */
import type { SeedScript } from "../../types";
import { S1 } from "./s1";
import { S2 } from "./s2";
import { S3 } from "./s3";
import { S4 } from "./s4";
import { S5 } from "./s5";
import { S6 } from "./s6";
import { F1 } from "./f1";
import { F2 } from "./f2";
import { F3 } from "./f3";
import { F4 } from "./f4";
import { F5 } from "./f5";
import { F6 } from "./f6";
import { F7 } from "./f7";

export const SCENARIO_SCRIPTS: SeedScript[] = [S1, S2, S3, S4, S5, S6, F1, F2, F3, F4, F5, F6, F7];

export { S1, S2, S3, S4, S5, S6, F1, F2, F3, F4, F5, F6, F7 };
