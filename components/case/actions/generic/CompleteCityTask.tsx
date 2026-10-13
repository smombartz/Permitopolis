"use client"

import * as React from "react"
import { Field } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { InlineAlert } from "@/components/ui/inline-alert"
import { KeyValueList } from "@/components/ui/key-value"
import { checkCompleteCityTask, vendorHealthPermits } from "@/lib/state"
import { fmtDate, plural } from "@/lib/format"
import { workOrderDetail } from "@/lib/view/reviewTools"
import { PanelActions, PanelBody, PanelHeader, useCaseContext, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

/**
 * Closes a work order (with its own detail: what, how many, for which event, due), a meeting
 * already held, or Health & Legal's "Issue food permits" (which opens the applicant's download).
 */
function CompleteCityTaskPanel({ caseId, arg, role, onClose }: ActionPanelProps) {
  const { c, today } = useCaseContext(caseId)
  const [note, setNote] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const dispatch = useCaseDispatch(caseId)
  if (!c || !arg) return null

  const task = c.tasks.find((t) => t.id === arg)
  if (!task) return null
  const check = checkCompleteCityTask(c, arg, role, today)
  const isWorkOrder = task.catalogId.startsWith("work_order:")
  // A meeting is held, a work order is done: the Reviews tab's button says "Mark held" too.
  const isMeeting = task.kind === "meeting"
  const isFoodPermits = task.catalogId === "issue_food_permits"
  const detail = isWorkOrder ? workOrderDetail(c, task) : null
  const vendors = vendorHealthPermits(c)

  function submit() {
    const done = isFoodPermits ? "Food permits issued." : `Marked "${task!.title}" ${isMeeting ? "held" : "done"}.`
    const result = dispatch({ type: "complete_city_task", taskId: arg as string, note: note.trim() || undefined }, done)
    if (result.ok) onClose()
    else setError(result.reason ?? "That could not be marked done.")
  }

  const description = isFoodPermits
    ? "Issues each vendor's temporary food permit. The applicant can then download them from their board."
    : !isWorkOrder
      ? task.why || "Marks this task done."
      : undefined

  return (
    <>
      <PanelHeader title={task.title} description={description} />
      <PanelBody>
        {!check.ok ? <InlineAlert variant="warning">{check.reason}</InlineAlert> : null}
        {detail ? (
          <KeyValueList
            items={[
              { label: "For", value: detail.eventName },
              { label: "Quantity", value: detail.quantity },
              { label: "Event date", value: detail.eventDate ? fmtDate(detail.eventDate) : null },
              { label: "Due", value: detail.due ? fmtDate(detail.due) : null },
            ]}
          />
        ) : isMeeting ? (
          <p className="text-sm text-fg-secondary">{task.payload.scheduledFor ? `Scheduled for ${fmtDate(task.payload.scheduledFor)}.` : "Not yet scheduled."}</p>
        ) : isFoodPermits ? (
          <KeyValueList
            items={[
              { label: "For", value: c.name },
              { label: "Vendors", value: `${vendors.total - vendors.left} of ${plural(vendors.total, "health permit")} verified` },
              { label: "Due", value: task.dueDate ? fmtDate(task.dueDate) : null },
            ]}
          />
        ) : null}
        <Field label="Note" hint="Optional, kept on the task.">
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </PanelBody>
      <PanelActions error={error} onCancel={onClose} submitLabel={isFoodPermits ? "Issue food permits" : isMeeting ? "Mark held" : "Mark done"} disabled={!check.ok} onSubmit={submit} />
    </>
  )
}

export { CompleteCityTaskPanel }
