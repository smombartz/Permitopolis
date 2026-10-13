"use client"

import * as React from "react"
import { InlineAlert } from "@/components/ui/inline-alert"
import { Section } from "@/components/ui/section"
import { ConditionsEditor } from "../../clerk/ConditionsEditor"
import { DepartmentConsolidation } from "../../clerk/DepartmentConsolidation"
import { QuoteLinesEditor, nextQuoteRowId } from "../../clerk/QuoteLinesEditor"
import { checkSendQuote, lateFeeApplies } from "@/lib/state"
import { fmtDate, fmtMoney } from "@/lib/format"
import { reviewSummaries } from "@/lib/view/caseDetail"
import {
  addConditionRow,
  addQuoteLineRow,
  computeQuoteTotals,
  conditionIdsInConflict,
  conditionRowsFromCase,
  conditionRowsToDrafts,
  depositAmountFor,
  depositLineDrafts,
  detectConditionConflicts,
  moveConditionRow,
  previewLateFeeAmount,
  quoteLineRowsFromCase,
  quoteLineRowsToDrafts,
  removeConditionRow,
  removeQuoteLineRow,
  updateConditionRow,
  updateQuoteLineRow,
  type ConditionRow,
  type QuoteLineRow,
} from "@/lib/view/clerkTools"
import { PanelActions, PanelBody, PanelHeader, useCaseContext, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

/**
 * Consolidation and the quote builder, the Clerk's centerpiece: every routed department's
 * decision side by side, conflicts flagged, one merged conditions list the Clerk can edit,
 * reorder, delete and add to, and the quote itself — fee lines generated from the estimate and
 * the reviews' additions, each editable, grouped by department, with the deposit and the late
 * fee when it applies — with live totals and what sending will ask the applicant to pay now.
 */
function SendQuotePanel({ caseId, role, onClose }: ActionPanelProps) {
  const { c, today, cfg } = useCaseContext(caseId)
  const [error, setError] = React.useState<string | null>(null)
  const dispatch = useCaseDispatch(caseId)

  const [conditionRows, setConditionRows] = React.useState<ConditionRow[]>(() => (c ? conditionRowsFromCase(c) : []))
  const [feeRows, setFeeRows] = React.useState<QuoteLineRow[]>(() => (c ? quoteLineRowsFromCase(c) : []))

  if (!c) return null

  const check = checkSendQuote(c)
  const summaries = reviewSummaries(c, role)
  const conflicts = detectConditionConflicts(conditionRows.map((row) => ({ id: row.id, dept: row.dept, text: row.text, mergedByClerk: false, acceptedByApplicant: false })))
  const conflictIds = conditionIdsInConflict(conflicts)
  const deposit = depositAmountFor(c)
  const depositDrafts = depositLineDrafts(c)
  const totals = computeQuoteTotals(feeRows, deposit, c, cfg, today)
  const showLateFeeAdvice = lateFeeApplies(c, { today, cases: [], cfg }) && !feeRows.some((r) => r.kind === "late_fee")
  const lateFeeAdvice = showLateFeeAdvice ? previewLateFeeAmount(feeRows, cfg) : null

  const feeDrafts = quoteLineRowsToDrafts(feeRows)
  // A quote with no fee line would unlock a payment card with nothing to pay.
  const emptyQuote = feeDrafts.length === 0

  function submit() {
    // `merged`: these are the final lists, so a condition the Clerk removed stays removed, also
    // when it was the last one. The deposit is shown as its own fixed line, not one of the
    // editable rows, and send_quote takes the list as given: it has to go back in.
    const result = dispatch(
      { type: "send_quote", merged: true, conditions: conditionRowsToDrafts(conditionRows), feeLines: [...feeDrafts, ...depositDrafts] },
      "Quote sent.",
    )
    if (result.ok) onClose()
    else setError(result.reason ?? "The quote could not be sent.")
  }

  return (
    <>
      <PanelHeader
        title="Send quote"
        description="Every department's decision, merged into one set of conditions and one quote. Unlocks the applicant's sign and pay cards once sent."
      />
      <PanelBody>
        {!check.ok ? <InlineAlert variant="warning">{check.reason}</InlineAlert> : null}

        <Section title="Each department's decision">
          <DepartmentConsolidation summaries={summaries} conflicts={conflicts} />
        </Section>

        <Section title="Merged conditions" description="Edit, reorder, remove or add to the list the applicant will be asked to accept.">
          <ConditionsEditor
            rows={conditionRows}
            conflictIds={conflictIds}
            onUpdate={(id, patch) => setConditionRows((rows) => updateConditionRow(rows, id, patch))}
            onRemove={(id) => setConditionRows((rows) => removeConditionRow(rows, id))}
            onMove={(id, direction) => setConditionRows((rows) => moveConditionRow(rows, id, direction))}
            onAdd={(row) => setConditionRows((rows) => addConditionRow(rows, row))}
          />
        </Section>

        <Section title="Quote" description="Generated from the estimate and the reviews' own fee lines. Edit a line's quantity or price, or add one.">
          <QuoteLinesEditor
            rows={feeRows}
            deposit={deposit}
            lateFeeAdvice={lateFeeAdvice}
            totals={totals}
            onUpdate={(id, patch) => setFeeRows((rows) => updateQuoteLineRow(rows, id, patch))}
            onRemove={(id) => setFeeRows((rows) => removeQuoteLineRow(rows, id))}
            onAdd={(row) => setFeeRows((rows) => addQuoteLineRow(rows, row))}
            onAddLateFee={() => setFeeRows((rows) => addQuoteLineRow(rows, { id: nextQuoteRowId(), dept: "clerk", label: "Late fee", qty: 1, unit: "fee", unitPrice: lateFeeAdvice ?? 0, kind: "late_fee" }))}
          />
        </Section>

        <InlineAlert variant="info">
          Due now: {fmtMoney(totals.dueNow)}
          {c.schedule?.recurrence ? " (the series' first session; the rest is billed on schedule)" : ""}. The date hold will expire {fmtDate(totals.holdExpiresOn)} unless it is paid first.
        </InlineAlert>
      </PanelBody>
      <PanelActions error={error ?? (check.ok && emptyQuote ? "Add at least one fee line: a quote has to ask for something." : null)} onCancel={onClose} submitLabel="Send quote" disabled={!check.ok || emptyQuote} onSubmit={submit} />
    </>
  )
}

export { SendQuotePanel }
