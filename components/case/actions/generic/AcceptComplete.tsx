"use client"

import * as React from "react"
import { InlineAlert } from "@/components/ui/inline-alert"
import { checkAcceptComplete } from "@/lib/state/checks"
import { PanelActions, PanelBody, PanelHeader, useCaseContext, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

/** Accepting places the date hold (first complete application wins) and opens routing. */
function AcceptCompletePanel({ caseId, onClose }: ActionPanelProps) {
  const { c, today, cfg, cases } = useCaseContext(caseId)
  const [error, setError] = React.useState<string | null>(null)
  const dispatch = useCaseDispatch(caseId)
  if (!c) return null

  const check = checkAcceptComplete(c, { today, cases, cfg })

  function submit() {
    const result = dispatch({ type: "accept_complete" }, "Accepted as complete; the date is held.")
    if (result.ok) onClose()
    else setError(result.reason ?? "That could not be accepted.")
  }

  return (
    <>
      <PanelHeader
        title="Accept as complete"
        description="Places a hold on the date and space (the first complete application wins) and opens the routing step. If another case already holds this date and was complete first, accepting is refused."
      />
      <PanelBody>
        {!check.ok ? <InlineAlert variant="warning">{check.reason}</InlineAlert> : null}
      </PanelBody>
      <PanelActions error={error} onCancel={onClose} submitLabel="Accept as complete" disabled={!check.ok} onSubmit={submit} />
    </>
  )
}

export { AcceptCompletePanel }
