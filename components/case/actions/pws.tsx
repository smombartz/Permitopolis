/**
 * Public Works & Safety's own action panels, overriding the shared ones by action type. Empty: Phase 4
 * built every role tool as a shared panel in ./generic (see ./generic/index.ts), so the
 * registry falls back to that map. Add a key here only for a panel this role alone uses.
 */
import type { ActionType } from "@/lib/state/actions";
import type { ActionPanelComponent } from "./types";

export const PWS_OVERRIDES: Partial<Record<ActionType, ActionPanelComponent>> = {};
