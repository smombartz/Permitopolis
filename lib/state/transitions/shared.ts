/** Logic shared by more than one transition handler. */
import type { RulesCtx } from "@/lib/rules/types";
import type { EventCase } from "@/lib/types";
import { findTask, moveTask, paidInFull, taskId } from "../core";

/**
 * "When the case is signed, paid in full and insurance_certificate is done, the issue_permit
 * task unlocks to 'todo'." Called after accept_and_sign and after a quote payment, since either
 * one can be the last of the three conditions.
 */
export function maybeUnlockIssuePermit(c: EventCase, ctx: RulesCtx): EventCase {
  const issuePermitId = taskId(c.id, "issue_permit");
  const issuePermit = findTask(c, issuePermitId);
  if (!issuePermit || issuePermit.status !== "locked") return c;
  if (!c.flags.signed) return c;
  if (!paidInFull(c)) return c;
  const insurance = findTask(c, taskId(c.id, "insurance_certificate"));
  if (insurance && insurance.status !== "done") return c;
  return moveTask(c, issuePermitId, "todo", ctx, "system");
}
