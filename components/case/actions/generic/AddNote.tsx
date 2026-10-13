"use client"

import * as React from "react"
import { Field } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { PanelActions, PanelBody, PanelHeader, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

/** Writes a plain activity entry. Every city role can always add one. */
function AddNotePanel({ caseId, onClose }: ActionPanelProps) {
  const [text, setText] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const dispatch = useCaseDispatch(caseId)

  function submit() {
    const result = dispatch({ type: "add_note", text: text.trim() }, "Note added.")
    if (result.ok) onClose()
    else setError(result.reason ?? "That note could not be added.")
  }

  return (
    <>
      <PanelHeader title="Add a note" description="Goes straight into the case's activity log; nobody is notified." />
      <PanelBody>
        <Field label="Note">
          <Textarea autoFocus rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="What happened, or what to remember about this case" />
        </Field>
      </PanelBody>
      <PanelActions error={error} onCancel={onClose} submitLabel="Add note" disabled={text.trim().length === 0} onSubmit={submit} />
    </>
  )
}

export { AddNotePanel }
