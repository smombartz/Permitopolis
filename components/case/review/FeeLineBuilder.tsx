"use client"

/**
 * Estimated fee lines for a decision: one preset button per rate the fee schedule gives this
 * department, a manual row for anything else, a running total, and a note of the lines the
 * plan's own estimate already carries, so nothing is charged twice (workstream 4C's review
 * panel and its closeout).
 */
import * as React from "react"
import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Money } from "@/components/domain"
import { FeeLineFields, feeLineAmount } from "@/components/case/FeeLineFields"
import type { FeeLineDraft } from "@/lib/state/actions"
import type { FeeLine } from "@/lib/types"

export interface FeeRow extends FeeLineDraft {
  key: string
}

let feeRowSeq = 0
function nextFeeRowKey(): string {
  feeRowSeq += 1
  return `row-${feeRowSeq}`
}

export function emptyFeeRow(dept: FeeLineDraft["dept"]): FeeRow {
  return { key: nextFeeRowKey(), dept, label: "", qty: 1, unit: "each", unitPrice: 0 }
}

function toFeeRow(draft: FeeLineDraft): FeeRow {
  return { key: nextFeeRowKey(), ...draft }
}

export function feeRowTotal(rows: FeeRow[]): number {
  return Math.round(rows.reduce((sum, r) => sum + feeLineAmount(r), 0) * 100) / 100
}

interface FeeLineBuilderProps {
  presets: FeeLineDraft[]
  existing: FeeLine[]
  value: FeeRow[]
  onChange: (next: FeeRow[]) => void
}

function FeeLineBuilder({ presets, existing, value, onChange }: FeeLineBuilderProps) {
  function addPreset(preset: FeeLineDraft) {
    onChange([...value, toFeeRow(preset)])
  }

  function addBlank() {
    onChange([...value, emptyFeeRow(presets[0]?.dept ?? "pws")])
  }

  function updateRow(key: string, patch: Partial<FeeRow>) {
    onChange(value.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function removeRow(key: string) {
    onChange(value.filter((r) => r.key !== key))
  }

  return (
    <div className="flex flex-col gap-3">
      {existing.length > 0 ? (
        <div className="flex flex-col gap-1 rounded-control border border-line-subtle bg-surface-2 px-3 py-2">
          <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Already on the estimate</p>
          <ul className="flex flex-col gap-0.5">
            {existing.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 text-xs text-fg-secondary">
                <span>
                  {l.label} &middot; {l.qty} {l.unit}
                </span>
                <Money amount={l.estimate} className="font-mono" />
              </li>
            ))}
          </ul>
          <p className="text-xs text-fg-secondary">These are already counted; add a line below only for something new.</p>
        </div>
      ) : null}

      {presets.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <Button key={preset.label} type="button" variant="secondary" size="sm" onClick={() => addPreset(preset)}>
              <PlusIcon data-icon="inline-start" />
              {preset.label}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Fee lines</p>
          <Button type="button" variant="ghost" size="sm" onClick={addBlank}>
            <PlusIcon data-icon="inline-start" />
            Add line
          </Button>
        </div>
        {value.length === 0 ? (
          <p className="text-sm text-fg-secondary">No fee lines added.</p>
        ) : (
          value.map((row) => <FeeLineFields key={row.key} line={row} onChange={(patch) => updateRow(row.key, patch)} onRemove={() => removeRow(row.key)} />)
        )}
        {value.length > 0 ? (
          <div className="flex items-center justify-between border-t border-line-subtle pt-2 text-sm">
            <span className="font-semibold text-fg">Running total</span>
            <Money amount={feeRowTotal(value)} className="font-mono font-semibold" />
          </div>
        ) : null}
      </div>
    </div>
  )
}

export { FeeLineBuilder }
