/**
 * "What this role can do to this case now, with a reason for every disabled action." Only
 * actions that make sense for the case's current state are listed at all; among those, each
 * is enabled or disabled using the exact check transition() would run, so the reason always
 * matches what a dispatch would say.
 */
import type { Dept, EventCase, Party } from "@/lib/types";
import type { RulesCtx } from "@/lib/rules/types";
import {
  checkAcceptAndSign,
  checkAcceptComplete,
  checkAmend,
  checkBookAgain,
  checkBookAndPay,
  checkCancel,
  checkConfirmRouting,
  checkCreateBoard,
  checkDeny,
  checkIssuePermit,
  checkLogCloseout,
  checkReconcileClose,
  checkRequestInfo,
  checkReviewDecide,
  checkSendQuote,
  checkSendToCommission,
  checkSubmit,
  checkSubmitFeedback,
  checkWithdraw,
  type CheckResult,
} from "./checks";
import { lastSessionDate } from "./clock";
import { eventDate } from "./selectors";
import type { ActionAvailability, StateApi } from "./types";

function row(type: ActionAvailability["type"], label: string, check: CheckResult, primary = false): ActionAvailability {
  return { type, label, enabled: check.ok, reason: check.ok ? undefined : check.reason, primary };
}

export const availableActions: StateApi["availableActions"] = (c: EventCase, role: Party, ctx: RulesCtx): ActionAvailability[] => {
  if (role === "applicant") return applicantActions(c, ctx);
  if (role === "clerk") return clerkActions(c, ctx);
  return reviewerActions(c, role);
};

function applicantActions(c: EventCase, ctx: RulesCtx): ActionAvailability[] {
  const items: ActionAvailability[] = [];
  if (c.state === "draft") {
    if (c.tier === "instant") {
      items.push(row("book_and_pay", "Pay and book", checkBookAndPay(c, ctx), true));
    } else {
      items.push(row("create_board", "Confirm the plan", checkCreateBoard(c), c.tasks.length === 0));
      items.push(row("submit", "Submit application", checkSubmit(c, ctx), c.tasks.length > 0));
    }
    items.push(row("withdraw", "Withdraw", checkWithdraw(c)));
  } else if (c.state === "submitted" || c.state === "in_review" || c.state === "needs_info") {
    items.push(row("withdraw", "Withdraw", checkWithdraw(c)));
  } else if (c.state === "quote_sent") {
    items.push(row("accept_and_sign", "Accept and sign", checkAcceptAndSign(c), !c.flags.signed));
    items.push({ type: "pay", label: "Pay fees and deposit", enabled: c.state === "quote_sent", primary: c.flags.signed });
    items.push(row("withdraw", "Withdraw", checkWithdraw(c)));
  } else if (c.state === "permitted" || c.state === "event_day") {
    items.push(row("cancel", "Cancel", checkCancel(c, ctx.today, lastSessionDate(c))));
    items.push(row("amend", "Amend", checkAmend(c, ctx.today, eventDate(c, ctx.today))));
  } else if (c.state === "closed") {
    items.push(row("submit_feedback", "Tell us how it went", checkSubmitFeedback(c), !c.closeout.feedback));
    items.push(row("book_again", "Book again next year", checkBookAgain(c)));
  }
  return items;
}

/**
 * A department's own review: decide it, or ask the applicant for something while it is open.
 * The Clerk has one too when the case is routed to it (the alcohol license).
 */
function reviewRows(c: EventCase, dept: Dept): ActionAvailability[] {
  const review = c.reviews.find((r) => r.dept === dept);
  if (!review) return [];
  const items = [row("review_decide", "Decide your review", checkReviewDecide(c, dept), review.status === "pending")];
  if (review.status === "pending" || review.status === "needs_info") items.push(row("request_info", "Request information", checkRequestInfo(c, dept)));
  return items;
}

function clerkActions(c: EventCase, ctx: RulesCtx): ActionAvailability[] {
  const items: ActionAvailability[] = [];
  if (c.state === "submitted") {
    if (!c.flags.acceptedComplete) {
      items.push(row("accept_complete", "Accept as complete", checkAcceptComplete(c, ctx), true));
      items.push(row("request_info", "Request information", checkRequestInfo(c, "clerk")));
      items.push(row("deny", "Deny", checkDeny(c)));
    } else {
      items.push(row("confirm_routing", "Confirm routing", checkConfirmRouting(c), true));
    }
  } else if (c.state === "in_review" || c.state === "needs_info") {
    // The Clerk's own review comes before the quote, which waits for every review anyway.
    const ownReview = c.reviews.find((r) => r.dept === "clerk");
    const ownReviewOpen = ownReview?.status === "pending" || ownReview?.status === "needs_info";
    if (ownReviewOpen) items.push(...reviewRows(c, "clerk"));
    items.push(row("send_quote", "Send quote", checkSendQuote(c), !ownReviewOpen));
    items.push(row("send_to_commission", "Send to commission", checkSendToCommission(c)));
    items.push(row("deny", "Deny", checkDeny(c)));
    items.push(remindRow());
    items.push(addNoteRow());
  } else if (c.state === "quote_sent") {
    items.push(row("issue_permit", "Issue permit", checkIssuePermit(c, ctx), true));
    items.push({ type: "pay", label: "Record an in-person payment", enabled: true });
    items.push(remindRow());
    items.push(addNoteRow());
  } else if (c.state === "closeout") {
    items.push(row("reconcile_close", "Reconcile and close", checkReconcileClose(c), true));
  } else if (c.state === "permitted" || c.state === "event_day") {
    items.push(remindRow());
    items.push(addNoteRow());
  }
  return items;
}

function reviewerActions(c: EventCase, role: "pws" | "hl"): ActionAvailability[] {
  const items: ActionAvailability[] = reviewRows(c, role);
  const review = c.reviews.find((r) => r.dept === role);
  if (role === "pws") {
    const canLogCloseout = checkLogCloseout(c);
    const hasCloseoutTasks = c.state === "closeout" || (c.tier === "instant" && c.state === "event_day");
    if (hasCloseoutTasks) items.push(row("log_closeout", "Log closeout", canLogCloseout, true));
  }
  if (review || c.state !== "draft") {
    items.push(remindRow());
    items.push(addNoteRow());
  }
  return items;
}

function remindRow(): ActionAvailability {
  return { type: "remind", label: "Send a reminder", enabled: true };
}

function addNoteRow(): ActionAvailability {
  return { type: "add_note", label: "Add a note", enabled: true };
}
