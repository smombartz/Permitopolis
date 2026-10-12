/**
 * The one dispatcher behind transition(). A case with an ending accepts no action except
 * add_note; every other guard lives next to its handler in ./checks and ./transitions/*.
 */
import type { RulesCtx } from "@/lib/rules/types";
import type { Actor, EventCase } from "@/lib/types";
import type { Action } from "./actions";
import {
  acceptAndSign,
  amend,
  bookAgain,
  bookAndPay,
  cancel,
  completeTask,
  createBoard,
  respondToRequest,
  simulateSignoff,
  submit,
  submitFeedback,
  withdraw,
} from "./transitions/applicant";
import { acceptComplete, confirmRouting, deny, issuePermit, reconcileClose, sendQuote } from "./transitions/clerk";
import {
  addNote,
  completeCityTask,
  logCloseout,
  remind,
  requestInfo,
  reviewDecide,
  rejectDocument,
  scheduleMeeting,
  sendToCommission,
  verifyDocument,
} from "./transitions/city";
import { pay } from "./transitions/payment";
import { applyTick } from "./clock";
import type { StateApi } from "./types";

export const transition: StateApi["transition"] = (c: EventCase, action: Action, actor: Actor, ctx: RulesCtx) => {
  if (c.ending && action.type !== "add_note") {
    return { ok: false, reason: `This case is ${c.ending.replace("_", " ")}.` };
  }

  switch (action.type) {
    case "create_board":
      return createBoard(c, action, actor, ctx);
    case "book_and_pay":
      return bookAndPay(c, action, actor, ctx);
    case "complete_task":
      return completeTask(c, action, actor, ctx);
    case "simulate_signoff":
      return simulateSignoff(c, action, actor, ctx);
    case "submit":
      return submit(c, action, actor, ctx);
    case "respond_to_request":
      return respondToRequest(c, action, actor, ctx);
    case "accept_and_sign":
      return acceptAndSign(c, action, actor, ctx);
    case "pay":
      return pay(c, action, actor, ctx);
    case "withdraw":
      return withdraw(c, action, actor, ctx);
    case "cancel":
      return cancel(c, action, actor, ctx);
    case "submit_feedback":
      return submitFeedback(c, action, actor, ctx);
    case "book_again":
      return bookAgain(c, action, actor, ctx);
    case "amend":
      return amend(c, action, actor, ctx);
    case "accept_complete":
      return acceptComplete(c, action, actor, ctx);
    case "confirm_routing":
      return confirmRouting(c, action, actor, ctx);
    case "send_to_commission":
      return sendToCommission(c, action, actor, ctx);
    case "send_quote":
      return sendQuote(c, action, actor, ctx);
    case "deny":
      return deny(c, action, actor, ctx);
    case "issue_permit":
      return issuePermit(c, action, actor, ctx);
    case "reconcile_close":
      return reconcileClose(c, action, actor, ctx);
    case "request_info":
      return requestInfo(c, action, actor, ctx);
    case "verify_document":
      return verifyDocument(c, action, actor, ctx);
    case "reject_document":
      return rejectDocument(c, action, actor, ctx);
    case "review_decide":
      return reviewDecide(c, action, actor, ctx);
    case "schedule_meeting":
      return scheduleMeeting(c, action, actor, ctx);
    case "complete_city_task":
      return completeCityTask(c, action, actor, ctx);
    case "log_closeout":
      return logCloseout(c, action, actor, ctx);
    case "add_note":
      return addNote(c, action, actor, ctx);
    case "remind":
      return remind(c, action, actor, ctx);
    case "tick":
      return applyTick(c, ctx);
    default:
      return { ok: false, reason: `Unknown action.` };
  }
};
