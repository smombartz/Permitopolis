"use client"

import * as React from "react"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { InlineAlert } from "@/components/ui/inline-alert"
import { CONDITION_TEMPLATES } from "@/lib/data/templates"
import { checkReviewDecide } from "@/lib/state/checks"
import type { FeeLineDraft, ReviewDecision } from "@/lib/state/actions"
import type { Dept } from "@/lib/types"
import { PanelActions, PanelBody, PanelHeader, useCaseContext, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

interface FeeRow extends FeeLineDraft {
  key: string
}

let feeRowSeq = 0
function emptyFeeRow(dept: Dept): FeeRow {
  feeRowSeq += 1
  return { key: `row-${feeRowSeq}`, dept, label: "", qty: 1, unit: "each", unitPrice: 0 }
}

const DECISION_LABEL: Record<ReviewDecision, string> = {
  approve: "Approve",
  approve_with_conditions: "Approve with conditions",
  deny: "Deny",
}

/** The shared decision panel for every department: Approve, Approve with conditions, or Deny, with condition templates and fee lines. */
function ReviewDecidePanel({ caseId, role, onClose }: ActionPanelProps) {
  const { c } = useCaseContext(caseId)
  const dept = role as Dept
  const [decision, setDecision] = React.useState<ReviewDecision>("approve")
  const [checkedTemplates, setCheckedTemplates] = React.useState<Set<string>>(new Set())
  const [freeText, setFreeText] = React.useState("")
  const [feeRows, setFeeRows] = React.useState<FeeRow[]>([])
  const [internalNote, setInternalNote] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const dispatch = useCaseDispatch(caseId)
  if (!c) return null

  const check = checkReviewDecide(c, dept)
  const templates = CONDITION_TEMPLATES[dept] ?? []

  function toggleTemplate(text: string) {
    setCheckedTemplates((cur) => {
      const next = new Set(cur)
      if (next.has(text)) next.delete(text)
      else next.add(text)
      return next
    })
  }

  function updateRow(key: string, patch: Partial<FeeRow>) {
    setFeeRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function submit() {
    const conditions =
      decision === "deny"
        ? []
        : [...checkedTemplates, ...freeText.split("\n").map((s) => s.trim()).filter(Boolean)]
    const feeLines: FeeLineDraft[] = feeRows
      .filter((r) => r.label.trim().length > 0 && r.qty > 0)
      .map((r) => ({ dept: r.dept, label: r.label, qty: r.qty, unit: r.unit, unitPrice: r.unitPrice }))
    const result = dispatch(
      { type: "review_decide", decision, conditions, feeLines, internalNote: internalNote.trim() || undefined, message: message.trim() || undefined },
      decision === "deny" ? "Section denied." : "Review decided.",
    )
    if (result.ok) onClose()
    else setError(result.reason ?? "That review could not be decided.")
  }

  return (
    <>
      <PanelHeader title="Decide your review" />
      <PanelBody>
        {!check.ok ? <InlineAlert variant="warning">{check.reason}</InlineAlert> : null}
        <fieldset className="flex flex-col gap-2">
          <legend className="text-eyebrow mb-1 font-bold tracking-[.12em] text-fg-label uppercase">Decision</legend>
          <RadioGroup value={decision} onValueChange={(v) => setDecision(v as ReviewDecision)} className="gap-2">
            {(Object.keys(DECISION_LABEL) as ReviewDecision[]).map((d) => (
              <div key={d} className="flex items-center gap-2">
                <RadioGroupItem value={d} id={`decision-${d}`} />
                <Label htmlFor={`decision-${d}`} className="normal-case">
                  {DECISION_LABEL[d]}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </fieldset>

        {decision !== "deny" ? (
          <>
            {templates.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Conditions</p>
                <ul className="flex flex-col gap-1.5">
                  {templates.map((text) => (
                    <li key={text} className="flex items-start gap-2">
                      <Checkbox checked={checkedTemplates.has(text)} onCheckedChange={() => toggleTemplate(text)} className="mt-0.5" aria-label={text} />
                      <span className="text-sm text-fg">{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Field label="More conditions" hint="One per line.">
              <Textarea rows={3} value={freeText} onChange={(e) => setFreeText(e.target.value)} />
            </Field>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Fee lines</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => setFeeRows((rows) => [...rows, emptyFeeRow(dept)])}>
                  <PlusIcon data-icon="inline-start" />
                  Add line
                </Button>
              </div>
              {feeRows.length === 0 ? <p className="text-sm text-fg-secondary">No fee lines added.</p> : null}
              {feeRows.map((row) => (
                <div key={row.key} className="grid grid-cols-[1fr_4.5rem_5rem_5.5rem_auto] items-center gap-1.5">
                  <Input aria-label="Label" placeholder="Label" value={row.label} onChange={(e) => updateRow(row.key, { label: e.target.value })} />
                  <Input aria-label="Quantity" type="number" min="0" step="0.5" value={row.qty} onChange={(e) => updateRow(row.key, { qty: Number(e.target.value) || 0 })} />
                  <Input aria-label="Unit" placeholder="unit" value={row.unit} onChange={(e) => updateRow(row.key, { unit: e.target.value })} />
                  <Input
                    aria-label="Unit price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.unitPrice}
                    onChange={(e) => updateRow(row.key, { unitPrice: Number(e.target.value) || 0 })}
                  />
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove line" onClick={() => setFeeRows((rows) => rows.filter((r) => r.key !== row.key))}>
                    <Trash2Icon />
                  </Button>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <Field label="Internal note" hint="City staff only; never shown to the applicant.">
          <Textarea rows={2} value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
        </Field>
        <Field label="Message to the applicant">
          <Textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
      </PanelBody>
      <PanelActions
        error={error}
        onCancel={onClose}
        submitLabel={DECISION_LABEL[decision]}
        submitVariant={decision === "deny" ? "destructive" : "primary"}
        disabled={!check.ok}
        onSubmit={submit}
      />
    </>
  )
}

export { ReviewDecidePanel }
