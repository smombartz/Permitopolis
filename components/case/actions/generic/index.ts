/**
 * The panel for every action a city role can take: each dispatches its action and shows the
 * engine's reason when it would be refused, before the click. Phase 3 shipped these as small
 * forms; Phase 4 built the role tools in place, in these same files (4A the Clerk's: request
 * information, routing, the quote builder, record payment, issue permit, reconcile; 4C the
 * reviewer's: the review panel, the closeout log, work orders and meetings; 4D verification,
 * with Send back folded into Verify). ../clerk.tsx, ../pws.tsx and ../hl.tsx stay empty: a
 * role gets an override there only for a panel no other role shares.
 */
import type { ActionType } from "@/lib/state/actions";
import type { ActionPanelComponent } from "../types";
import { AcceptCompletePanel } from "./AcceptComplete";
import { AddNotePanel } from "./AddNote";
import { CompleteCityTaskPanel } from "./CompleteCityTask";
import { ConfirmRoutingPanel } from "./ConfirmRouting";
import { DecideAmendmentPanel } from "./DecideAmendment";
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
  // Phase 5: the Clerk's decision on an amendment the applicant has submitted.
  decide_amendment: DecideAmendmentPanel,
  add_note: AddNotePanel,
  remind: RemindPanel,
};
