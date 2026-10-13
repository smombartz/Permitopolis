"use client"

import { ConditionList, FeeTable } from "@/components/domain"
import { Section } from "@/components/ui/section"
import { Stat } from "@/components/ui/stat"
import { fmtMoney } from "@/lib/format"
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
          <Stat label="Total" value={fmtMoney(totals.total)} />
          <Stat label="Paid" value={fmtMoney(totals.paid)} />
          <Stat label="Due" value={fmtMoney(totals.due)} />
          <Stat label="Deposit" value={fmtMoney(totals.deposit)} />
        </div>
      </Section>
    </div>
  )
}

export { ConditionsFeesTab }
