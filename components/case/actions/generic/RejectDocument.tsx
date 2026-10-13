"use client"

import * as React from "react"
import { Field } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { InlineAlert } from "@/components/ui/inline-alert"
import { checkVerifyOrReject } from "@/lib/state"
import { PanelActions, PanelBody, PanelHeader, useCaseContext, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"
import { CardContent } from "./VerifyDocument"

/** Sends a submitted applicant card back as "Changes requested", with a reason required. */
function RejectDocumentPanel({ caseId, arg, role, onClose }: ActionPanelProps) {
  const { c } = useCaseContext(caseId)
  const [reason, setReason] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const dispatch = useCaseDispatch(caseId)
  if (!c || !arg) return null
  const task = c.tasks.find((t) => t.id === arg)
  if (!task) return null

  const check = checkVerifyOrReject(c, arg, role)

  function submit() {
    const result = dispatch({ type: "reject_document", taskId: arg as string, reason: reason.trim() }, `Sent "${task!.title}" back.`)
    if (result.ok) onClose()
    else setError(result.reason ?? "That could not be sent back.")
  }

  return (
    <>
      <PanelHeader title={`Send back: ${task.title}`} description="The card returns to the applicant as Changes requested, with your reason." />
      <PanelBody>
        {!check.ok ? <InlineAlert variant="warning">{check.reason}</InlineAlert> : null}
        <CardContent task={task} />
        <Field label="Reason" required>
          <Textarea autoFocus rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What needs to change" />
        </Field>
      </PanelBody>
      <PanelActions
        error={error}
        onCancel={onClose}
        submitLabel="Send back"
        submitVariant="destructive"
        disabled={!check.ok || reason.trim().length === 0}
        onSubmit={submit}
      />
    </>
  )
}

export { RejectDocumentPanel }
