/**
 * Public Works & Safety's own richer action panels, overriding the generic ones by action
 * type. Owned by workstream 4C; empty for now, so the registry falls back to ../generic.
 */
import type { ActionType } from "@/lib/state/actions";
import type { ActionPanelComponent } from "./types";

export const PWS_OVERRIDES: Partial<Record<ActionType, ActionPanelComponent>> = {};
