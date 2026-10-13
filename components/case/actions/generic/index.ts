/**
 * Default, generic panel for every action a city role can take (plan 8, workstream 3F): a
 * small, complete form that dispatches the action and shows the engine's reason if refused.
 * A later phase (4A to 4D) replaces some of these with richer tools, registered as overrides
 * in ../clerk.tsx, ../pws.tsx and ../hl.tsx; the registry falls back to this map.
 */
import type { ActionType } from "@/lib/state/actions";
import type { ActionPanelComponent } from "../types";
import { AcceptCompletePanel } from "./AcceptComplete";
import { AddNotePanel } from "./AddNote";
import { CompleteCityTaskPanel } from "./CompleteCityTask";
import { ConfirmRoutingPanel } from "./ConfirmRouting";
import { DenyPanel } from "./Deny";
import { IssuePermitPanel } from "./IssuePermit";
import { LogCloseoutPanel } from "./LogCloseout";
import { PayPanel } from "./Pay";
import { ReconcileClosePanel } from "./ReconcileClose";
import { RejectDocumentPanel } from "./RejectDocument";
import { RemindPanel } from "./Remind";
import { RequestInfoPanel } from "./RequestInfo";
import { ReviewDecidePanel } from "./ReviewDecide";
import { ScheduleMeetingPanel } from "./ScheduleMeeting";
import { SendQuotePanel } from "./SendQuote";
import { SendToCommissionPanel } from "./SendToCommission";
import { VerifyDocumentPanel } from "./VerifyDocument";

export const GENERIC_PANELS: Partial<Record<ActionType, ActionPanelComponent>> = {
  accept_complete: AcceptCompletePanel,
  confirm_routing: ConfirmRoutingPanel,
  request_info: RequestInfoPanel,
  verify_document: VerifyDocumentPanel,
  reject_document: RejectDocumentPanel,
  review_decide: ReviewDecidePanel,
  send_to_commission: SendToCommissionPanel,
  send_quote: SendQuotePanel,
  deny: DenyPanel,
  pay: PayPanel,
  issue_permit: IssuePermitPanel,
  schedule_meeting: ScheduleMeetingPanel,
  complete_city_task: CompleteCityTaskPanel,
  log_closeout: LogCloseoutPanel,
  reconcile_close: ReconcileClosePanel,
  add_note: AddNotePanel,
  remind: RemindPanel,
};
