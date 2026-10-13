"use client"

import { ConditionList, FeeTable, Money } from "@/components/domain"
import { Section } from "@/components/ui/section"
import { EmptyState } from "@/components/ui/empty-state"
import { ReceiptIcon } from "lucide-react"
import { caseTotals } from "@/lib/state"
import type { EventCase } from "@/lib/types"

interface ConditionsFeesTabProps {
  c: EventCase
}

function ConditionsFeesTab({ c }: ConditionsFeesTabProps) {
  const showActual = c.state === "closeout" || c.state === "closed"
  const totals = caseTotals(c)
  const hasAnything = c.conditions.length > 0 || c.feeLines.length > 0

  if (!hasAnything) {
    return (
      <EmptyState
        icon={ReceiptIcon}
        title="No conditions or fees yet"
        text="Once the case is routed and reviewed, each department's conditions and fee lines will appear here, merged into the quote."
      />
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <Section title="Conditions">
        {c.conditions.length > 0 ? <ConditionList conditions={c.conditions} /> : <p className="text-sm text-fg-secondary">No conditions yet.</p>}
      </Section>
      <Section title="Fees">
        {c.feeLines.length > 0 ? (
          <FeeTable lines={c.feeLines} showActual={showActual} />
        ) : (
          <p className="text-sm text-fg-secondary">No fee lines yet.</p>
        )}
      </Section>
      <Section title="Payments and what is due">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="flex flex-col gap-0.5">
            <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Total</p>
            <Money amount={totals.total} className="text-sm font-semibold text-fg" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Paid</p>
            <Money amount={totals.paid} className="text-sm font-semibold text-fg" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Due</p>
            <Money amount={totals.due} className="text-sm font-semibold text-fg" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Deposit</p>
            <Money amount={totals.deposit} className="text-sm font-semibold text-fg" />
          </div>
        </div>
      </Section>
    </div>
  )
}

export { ConditionsFeesTab }
