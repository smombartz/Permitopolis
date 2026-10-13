"use client"

/** The consolidation panel's merged fee lines: editable rows, grouped by department, with the deposit, the late fee and live totals. */
import * as React from "react"
import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Money } from "@/components/domain"
import { FeeLineFields } from "@/components/case/FeeLineFields"
import { fmtMoney } from "@/lib/format"
import type { QuoteLineRow, QuoteTotals } from "@/lib/view/clerkTools"
import { DEPTS, PARTY_LABEL, type Dept } from "@/lib/types"

let rowSeq = 0
export function nextQuoteRowId(): string {
  rowSeq += 1
  return `new-fee-${rowSeq}`
}

interface QuoteLinesEditorProps {
  rows: QuoteLineRow[]
  deposit: number
  lateFeeAdvice: number | null
  totals: QuoteTotals
  onUpdate: (id: string, patch: Partial<Pick<QuoteLineRow, "dept" | "label" | "qty" | "unit" | "unitPrice">>) => void
  onRemove: (id: string) => void
  onAdd: (row: QuoteLineRow) => void
  onAddLateFee: () => void
}

function groupByDept(rows: QuoteLineRow[]): Partial<Record<Dept, QuoteLineRow[]>> {
  const groups: Partial<Record<Dept, QuoteLineRow[]>> = {}
  for (const row of rows) {
    const group = groups[row.dept] ?? (groups[row.dept] = [])
    group.push(row)
  }
  return groups
}

function AddLineRow({ onAdd }: { onAdd: (row: QuoteLineRow) => void }) {
  const [dept, setDept] = React.useState<Dept>("clerk")
  const [label, setLabel] = React.useState("")

  function add() {
    if (label.trim().length === 0) return
    onAdd({ id: nextQuoteRowId(), dept, label: label.trim(), qty: 1, unit: "each", unitPrice: 0, kind: "fee" })
    setLabel("")
  }

  return (
    <div className="flex items-end gap-2">
      <select
        aria-label="New line's department"
        value={dept}
        onChange={(e) => setDept(e.target.value as Dept)}
        className="h-9 w-40 rounded-control border border-line-subtle bg-surface-1 px-2.5 text-sm text-fg outline-none focus-visible:border-focus-ring focus-visible:shadow-focus-halo"
      >
        {DEPTS.map((d) => (
          <option key={d} value={d}>
            {PARTY_LABEL[d]}
          </option>
        ))}
      </select>
      <Input aria-label="New line's label" className="flex-1" placeholder="New line, e.g. Extra barricades" value={label} onChange={(e) => setLabel(e.target.value)} />
      <Button type="button" variant="secondary" onClick={add} disabled={label.trim().length === 0}>
        <PlusIcon data-icon="inline-start" />
        Add line
      </Button>
    </div>
  )
}

/** Fee lines grouped by department, each editable, with the deposit, an optional late-fee prompt, and live totals. */
function QuoteLinesEditor({ rows, deposit, lateFeeAdvice, totals, onUpdate, onRemove, onAdd, onAddLateFee }: QuoteLinesEditorProps) {
  const groups = groupByDept(rows)

  return (
    <div className="flex flex-col gap-5">
      {DEPTS.filter((d) => (groups[d]?.length ?? 0) > 0).map((dept) => (
        <div key={dept} className="flex flex-col gap-1.5">
          <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">{PARTY_LABEL[dept]}</p>
          {(groups[dept] ?? []).map((row) => (
            <FeeLineFields key={row.id} line={row} onChange={(patch) => onUpdate(row.id, patch)} onRemove={() => onRemove(row.id)} />
          ))}
        </div>
      ))}
      <AddLineRow onAdd={onAdd} />

      {lateFeeAdvice !== null ? (
        <div className="flex items-center justify-between gap-3 rounded-control border border-warning-border bg-warning-surface px-3 py-2 text-sm text-warning-fg">
          <span>This date is inside the lead time; the late fee has not been added to the quote yet ({fmtMoney(lateFeeAdvice)}).</span>
          <Button type="button" variant="secondary" size="sm" onClick={onAddLateFee}>
            Add late fee
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5 border-t border-line-subtle pt-3">
        <div className="flex items-center justify-between text-sm text-fg-secondary">
          <span>Subtotal of fees</span>
          <Money amount={totals.feesSubtotal} />
        </div>
        <div className="flex items-center justify-between text-sm text-fg-secondary">
          <span>Refundable cleanup deposit</span>
          <Money amount={deposit} />
        </div>
        <div className="flex items-center justify-between text-sm font-bold text-fg">
          <span>Total</span>
          <Money amount={totals.total} className="text-sm font-bold text-fg" />
        </div>
      </div>
    </div>
  )
}

export { QuoteLinesEditor }
