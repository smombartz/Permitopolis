"use client"

/**
 * One fee line as a reviewer or the Clerk edits it: label, quantity, unit, unit price, the
 * amount they come to, and a remove button. The review panel's fee lines and the quote builder's
 * are the same row, so a line reads and edits the same way in both.
 */
import { Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Money } from "@/components/domain"

export interface FeeLineValues {
  label: string
  qty: number
  unit: string
  unitPrice: number
}

/** To the cent: 2.5 hours at $85 is $212.50, never 212.49999. */
export function feeLineAmount(line: Pick<FeeLineValues, "qty" | "unitPrice">): number {
  return Math.round(line.qty * line.unitPrice * 100) / 100
}

interface FeeLineFieldsProps {
  line: FeeLineValues
  onChange: (patch: Partial<FeeLineValues>) => void
  onRemove: () => void
}

/**
 * Each field is named for its line ("Unit price: Police"), so several rows on screen are told
 * apart by a screen reader. A new line has no label yet and its fields are plainly "Label",
 * "Quantity", "Unit" and "Unit price".
 */
function FeeLineFields({ line, onChange, onRemove }: FeeLineFieldsProps) {
  const named = (field: string) => (line.label.trim() ? `${field}: ${line.label.trim()}` : field)
  return (
    <div
      data-slot="fee-line-fields"
      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] items-center gap-1.5 sm:grid-cols-[minmax(8rem,1fr)_4.5rem_5rem_5.5rem_5rem_auto]"
    >
      <Input aria-label={named("Label")} placeholder="Label" className="col-span-full sm:col-span-1" value={line.label} onChange={(e) => onChange({ label: e.target.value })} />
      <Input aria-label={named("Quantity")} type="number" min="0" step="0.5" value={line.qty} onChange={(e) => onChange({ qty: Number(e.target.value) || 0 })} />
      <Input aria-label={named("Unit")} placeholder="unit" value={line.unit} onChange={(e) => onChange({ unit: e.target.value })} />
      <Input aria-label={named("Unit price")} type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => onChange({ unitPrice: Number(e.target.value) || 0 })} />
      <Money amount={feeLineAmount(line)} className="text-right text-sm" />
      <Button type="button" variant="ghost" size="icon-sm" aria-label={line.label.trim() ? `Remove line: ${line.label.trim()}` : "Remove line"} onClick={onRemove}>
        <Trash2Icon />
      </Button>
    </div>
  )
}

export { FeeLineFields }
