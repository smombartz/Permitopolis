/**
 * Every change to a case is one of these actions, applied by transition().
 * FROZEN after Phase 0 (see lib/types.ts).
 */
import type { Dept, EventAnswers, FeeLine, FileRef, ISODate, Party, Payment } from "@/lib/types";

export type ReviewDecision = "approve" | "approve_with_conditions" | "deny";

export interface ConditionDraft {
  dept: Dept;
  text: string;
}

export interface FeeLineDraft {
  dept: Dept;
  label: string;
  qty: number;
  unit: string;
  unitPrice: number;
  kind?: FeeLine["kind"];
}

export interface RoutedReviewer {
  dept: Dept;
  sections: string[];
  dueDate: ISODate;
}

export type Action =
  /* ---- applicant ---- */
  /** Confirms the plan: stores tier and triggers, generates the cards from requirements(). */
  | { type: "create_board" }
  /** Instant only. Draft to Permitted; the date is held on payment and the permit is issued. A series pays its first session. */
  | { type: "book_and_pay"; method: "card" }
  /** Upload, submit a form or finish an action. The card goes to 'submitted' when a reviewer must check it, else 'done'. */
  | { type: "complete_task"; taskId: string; files?: FileRef[]; form?: Record<string, unknown>; note?: string }
  /**
   * Demo only: one more neighbor signs. The sign-off card is done when everyone has. Raised by a
   * neighbor, or by the applicant: the demo button sits on the block captain's own card.
   */
  | { type: "simulate_signoff" }
  /** Draft to Submitted. Needs every pre-submit card done. Creates the Clerk's intake task. */
  | { type: "submit" }
  /** Answers a reviewer's request. The asker gets a re-review task; back to In review when no request is open. */
  | { type: "respond_to_request"; taskId: string; files?: FileRef[]; message?: string }
  /** Quote sent: accepts every condition and signs with a typed full name. */
  | { type: "accept_and_sign"; signature: string }
  /** Applicant pays by card; the Clerk records an in-person payment with the same action. */
  | { type: "pay"; amount: number; method: "card" | "in_person"; kind: Payment["kind"]; occurrenceDate?: ISODate }
  /** Before a permit exists. No fees owed. */
  | { type: "withdraw" }
  /** After a permit exists. Records the refund from the cancellation schedule. */
  | { type: "cancel" }
  | { type: "submit_feedback"; rating: number; comment?: string }
  /** Clones the record as a new Draft on the same weekday a year later (returned in `spawned`). */
  | { type: "book_again" }
  /**
   * P1. Re-classifies the same record with new answers; new cards are tagged 'amendment'. Only
   * the answer fields of `answers` are used (a whole case may be passed). The new schedule's
   * sessions are listed and the date gate runs again: a place that is no longer free is refused,
   * and so is an amendment that raises the tier or moves the date inside the new tier's lead
   * time, unless `lateFee` is true. The plan's fee lines are replaced; lines a reviewer added,
   * the state, the permit and the hold stay as they are.
   */
  | { type: "amend"; answers: EventAnswers; lateFee?: boolean }

  /* ---- City Clerk ---- */
  /** Places the date hold if the slot is free (first complete application wins). Block parties need every sign-off. */
  | { type: "accept_complete" }
  /**
   * Submitted to In review. Creates one review task per department and starts its clock. Needs
   * at least one reviewer, and each department once.
   */
  | { type: "confirm_routing"; reviewers: RoutedReviewer[] }
  | { type: "send_to_commission" }
  /** In review to Quote sent. Needs every routed review approved. Replaces conditions and fee lines with the merged ones. */
  | { type: "send_quote"; conditions: ConditionDraft[]; feeLines: FeeLineDraft[] }
  /** Final. Releases the hold. */
  | { type: "deny"; reason: string }
  /** Quote sent to Permitted. Needs signed, paid and insurance verified. Creates work-order tasks. */
  | { type: "issue_permit" }
  /** Closeout to Closed. Issues the final invoice or the deposit refund. */
  | { type: "reconcile_close" }

  /* ---- any city role ---- */
  /**
   * To Needs info. With taskId, pins the request to that applicant card; without, creates a
   * "Respond to a request" card titled from `item`. Pauses the asking department's review clock.
   */
  | { type: "request_info"; taskId?: string; item?: string; message: string; dueDate?: ISODate }
  /** Accepts an applicant's submitted card. For the card's reviewer, or the department whose request the card answers. */
  | { type: "verify_document"; taskId: string }
  /** Sends a submitted card back as 'changes requested'. Same actors as verify_document. */
  | { type: "reject_document"; taskId: string; reason: string }
  /** The actor's department decides its review. */
  | {
      type: "review_decide";
      decision: ReviewDecision;
      conditions: string[];
      feeLines: FeeLineDraft[];
      internalNote?: string;
      message?: string;
    }
  /**
   * Sets the meeting card's `scheduledFor`; a meeting can be moved until it is held. For the
   * department that holds the meeting, or the Clerk. `taskId` is the applicant's meeting card,
   * or the Clerk's own `schedule_pre_application_meeting` task, which stands for that card: the
   * date goes on the card the applicant sees and the Clerk's task is done.
   */
  | { type: "schedule_meeting"; taskId: string; date: ISODate }
  /**
   * Closes a work order (its owner), a meeting that was held (its department or the Clerk), or
   * a `verify:*` re-check with no change, which also accepts the card it was checking. Nothing
   * else: a city task with an action of its own (intake check, routing, a review, the quote,
   * Issue permit, the closeout tasks, reconciliation) is finished by that action, and the
   * refusal names it.
   */
  | { type: "complete_city_task"; taskId: string; note?: string }
  /** Public Works & Safety at closeout. Fills actuals and creates the Clerk's reconciliation task. */
  | {
      type: "log_closeout";
      cleanup: "pass" | "issues";
      notes?: string;
      actuals: { feeLineId: string; qty: number }[];
      extraLines: FeeLineDraft[];
    }
  /** City roles only: an activity entry and nothing else. */
  | { type: "add_note"; text: string }
  /** City roles only. */
  | { type: "remind"; party: Party }

  /* ---- system ---- */
  /** Raised by advanceClock(): hold expiry, Event day, Closeout, Instant straight to Closed. */
  | { type: "tick" };

export type ActionType = Action["type"];

export const ACTION_TYPES: ActionType[] = [
  "create_board",
  "book_and_pay",
  "complete_task",
  "simulate_signoff",
  "submit",
  "respond_to_request",
  "accept_and_sign",
  "pay",
  "withdraw",
  "cancel",
  "submit_feedback",
  "book_again",
  "amend",
  "accept_complete",
  "confirm_routing",
  "send_to_commission",
  "send_quote",
  "deny",
  "issue_permit",
  "reconcile_close",
  "request_info",
  "verify_document",
  "reject_document",
  "review_decide",
  "schedule_meeting",
  "complete_city_task",
  "log_closeout",
  "add_note",
  "remind",
  "tick",
];
