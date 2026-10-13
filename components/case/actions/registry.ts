/**
 * The action-panel registry (plan 8, workstream 3F): every action a city role can take maps to
 * a small, complete panel. A role's own override file wins when it has one; otherwise the
 * generic panel from ./generic runs. 4A to 4D fill in richer tools by adding entries to
 * ./clerk.tsx, ./pws.tsx and ./hl.tsx without touching this file or the generic ones.
 */
import type { ActionType } from "@/lib/state/actions";
import type { Party } from "@/lib/types";
import { CLERK_OVERRIDES } from "./clerk";
import { GENERIC_PANELS } from "./generic";
import { HL_OVERRIDES } from "./hl";
import { PWS_OVERRIDES } from "./pws";
import type { ActionPanelComponent } from "./types";

const ROLE_OVERRIDES: Partial<Record<Party, Partial<Record<ActionType, ActionPanelComponent>>>> = {
  clerk: CLERK_OVERRIDES,
  pws: PWS_OVERRIDES,
  hl: HL_OVERRIDES,
};

/** The panel component for this action, as this role would see it. Undefined when nothing is registered. */
export function panelFor(action: ActionType, role: Party): ActionPanelComponent | undefined {
  return ROLE_OVERRIDES[role]?.[action] ?? GENERIC_PANELS[action];
}
