/**
 * The action-panel registry (plan 8, workstream 3F): every action a city role can take maps to
 * one panel. A role's own override file wins when it has one; otherwise the panel from
 * ./generic runs. Phase 4 built the role tools (the quote builder, the review panel, document
 * verification, the closeout) in ./generic itself, because each is shared: the review panel
 * serves both departments and the Clerk's license review, and a card is verified by whichever
 * department reviews it. So the three override maps are empty, and stay as the place for a
 * panel that really is one role's alone.
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

/**
 * Panels that lay two things side by side or carry a table: each department's decision beside
 * the others and the quote's lines, a review's material and fee lines, a document's preview
 * beside its checklist, the estimate against the actual. The sheet opens wider for these.
 */
const WIDE_PANELS: ReadonlySet<ActionType> = new Set<ActionType>(["send_quote", "review_decide", "verify_document", "reject_document", "reconcile_close"]);

export type PanelWidth = "default" | "wide";

export function panelWidthFor(action: ActionType): PanelWidth {
  return WIDE_PANELS.has(action) ? "wide" : "default";
}
