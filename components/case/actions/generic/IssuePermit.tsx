"use client"

import * as React from "react"
import { InlineAlert } from "@/components/ui/inline-alert"
import { checkIssuePermit } from "@/lib/state"
import { PanelActions, PanelBody, PanelHeader, useCaseContext, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

/** Moves Quote sent to Permitted: creates the work orders and unlocks the day-of cards. */
function IssuePermitPanel({ caseId, onClose }: ActionPanelProps) {
  const { c, today, cfg, cases } = useCaseContext(caseId)
  const [error, setError] = React.useState<string | null>(null)
  const dispatch = useCaseDispatch(caseId)
  if (!c) return null

  const check = checkIssuePermit(c, { today, cases, cfg })

  function submit() {
    const result = dispatch({ type: "issue_permit" }, "Permit issued.")
    if (result.ok) onClose()
    else setError(result.reason ?? "The permit could not be issued.")
  }

  return (
    <>
      <PanelHeader
        title="Issue permit"
        description="Moves the case to Permitted, creates Public Works & Safety's work orders, and opens the applicant's day-of cards."
      />
      <PanelBody>
        {!check.ok ? <InlineAlert variant="warning">{check.reason}</InlineAlert> : <InlineAlert variant="success">Everything this needs is in place.</InlineAlert>}
      </PanelBody>
      <PanelActions error={error} onCancel={onClose} submitLabel="Issue permit" disabled={!check.ok} onSubmit={submit} />
    </>
  )
}

export { IssuePermitPanel }
