"use client"

import * as React from "react"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { InlineAlert } from "@/components/ui/inline-alert"
import { checkLogCloseout } from "@/lib/state"
import { Money } from "@/components/domain"
import { PanelActions, PanelBody, PanelHeader, useCaseContext, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

/** Pass or issues, actual quantities against the estimate, and any extra line (cleanup crew hours). */
function LogCloseoutPanel({ caseId, onClose }: ActionPanelProps) {
  const { c, cfg } = useCaseContext(caseId)
  const lines = c?.feeLines.filter((l) => l.kind !== "deposit") ?? []
  const [cleanup, setCleanup] = React.useState<"pass" | "issues">("pass")
  const [notes, setNotes] = React.useState("")
  // Each field starts at what is on the line now: the quantity already logged when there is one
  // (reopened after logging, it must not show the estimate again under "Actual"), else the estimate.
  const [qtyByLine, setQtyByLine] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, String(l.actual !== null && l.unitPrice > 0 ? Math.round((l.actual / l.unitPrice) * 100) / 100 : l.qty)])),
  )
  const [crewHours, setCrewHours] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const dispatch = useCaseDispatch(caseId)
  if (!c) return null

  const check = checkLogCloseout(c)

  function submit() {
    // A cleared field is "not changed", as the description says: it is left out, and the engine
    // keeps that line's estimate. It is never sent as 0.
    const actuals = lines
      .filter((l) => (qtyByLine[l.id] ?? "").trim() !== "" && Number.isFinite(Number(qtyByLine[l.id])))
      .map((l) => ({ feeLineId: l.id, qty: Number(qtyByLine[l.id]) }))
    const hours = Number(crewHours) || 0
    const extraLines =
      hours > 0 ? [{ dept: "pws" as const, label: "Cleanup crew", qty: hours, unit: "hour", unitPrice: cfg.fees.cleanupCrewPerWorkerHour }] : []
    const result = dispatch({ type: "log_closeout", cleanup, notes: notes.trim() || undefined, actuals, extraLines }, "Closeout logged.")
    if (result.ok) onClose()
    else setError(result.reason ?? "That closeout could not be logged.")
  }

  return (
    <>
      <PanelHeader title="Log closeout" description="Pass or flag the cleanup check, then log the actual quantity for every fee line. A line left as it is, or cleared, keeps its estimate." />
      <PanelBody>
        {!check.ok ? <InlineAlert variant="warning">{check.reason}</InlineAlert> : null}
        <fieldset className="flex flex-col gap-2">
          <legend className="text-eyebrow mb-1 font-bold tracking-[.12em] text-fg-label uppercase">Cleanup check</legend>
          <RadioGroup value={cleanup} onValueChange={(v) => setCleanup(v as "pass" | "issues")} className="gap-2">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="pass" id="closeout-pass" />
              <Label htmlFor="closeout-pass" className="normal-case">
                Pass
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="issues" id="closeout-issues" />
              <Label htmlFor="closeout-issues" className="normal-case">
                Issues found
              </Label>
            </div>
          </RadioGroup>
        </fieldset>
        <Field label="Notes" hint="A sample photo stands in for a real one in this prototype.">
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex flex-col gap-2">
          <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Actual quantities</p>
          {lines.length === 0 ? (
            <p className="text-sm text-fg-secondary">No fee lines to reconcile.</p>
          ) : (
            lines.map((line) => (
              <div key={line.id} className="flex items-center justify-between gap-3 rounded-control border border-line-subtle bg-surface-2 px-3 py-2">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm text-fg">{line.label}</span>
                  <span className="text-xs text-fg-label">
                    Estimate: {line.qty} {line.unit} &middot; <Money amount={line.estimate} />
                  </span>
                </div>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  className="w-28"
                  aria-label={`Actual: ${line.label}`}
                  value={qtyByLine[line.id] ?? ""}
                  disabled={!check.ok}
                  onChange={(e) => setQtyByLine((cur) => ({ ...cur, [line.id]: e.target.value }))}
                />
              </div>
            ))
          )}
        </div>
        <Field label="Cleanup crew hours" hint={`Extra line, at $${cfg.fees.cleanupCrewPerWorkerHour}/hour. Leave at 0 if there was none.`}>
          <Input type="number" min="0" step="0.5" value={crewHours} onChange={(e) => setCrewHours(e.target.value)} placeholder="0" />
        </Field>
      </PanelBody>
      <PanelActions error={error} onCancel={onClose} submitLabel="Log closeout" disabled={!check.ok} onSubmit={submit} />
    </>
  )
}

export { LogCloseoutPanel }
