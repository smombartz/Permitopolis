"use client"

import { ConditionList, FeeTable, Money } from "@/components/domain"
import { Section } from "@/components/ui/section"
import { Stat } from "@/components/ui/stat"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fmtDateTime, fmtMoney } from "@/lib/format"
import { EmptyState } from "@/components/ui/empty-state"
import { ReceiptIcon } from "lucide-react"
import { caseTotals } from "@/lib/state"
import { paymentRows } from "@/lib/view/clerkTools"
import type { EventCase } from "@/lib/types"
import { CloseoutSettlementStats } from "../CloseoutSettlementStats"

const METHOD_LABEL: Record<"card" | "in_person", string> = { card: "Card", in_person: "In person" };

interface ConditionsFeesTabProps {
  c: EventCase
}

function ConditionsFeesTab({ c }: ConditionsFeesTabProps) {
  const showActual = c.state === "closeout" || c.state === "closed"
  const totals = caseTotals(c)
  // The actual costs are in and the Clerk has not reconciled yet.
  const settling = c.state === "closeout" && c.ending === null && c.closeout.hoursLoggedOn !== null && c.closeout.balance === null
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
      {settling ? (
        // In Closeout nothing is "due" the way a quote is: an overage comes out of the deposit
        // first. Total, Paid, Due would read "$750 due" with a $1,000 deposit in hand.
        <Section title="How this settles" description="The overage comes out of the deposit; what is left goes back, or the rest is billed.">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Stat label="Paid" value={fmtMoney(totals.paid)} />
            <Stat label="Deposit held" value={fmtMoney(totals.deposit)} />
            <CloseoutSettlementStats c={c} className="contents" />
          </div>
        </Section>
      ) : (
        <Section title="Payments and what is due">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Total" value={fmtMoney(totals.total)} />
            <Stat label="Paid" value={fmtMoney(totals.paid)} />
            <Stat label="Due" value={fmtMoney(totals.due)} />
            <Stat label="Deposit" value={fmtMoney(totals.deposit)} />
          </div>
        </Section>
      )}
      {c.payments.length > 0 ? (
        <Section title="Payments and refunds">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>What</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentRows(c).map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{fmtDateTime(row.at)}</TableCell>
                  <TableCell>{row.label}</TableCell>
                  <TableCell>{METHOD_LABEL[row.method]}</TableCell>
                  <TableCell numeric className="text-right">
                    <Money amount={row.amount} signColor />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      ) : null}
    </div>
  )
}

export { ConditionsFeesTab }
