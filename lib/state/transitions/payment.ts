/** `pay`: the applicant pays by card, or the Clerk records an in-person payment. */
import type { RulesCtx } from "@/lib/rules/types";
import type { Actor, EventCase } from "@/lib/types";
import type { Action } from "../actions";
import { fail, type CheckResult } from "../checks";
import { appendActivity, findTask, moveTask, nowOf, taskId } from "../core";
import type { TransitionResult } from "../types";
import { maybeUnlockIssuePermit } from "./shared";

type PayAction = Extract<Action, { type: "pay" }>;

function checkPay(c: EventCase, action: PayAction): CheckResult {
  if (c.ending) return fail(`This case is ${c.ending.replace("_", " ")}.`);
  if (action.kind === "quote") {
    if (c.state !== "quote_sent") return fail("No quote to pay.");
  }
  if (action.kind === "session") {
    const occurrence = c.schedule?.occurrences.find((o) => o.date === action.occurrenceDate);
    if (!occurrence) return fail("No such session.");
    if (occurrence.billing === "paid") return fail("That session is already paid.");
  }
  return { ok: true };
}

export function pay(c: EventCase, action: PayAction, actor: Actor, ctx: RulesCtx): TransitionResult {
  const check = checkPay(c, action);
  if (!check.ok) return check;

  let next: EventCase = {
    ...c,
    payments: [...c.payments, { id: taskId(c.id, "pay", c.payments.length + 1), at: nowOf(ctx), amount: action.amount, method: action.method, kind: action.kind, occurrenceDate: action.occurrenceDate }],
  };

  if (action.kind === "quote") {
    const payFees = findTask(next, taskId(next.id, "pay_fees"));
    if (payFees) {
      next = moveTask(next, payFees.id, "done", ctx, actor, { payload: { ...payFees.payload, amount: action.amount } });
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

  next = appendActivity(next, actor, `Recorded a payment of ${action.amount} (${action.method}).`, ctx);
  return { ok: true, case: next };
}
