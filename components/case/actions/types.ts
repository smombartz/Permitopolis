import type { ComponentType } from "react";
import type { Party } from "@/lib/types";

export interface ActionPanelProps {
  caseId: string;
  /** The argument after the colon in the open key, when the action needs one (a task id, a dept, a party). */
  arg?: string;
  /** The role currently viewing the case: not every panel acts as this role (review_decide does), but every panel may want to know who is looking. */
  role: Party;
  onClose: () => void;
}

export type ActionPanelComponent = ComponentType<ActionPanelProps>;
