"use client"

import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useDemo } from "@/lib/state"
import type { EventCase } from "@/lib/types"
import { issueFoodPermitsStatus } from "@/lib/view/vendors"

/**
 * "Issue food permits" (PRD, "Vendor permits"): the per-vendor temporary food permits a Special
 * event's applicant downloads once every vendor's health permit is verified. Built against an
 * engine step that does not exist yet (the `issue_food_permits` engineRequest): the button calls
 * `complete_city_task` on that task's id, and stays disabled with a reason while the task is not
 * there to find. Rendered only once `issueFoodPermitsStatus(c).eligible` (a Special event with
 * vendors, permitted or later).
 */
function IssueFoodPermits({ c }: { c: EventCase }) {
  const dispatch = useDemo((s) => s.dispatch)
  const status = issueFoodPermitsStatus(c)
  if (!status.eligible) return null

  const issued = status.task?.status === "done"

  function onIssue() {
    if (!status.task) return
    const result = dispatch(c.id, { type: "complete_city_task", taskId: status.task.id })
    if (!result.ok) {
      toast.error(result.reason ?? "That could not be issued.")
      return
    }
    toast.success("Food permits issued.")
  }

  return (
    <div className="flex flex-col gap-3 rounded-panel border border-line-subtle bg-surface-2 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-fg">Issue food permits</span>
        <Progress value={status.verifiedCount} max={status.total} label={`Health permits checked: ${status.verifiedCount} of ${status.total}`} />
      </div>
      <p className="text-xs text-fg-secondary">
        Each vendor&apos;s temporary food permit, for the applicant to download per vendor once issued.
      </p>
      {issued ? (
        <p className="text-sm font-medium text-success-fg">Issued.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Button type="button" size="sm" disabled={status.disabledReason !== null} onClick={onIssue} className="w-fit">
            Issue food permits
          </Button>
          {status.disabledReason ? <p className="text-xs text-fg-secondary">{status.disabledReason}</p> : null}
        </div>
      )}
    </div>
  )
}

export { IssueFoodPermits }
