"use client"

import * as React from "react"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InlineAlert } from "@/components/ui/inline-alert"
import { classify, estimateFees } from "@/lib/rules"
import { caseTotals } from "@/lib/state"
import { nextUnpaidSession } from "@/lib/state/checks"
import { quoteBalance } from "@/lib/state/core"
import { fmtDateShort, fmtMoney } from "@/lib/format"
import type { RulesConfig } from "@/lib/rules/types"
import type { EventCase, Payment } from "@/lib/types"
import { PanelActions, PanelBody, PanelHeader, useCaseContext, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

/** What is owed right now, and the label for it: the quote, the next session, or the final bill. */
function paymentAsk(c: EventCase, cfg: RulesConfig) {
  if (c.state === "quote_sent") {
    return { kind: "quote" as Payment["kind"], label: "Quote balance", amount: quoteBalance(c, cfg) }
  }
  if (c.state === "permitted" || c.state === "event_day") {
    const occurrenceDate = nextUnpaidSession(c)
    if (occurrenceDate) {
      const perSession = estimateFees(c, classify(c, cfg), cfg).perSession ?? 0
      return { kind: "session" as Payment["kind"], label: `Session: ${fmtDateShort(occurrenceDate)}`, amount: perSession, occurrenceDate }
    }
  }
  if (c.state === "closed" && caseTotals(c).due > 0) {
    return { kind: "final_invoice" as Payment["kind"], label: "Final bill", amount: caseTotals(c).due }
  }
  return null
}

/** Records a payment taken at the counter: a quote, a series session, or the final bill, in the state it belongs to. */
function PayPanel({ caseId, onClose }: ActionPanelProps) {
  const { c, cfg } = useCaseContext(caseId)
  const ask = c ? paymentAsk(c, cfg) : null
  const [amount, setAmount] = React.useState(ask ? String(ask.amount) : "")
  const [error, setError] = React.useState<string | null>(null)
  const dispatch = useCaseDispatch(caseId)
  if (!c) return null

  if (!ask) {
    return (
      <>
        <PanelHeader title="Record an in-person payment" />
        <PanelBody>
          <InlineAlert variant="info">Nothing is due from this case right now.</InlineAlert>
        </PanelBody>
        <PanelActions onCancel={onClose} submitLabel="Close" disabled onSubmit={onClose} />
      </>
    )
  }

  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0

  function submit() {
    const result = dispatch(
      { type: "pay", amount: parsed, method: "in_person", kind: ask!.kind, occurrenceDate: ask!.occurrenceDate },
      `Recorded ${fmtMoney(parsed)}.`,
    )
    if (result.ok) onClose()
    else setError(result.reason ?? "That payment could not be recorded.")
  }

  return (
    <>
      <PanelHeader title="Record an in-person payment" description={`${ask.label} · defaults to the amount due.`} />
      <PanelBody>
        <Field label="Amount">
          <Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
      </PanelBody>
      <PanelActions error={error} onCancel={onClose} submitLabel="Record payment" disabled={!valid} onSubmit={submit} />
    </>
  )
}

export { PayPanel }
