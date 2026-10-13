"use client"

import * as React from "react"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { InlineAlert } from "@/components/ui/inline-alert"
import { FileDrop } from "@/components/ui/file-drop"
import { checkLogCloseout } from "@/lib/state"
import { fmtDate, fmtMoney } from "@/lib/format"
import { FeeTable, Money } from "@/components/domain"
import { CleanupResult } from "../../CleanupResult"
import type { FeeLineDraft } from "@/lib/state/actions"
import type { FileRef } from "@/lib/types"
import { closeoutRows, damageRepairLine } from "@/lib/view/reviewTools"
import { PanelActions, PanelBody, PanelHeader, useCaseContext, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

const SAMPLE_PHOTO: FileRef = { name: "cleanup-site-photo.jpg", size: 410_000, type: "image/jpeg" }

/**
 * Public Works & Safety's closeout (workstream 4C): the cleanup check, actual quantities next
 * to the estimate with the difference per line and a running total, extra lines from presets,
 * and an Instant event's own damage-report shape. Logged once; a second log is refused and the
 * panel shows what was logged instead of a form to fill in again.
 */
function LogCloseoutPanel({ caseId, onClose }: ActionPanelProps) {
  const { c, cfg } = useCaseContext(caseId)
  const dispatch = useCaseDispatch(caseId)
  const [cleanup, setCleanup] = React.useState<"pass" | "issues">("pass")
  const [notes, setNotes] = React.useState("")
  const [photo, setPhoto] = React.useState<FileRef[]>([])
  const [qtyByLine, setQtyByLine] = React.useState<Record<string, string>>({})
  const [crewHours, setCrewHours] = React.useState("")
  const [issue, setIssue] = React.useState("")
  const [repairCharge, setRepairCharge] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  if (!c) return null

  const check = checkLogCloseout(c)
  const checkReason = check.ok ? null : check.reason
  const alreadyLogged = c.closeout.hoursLoggedOn !== null
  const isInstant = c.tier === "instant"
  const pwsLines = c.feeLines.filter((l) => l.dept === "pws" && l.kind !== "deposit")

  const actualQtyByLineId: Record<string, number | null> = {}
  for (const l of pwsLines) {
    const raw = qtyByLine[l.id]
    actualQtyByLineId[l.id] = raw === undefined || raw.trim() === "" ? null : Number(raw)
  }
  const crewQty = Number(crewHours) || 0
  const extraLines: FeeLineDraft[] = crewQty > 0 ? [{ dept: "pws", label: "Cleanup crew", qty: crewQty, unit: "worker-hour", unitPrice: cfg.fees.cleanupCrewPerWorkerHour }] : []
  const summary = closeoutRows(c, "pws", actualQtyByLineId, extraLines)

  if (alreadyLogged) {
    return (
      <>
        <PanelHeader title="Closeout" description={c.closeout.hoursLoggedOn ? `Logged ${fmtDate(c.closeout.hoursLoggedOn)}.` : undefined} />
        <PanelBody>
          <InlineAlert variant="warning">{checkReason}</InlineAlert>
          <CleanupResult cleanup={c.closeout.cleanup} notes={c.closeout.notes} />
          {/* The same table the Clerk reconciles from and the Conditions and fees tab shows. */}
          {pwsLines.length > 0 ? <FeeTable lines={pwsLines} showActual /> : <p className="text-sm text-fg-secondary">No fee lines to reconcile.</p>}
        </PanelBody>
        <PanelActions error={null} onCancel={onClose} submitLabel="Done" onSubmit={onClose} />
      </>
    )
  }

  function submit() {
    const actuals = pwsLines.filter((l) => actualQtyByLineId[l.id] !== null).map((l) => ({ feeLineId: l.id, qty: actualQtyByLineId[l.id]! }))
    const lines: FeeLineDraft[] = isInstant
      ? cleanup === "issues" && Number(repairCharge) > 0
        ? [damageRepairLine(issue.trim() || "Cleanup", Number(repairCharge))]
        : []
      : extraLines
    const result = dispatch({ type: "log_closeout", cleanup, notes: notes.trim() || undefined, actuals: isInstant ? [] : actuals, extraLines: lines }, "Closeout logged.")
    if (result.ok) onClose()
    else setError(result.reason ?? "That closeout could not be logged.")
  }

  return (
    <>
      <PanelHeader
        title="Log closeout"
        description={isInstant ? "Pass the cleanup inspection, or report an issue and its repair charge." : "Pass or flag the cleanup inspection, then log the actual quantity for every fee line. A line left as it is keeps its estimate."}
      />
      <PanelBody>
        {!check.ok ? <InlineAlert variant="warning">{check.reason}</InlineAlert> : null}
        <fieldset className="flex flex-col gap-2">
          <legend className="text-eyebrow mb-1 font-bold tracking-[.12em] text-fg-label uppercase">Cleanup inspection</legend>
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

        {isInstant ? (
          cleanup === "issues" ? (
            <>
              <Field label="Issue">
                <Input value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="Broken picnic table" />
              </Field>
              <Field label="Notes">
                <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
              <Field label="Repair charge" hint="Added as an extra fee line.">
                <Input type="number" min="0" step="0.01" value={repairCharge} onChange={(e) => setRepairCharge(e.target.value)} placeholder="0" />
              </Field>
            </>
          ) : null
        ) : (
          <>
            {cleanup === "issues" ? (
              <>
                <Field label="Notes" hint="What was found and what it needs.">
                  <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>
                <FileDrop sample={SAMPLE_PHOTO} onFiles={setPhoto} label="Add a photo" hint="JPG or PNG" />
                {photo.length > 0 ? <p className="text-xs text-fg-secondary">{photo[0].name} attached.</p> : null}
              </>
            ) : null}

            <div className="flex flex-col gap-2">
              <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Actual quantities</p>
              {pwsLines.length === 0 ? (
                <p className="text-sm text-fg-secondary">No fee lines to reconcile.</p>
              ) : (
                summary.rows.map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-3 rounded-control border border-line-subtle bg-surface-2 px-3 py-2">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm text-fg">{row.label}</span>
                      <span className="text-xs text-fg-label">
                        Estimate: {row.estimateQty} {row.unit} &middot; <Money amount={row.estimateAmount} />
                        {row.actualQty !== null ? (
                          <>
                            {" "}
                            &middot; Difference: <Money amount={row.difference} signColor className="text-xs" />
                          </>
                        ) : null}
                      </span>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      className="w-28"
                      aria-label={`Actual: ${row.label}`}
                      value={qtyByLine[row.id] ?? ""}
                      disabled={!check.ok}
                      onChange={(e) => setQtyByLine((cur) => ({ ...cur, [row.id]: e.target.value }))}
                    />
                  </div>
                ))
              )}
            </div>
            <Field label="Cleanup crew hours" hint={`An extra line, at ${fmtMoney(cfg.fees.cleanupCrewPerWorkerHour)} an hour. Leave it at 0 if there was none.`}>
              <Input type="number" min="0" step="0.5" value={crewHours} onChange={(e) => setCrewHours(e.target.value)} placeholder="0" />
            </Field>
            <div className="flex items-center justify-between border-t border-line-subtle pt-2 text-sm">
              <span className="font-semibold text-fg">Running total</span>
              <span className={summary.runningTotal > 0 ? "font-mono font-semibold text-danger-fg" : summary.runningTotal < 0 ? "font-mono font-semibold text-success-fg" : "font-mono font-semibold text-fg"}>
                {summary.runningTotal > 0 ? `${fmtMoney(summary.runningTotal)} over` : summary.runningTotal < 0 ? `${fmtMoney(-summary.runningTotal)} under` : "On estimate"}
              </span>
            </div>
            <InlineAlert variant="info">Submitting creates the City Clerk&apos;s reconciliation task.</InlineAlert>
          </>
        )}
      </PanelBody>
      <PanelActions error={error} onCancel={onClose} submitLabel="Log closeout" disabled={!check.ok} onSubmit={submit} />
    </>
  )
}

export { LogCloseoutPanel }
