"use client"

import * as React from "react"
import { InlineAlert } from "@/components/ui/inline-alert"
import { ConditionList, FeeTable } from "@/components/domain"
import { checkSendQuote } from "@/lib/state"
import { addDaysISO } from "@/lib/dates"
import { fmtDate } from "@/lib/format"
import { PanelActions, PanelBody, PanelHeader, useCaseContext, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

/**
 * The merged conditions and fee lines as they stand, read-only in this phase: a richer quote
 * builder is a later workstream. Sending passes the case's current conditions and fee lines
 * through unchanged (empty arrays fall back to them) and sets the hold's new expiry.
 */
function SendQuotePanel({ caseId, onClose }: ActionPanelProps) {
  const { c, today, cfg } = useCaseContext(caseId)
  const [error, setError] = React.useState<string | null>(null)
  const dispatch = useCaseDispatch(caseId)
  if (!c) return null

  const check = checkSendQuote(c)
  const expiresOn = addDaysISO(today, cfg.hold.daysAfterQuote)

  function submit() {
    const result = dispatch({ type: "send_quote", conditions: [], feeLines: [] }, "Quote sent.")
    if (result.ok) onClose()
    else setError(result.reason ?? "The quote could not be sent.")
  }

  return (
    <>
      <PanelHeader title="Send quote" description="Every department's conditions and fee lines, merged, as they stand. Unlocks the applicant's sign and pay cards." />
      <PanelBody>
        {!check.ok ? <InlineAlert variant="warning">{check.reason}</InlineAlert> : null}
        {c.conditions.length > 0 ? <ConditionList conditions={c.conditions} /> : <p className="text-sm text-fg-secondary">No conditions yet.</p>}
        {c.feeLines.length > 0 ? <FeeTable lines={c.feeLines} /> : <p className="text-sm text-fg-secondary">No fee lines yet.</p>}
        <InlineAlert variant="info">The date hold will expire {fmtDate(expiresOn)} unless it is paid first.</InlineAlert>
      </PanelBody>
      <PanelActions error={error} onCancel={onClose} submitLabel="Send quote" disabled={!check.ok} onSubmit={submit} />
    </>
  )
}

export { SendQuotePanel }
