"use client"

import * as React from "react"
import { InlineAlert } from "@/components/ui/inline-alert"
import { checkReconcileClose } from "@/lib/state"
import { CloseoutSettlementStats } from "../../CloseoutSettlementStats"
import { PanelActions, PanelBody, PanelHeader, useCaseContext, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

/** Compares the logged actuals to the estimate, issues the final bill or refund, and closes the case. */
function ReconcileClosePanel({ caseId, onClose }: ActionPanelProps) {
  const { c } = useCaseContext(caseId)
  const [error, setError] = React.useState<string | null>(null)
  const dispatch = useCaseDispatch(caseId)
  if (!c) return null

  const check = checkReconcileClose(c)

  function submit() {
    const result = dispatch({ type: "reconcile_close" }, "Reconciled and closed.")
    if (result.ok) onClose()
    else setError(result.reason ?? "That could not be reconciled.")
  }

  return (
    <>
      <PanelHeader
        title="Reconcile and close"
        description="Compares the actual costs Public Works & Safety logged against the estimate. Any overage comes out of the deposit; what is left is refunded, or a final bill is issued for the rest. The case then closes."
      />
      <PanelBody>
        {!check.ok ? <InlineAlert variant="warning">{check.reason}</InlineAlert> : <CloseoutSettlementStats c={c} />}
      </PanelBody>
      <PanelActions error={error} onCancel={onClose} submitLabel="Reconcile and close" disabled={!check.ok} onSubmit={submit} />
    </>
  )
}

export { ReconcileClosePanel }
