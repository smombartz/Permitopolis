"use client"

import * as React from "react"
import { PanelActions, PanelBody, PanelHeader, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

/** Flags the case for commission review. Nothing else in this prototype changes. */
function SendToCommissionPanel({ caseId, onClose }: ActionPanelProps) {
  const [error, setError] = React.useState<string | null>(null)
  const dispatch = useCaseDispatch(caseId)

  function submit() {
    const result = dispatch({ type: "send_to_commission" }, "Sent to commission.")
    if (result.ok) onClose()
    else setError(result.reason ?? "That could not be sent to commission.")
  }

  return (
    <>
      <PanelHeader title="Send to commission" description="Flags this case for the commission's own review. A banner on the case shows it to everyone; nothing else about the case changes here." />
      <PanelBody />
      <PanelActions error={error} onCancel={onClose} submitLabel="Send to commission" onSubmit={submit} />
    </>
  )
}

export { SendToCommissionPanel }
