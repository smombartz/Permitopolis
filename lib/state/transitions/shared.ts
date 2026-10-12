/** Logic shared by more than one transition handler. */
import type { RulesCtx } from "@/lib/rules/types";
import type { EventCase } from "@/lib/types";
import { findTask, moveTask, quotePaid, taskId } from "../core";

/**
 * "When the case is signed, the quote is paid and insurance_certificate is done, the
 * issue_permit task unlocks to 'todo'." Called after accept_and_sign, after a quote payment and
 * after a verification, since any one of them can be the last of the three conditions.
 */
export function maybeUnlockIssuePermit(c: EventCase, ctx: RulesCtx): EventCase {
  const issuePermitId = taskId(c.id, "issue_permit");
  const issuePermit = findTask(c, issuePermitId);
  if (!issuePermit || issuePermit.status !== "locked") return c;
  if (!c.flags.signed) return c;
  if (!quotePaid(c, ctx.cfg)) return c;
  const insurance = findTask(c, taskId(c.id, "insurance_certificate"));
  if (insurance && insurance.status !== "done") return c;
  return moveTask(c, issuePermitId, "todo", ctx, "system");
}
