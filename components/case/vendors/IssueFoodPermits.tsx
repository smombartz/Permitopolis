"use client"

import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { InlineAlert } from "@/components/ui/inline-alert"
import { Progress } from "@/components/ui/progress"
import { fmtDate } from "@/lib/format"
import { useDemo } from "@/lib/state"
import type { EventCase, Party } from "@/lib/types"
import { issueFoodPermitsStatus } from "@/lib/view/vendors"

/**
 * "Issue food permits" (PRD, "Vendor permits"): the per-vendor temporary food permits a Special
 * event's applicant downloads. It is Health & Legal's own city task, created when the permit is
 * issued and open once every vendor's health permit is verified; the button finishes it with
 * `complete_city_task`, which opens the applicant's "Download per-vendor food permits" card.
 * Disabled with the engine's reason until then. Another role reads the same block without the
 * button. Renders nothing for a case with no such task (not Special, no vendors, or no permit yet).
 */
function IssueFoodPermits({ c, role }: { c: EventCase; role: Party }) {
  const dispatch = useDemo((s) => s.dispatch)
  const today = useDemo((s) => s.demoToday)
  const status = issueFoodPermitsStatus(c, today)
  if (!status.task) return null
  const taskId = status.task.id

  function onIssue() {
    const result = dispatch(c.id, { type: "complete_city_task", taskId })
    if (!result.ok) {
      toast.error(result.reason ?? "That could not be issued.")
      return
    }
    toast.success("Food permits issued.")
  }

  return (
    <div data-slot="issue-food-permits" className="flex flex-col gap-3 rounded-panel border border-line-subtle bg-surface-2 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-fg">Issue food permits</span>
        <Progress value={status.verifiedCount} max={status.total} label={`Health permits checked: ${status.verifiedCount} of ${status.total}`} />
      </div>
      <p className="text-xs text-fg-secondary">
        Each vendor&apos;s temporary food permit. Once issued, the applicant downloads them from their board.
      </p>
      {status.issuedOn ? (
        <InlineAlert variant="success">Issued {fmtDate(status.issuedOn)}.</InlineAlert>
      ) : role === "hl" ? (
        <div className="flex flex-col gap-1.5">
          <Button type="button" size="sm" disabled={status.disabledReason !== null} onClick={onIssue} className="w-fit">
            Issue food permits
          </Button>
          {status.disabledReason ? <p className="text-xs text-fg-secondary">{status.disabledReason}</p> : null}
        </div>
      ) : (
        <p className="text-xs text-fg-secondary">{status.disabledReason ?? "Health & Legal issues these (not yours to issue)."}</p>
      )}
    </div>
  )
}

export { IssueFoodPermits }
