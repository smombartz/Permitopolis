"use client"

import * as React from "react"
import { Field } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { InlineAlert } from "@/components/ui/inline-alert"
import { KeyValueList } from "@/components/ui/key-value"
import { checkCompleteCityTask } from "@/lib/state"
import { fmtDate } from "@/lib/format"
import { workOrderDetail } from "@/lib/view/reviewTools"
import { PanelActions, PanelBody, PanelHeader, useCaseContext, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

/** Closes a work order (with its own detail: what, how many, for which event, due), or a meeting already held. */
function CompleteCityTaskPanel({ caseId, arg, role, onClose }: ActionPanelProps) {
  const { c } = useCaseContext(caseId)
  const [note, setNote] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const dispatch = useCaseDispatch(caseId)
  if (!c || !arg) return null

  const task = c.tasks.find((t) => t.id === arg)
  if (!task) return null
  const check = checkCompleteCityTask(c, arg, role)
  const isWorkOrder = task.catalogId.startsWith("work_order:")
  // A meeting is held, a work order is done: the Reviews tab's button says "Mark held" too.
  const isMeeting = task.kind === "meeting"
  const detail = isWorkOrder ? workOrderDetail(c, task) : null

  function submit() {
    const result = dispatch({ type: "complete_city_task", taskId: arg as string, note: note.trim() || undefined }, `Marked "${task!.title}" ${isMeeting ? "held" : "done"}.`)
    if (result.ok) onClose()
    else setError(result.reason ?? "That could not be marked done.")
  }

  return (
    <>
      <PanelHeader title={task.title} description={!isWorkOrder ? task.why || "Marks this task done." : undefined} />
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
        ) : null}
        <Field label="Note" hint="Optional, kept on the task.">
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </PanelBody>
      <PanelActions error={error} onCancel={onClose} submitLabel={isMeeting ? "Mark held" : "Mark done"} disabled={!check.ok} onSubmit={submit} />
    </>
  )
}

export { CompleteCityTaskPanel }
