"use client"

import * as React from "react"
import { Field } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { InlineAlert } from "@/components/ui/inline-alert"
import { checkCompleteCityTask } from "@/lib/state"
import { PanelActions, PanelBody, PanelHeader, useCaseContext, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

/** Closes a work order, or a meeting already held. */
function CompleteCityTaskPanel({ caseId, arg, role, onClose }: ActionPanelProps) {
  const { c } = useCaseContext(caseId)
  const [note, setNote] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const dispatch = useCaseDispatch(caseId)
  if (!c || !arg) return null

  const task = c.tasks.find((t) => t.id === arg)
  if (!task) return null
  const check = checkCompleteCityTask(c, arg, role)

  function submit() {
    const result = dispatch({ type: "complete_city_task", taskId: arg as string, note: note.trim() || undefined }, `Marked "${task!.title}" done.`)
    if (result.ok) onClose()
    else setError(result.reason ?? "That could not be marked done.")
  }

  return (
    <>
      <PanelHeader title={task.title} description={task.why || "Marks this task done."} />
      <PanelBody>
        {!check.ok ? <InlineAlert variant="warning">{check.reason}</InlineAlert> : null}
        <Field label="Note" hint="Optional, kept on the task.">
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </PanelBody>
      <PanelActions error={error} onCancel={onClose} submitLabel="Mark done" disabled={!check.ok} onSubmit={submit} />
    </>
  )
}

export { CompleteCityTaskPanel }
