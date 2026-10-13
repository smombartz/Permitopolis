"use client"

import * as React from "react"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InlineAlert } from "@/components/ui/inline-alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { classify, estimateFees } from "@/lib/rules"
import { caseTotals, nextUnpaidSession, quoteBalance } from "@/lib/state"
import { overdueSessionDates } from "@/lib/view/clerkTools"
import { fmtDateShort, fmtMoney } from "@/lib/format"
import type { RulesConfig } from "@/lib/rules/types"
import type { EventCase, Payment } from "@/lib/types"
import { PanelActions, PanelBody, PanelHeader, useCaseContext, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

/** What is owed right now, and the label for it: the quote, the next session, or the final bill. */
function paymentAsk(c: EventCase, cfg: RulesConfig, occurrenceDate?: string) {
  if (c.state === "quote_sent") {
    // A quote already paid in full has nothing to take (the engine refuses it too).
    const balance = quoteBalance(c, cfg)
    return balance > 0 ? { kind: "quote" as Payment["kind"], label: "Quote balance", amount: balance } : null
  }
  if (c.state === "permitted" || c.state === "event_day") {
    const chosen = occurrenceDate ?? nextUnpaidSession(c)
    if (chosen) {
      const perSession = estimateFees(c, classify(c, cfg), cfg).perSession ?? 0
      return { kind: "session" as Payment["kind"], label: `Session: ${fmtDateShort(chosen)}`, amount: perSession, occurrenceDate: chosen }
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
  // More than one session can sit overdue at once (nothing stops it); the Clerk picks which one this payment is for.
  const sessionChoices = c ? overdueSessionDates(c) : []
  const [occurrenceDate, setOccurrenceDate] = React.useState<string | undefined>(undefined)
  const ask = c ? paymentAsk(c, cfg, occurrenceDate) : null
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
        {ask.kind === "session" && sessionChoices.length > 1 ? (
          <Field label="Which session" hint="More than one session is overdue; pick the one this payment is for.">
            <Select value={ask.occurrenceDate} onValueChange={(v) => setOccurrenceDate(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sessionChoices.map((date) => (
                  <SelectItem key={date} value={date}>
                    {fmtDateShort(date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        <Field label="Amount">
          <Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
      </PanelBody>
      <PanelActions error={error} onCancel={onClose} submitLabel="Record payment" disabled={!valid} onSubmit={submit} />
    </>
  )
}

export { PayPanel }
