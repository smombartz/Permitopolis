"use client"

import * as React from "react"
import { Field } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { PanelActions, PanelBody, PanelHeader, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

/** Final: denies the application and releases its date hold. A reason is required. */
function DenyPanel({ caseId, onClose }: ActionPanelProps) {
  const [reason, setReason] = React.useState("")
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const dispatch = useCaseDispatch(caseId)

  function submit() {
    const result = dispatch({ type: "deny", reason: reason.trim() }, "Application denied.")
    if (result.ok) onClose()
    else setError(result.reason ?? "That could not be denied.")
  }

  return (
    <>
      <PanelHeader title="Deny" description="This is final: the case ends as Denied and its date hold is released. The applicant sees the reason." />
      <PanelBody>
        <Field label="Reason" required hint="Shown to the applicant as the reason for the denial.">
          <Textarea autoFocus rows={5} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this application is denied" />
        </Field>
      </PanelBody>
      <PanelActions
        error={error}
        onCancel={onClose}
        submitLabel="Deny application"
        submitVariant="destructive"
        disabled={reason.trim().length === 0}
        onSubmit={() => setConfirmOpen(true)}
      />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Deny this application?"
        body="This cannot be undone. The case ends as Denied and its date hold is released."
        confirmLabel="Deny application"
        destructive
        onConfirm={submit}
      />
    </>
  )
}

export { DenyPanel }
