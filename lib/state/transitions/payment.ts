/** `pay`: the applicant pays by card, or the Clerk records an in-person payment. */
import { fmtMoney } from "@/lib/format";
import type { RulesCtx } from "@/lib/rules/types";
import type { Actor, EventCase } from "@/lib/types";
import type { Action } from "../actions";
import { fail, OK, type CheckResult } from "../checks";
import { appendActivity, findTask, moveTask, nowOf, patchTask, quoteBalance, taskId, totalPaid } from "../core";
import type { TransitionResult } from "../types";
import { maybeUnlockIssuePermit } from "./shared";

type PayAction = Extract<Action, { type: "pay" }>;

/**
 * `pay` records three kinds of payment: toward a quote, for one session of a series, and for a
 * final bill. A booking payment and a refund are written by the actions that cause them
 * (book_and_pay; cancel, withdraw and reconcile_close), never through here.
 */
function checkPay(c: EventCase, action: PayAction): CheckResult {
  if (c.ending) return fail(`This case is ${c.ending.replace("_", " ")}.`);
  if (!(action.amount > 0)) return fail("Enter an amount above $0.");
  switch (action.kind) {
    case "quote":
      return c.state === "quote_sent" ? OK : fail("No quote to pay.");
    case "session": {
      if (!c.schedule?.recurrence) return fail("Only a series is paid by session.");
      const occurrence = c.schedule.occurrences.find((o) => o.date === action.occurrenceDate);
      if (!occurrence) return fail("No such session.");
      if (occurrence.billing === "skipped") return fail("That session is skipped.");
      if (occurrence.billing === "paid") return fail("That session is already paid.");
      return OK;
    }
    case "final_invoice":
      return c.state === "closeout" || c.state === "closed" ? OK : fail("There is no final bill yet.");
    default:
      return fail("That payment is recorded by the action that causes it.");
  }
}

export function pay(c: EventCase, action: PayAction, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkPay(c, action);
  if (!check.ok) return check;

  let next: EventCase = {
    ...c,
    payments: [...c.payments, { id: taskId(c.id, "pay", c.payments.length + 1), at: nowOf(ctx), amount: action.amount, method: action.method, kind: action.kind, occurrenceDate: action.occurrenceDate }],
  };

  if (action.kind === "quote") {
    // The card is done only when the quote is covered. A part payment (the Clerk records
    // whatever was handed over) leaves it open for the balance, so the applicant is still up.
    const remaining = quoteBalance(next, ctx.cfg);
    const payFees = findTask(next, taskId(next.id, "pay_fees"));
    if (payFees && payFees.status !== "done") {
      next =
        remaining > 0
          ? patchTask(next, payFees.id, { payload: { ...payFees.payload, amount: remaining } })
          : moveTask(next, payFees.id, "done", ctx, actor, { payload: { ...payFees.payload, amount: totalPaid(next) } });
    }
    if (remaining <= 0) {
      next = payFirstSession(next);
      // The hold's expiry was the deadline for this payment. A paid quote can no longer lose its
      // date, so the deadline goes: nothing should read "held until" a day that has passed.
      if (next.dateHold.status === "held") next = { ...next, dateHold: { ...next.dateHold, expiresOn: null } };
    }
    next = maybeUnlockIssuePermit(next, ctx);
  }

  if (action.kind === "session" && next.schedule) {
    next = { ...next, schedule: { ...next.schedule, occurrences: next.schedule.occurrences.map((o) => (o.date === action.occurrenceDate ? { ...o, billing: "paid" } : o)) } };
  }

  if (action.kind === "final_invoice") {
    const billTask = findTask(next, taskId(next.id, "final_bill_or_refund"));
    if (billTask && billTask.status !== "done") {
      next = moveTask(next, billTask.id, "done", ctx, actor, { payload: { ...billTask.payload, amount: action.amount } });
    }
  }

  next = appendActivity(next, actor, `Recorded a payment of ${fmtMoney(action.amount)} (${action.method === "card" ? "card" : "in person"}).`, ctx);
  return { ok: true, case: next };
}

/** A series' quote includes its first session, so paying the quote pays that session. */
function payFirstSession(c: EventCase): EventCase {
  if (!c.schedule?.recurrence || c.schedule.occurrences.some((o) => o.billing === "paid")) return c;
  const first = c.schedule.occurrences.find((o) => o.billing !== "skipped");
  if (!first) return c;
  return { ...c, schedule: { ...c.schedule, occurrences: c.schedule.occurrences.map((o) => (o === first ? { ...o, billing: "paid" as const } : o)) } };
}
