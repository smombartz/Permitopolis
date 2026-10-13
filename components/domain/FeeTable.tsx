import { cn } from "cn"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Money } from "@/components/domain/Money"
import { DEPTS, PARTY_LABEL, type Dept, type FeeLine } from "@/lib/types"

/** Fee and late-fee lines grouped by department; deposit lines never group under one. */
export function groupFeeLinesByDept(lines: FeeLine[]): Partial<Record<Dept, FeeLine[]>> {
  const groups: Partial<Record<Dept, FeeLine[]>> = {}
  for (const line of lines) {
    if (line.kind === "deposit") continue
    const group = groups[line.dept] ?? (groups[line.dept] = [])
    group.push(line)
  }
  return groups
}

export function sumFeeLines(lines: FeeLine[]): number {
  return lines.reduce((total, line) => total + line.estimate, 0)
}

function SummaryRow({ label, amount, emphasized = false }: { label: React.ReactNode; amount: number; emphasized?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 text-sm", emphasized ? "font-bold text-fg" : "text-fg-secondary")}>
      <span>{label}</span>
      <Money amount={amount} className={emphasized ? "text-sm font-bold text-fg" : undefined} />
    </div>
  )
}

interface FeeTableProps extends React.ComponentProps<"div"> {
  lines: FeeLine[]
  /** Adds Actual and Difference columns, for closeout reconciliation. */
  showActual?: boolean
  /**
   * Two columns for a narrow box (the wizard's 320px panel, a phone): the line with its
   * quantity and unit price beneath it, and the amount. The four-column table is about 430px at
   * its narrowest, so there the amount per line would be scrolled out of view.
   */
  compact?: boolean
}

function LineLabel({ line }: { line: FeeLine }) {
  return (
    <>
      {line.label}
      {line.kind === "late_fee" ? (
        <Badge variant="warning" className="ml-2">
          Late fee
        </Badge>
      ) : null}
    </>
  )
}

/** One department's lines in two columns: the line (wrapping) over "qty unit × price", and the amount. */
function CompactLines({ lines, showActual }: { lines: FeeLine[]; showActual: boolean }) {
  return (
    <Table data-layout="compact">
      <TableHeader>
        <TableRow>
          <TableHead>Line</TableHead>
          <TableHead className="text-right">Estimate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line) => (
          <TableRow key={line.id}>
            <TableCell className="h-auto py-2 whitespace-normal">
              <span className="block text-fg">
                <LineLabel line={line} />
              </span>
              <span className="block font-mono text-xs text-fg-label tabular-nums">
                {line.qty} {line.unit} × <Money amount={line.unitPrice} className="text-xs" />
              </span>
            </TableCell>
            <TableCell numeric className="h-auto py-2 text-right align-top">
              <Money amount={line.estimate} />
              {showActual ? (
                <span className="block text-xs text-fg-label">
                  {line.actual !== null ? (
                    <>
                      Actual <Money amount={line.actual} className="text-xs" />
                    </>
                  ) : (
                    "Not logged"
                  )}
                </span>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** Fee lines grouped by department, with a subtotal, the deposit and the total. */
function FeeTable({ lines, showActual = false, compact = false, className, ...props }: FeeTableProps) {
  const groups = groupFeeLinesByDept(lines)
  const feeLines = lines.filter((line) => line.kind !== "deposit")
  const depositLines = lines.filter((line) => line.kind === "deposit")
  const feesSubtotal = sumFeeLines(feeLines)
  const depositTotal = sumFeeLines(depositLines)
  const total = feesSubtotal + depositTotal
  const actualTotal = showActual ? lines.reduce((sum, l) => sum + (l.actual ?? l.estimate), 0) : null

  return (
    <div data-slot="fee-table" className={cn("flex flex-col gap-5", className)} {...props}>
      {DEPTS.filter((dept) => (groups[dept]?.length ?? 0) > 0).map((dept) => (
        <div key={dept} className="flex flex-col gap-1.5">
          <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">{PARTY_LABEL[dept]}</p>
          {compact ? (
            <CompactLines lines={groups[dept] ?? []} showActual={showActual} />
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Line</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Estimate</TableHead>
                {showActual ? (
                  <>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                  </>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(groups[dept] ?? []).map((line) => {
                const diff = line.actual !== null ? line.actual - line.estimate : null
                return (
                  <TableRow key={line.id}>
                    <TableCell>
                      <LineLabel line={line} />
                    </TableCell>
                    <TableCell numeric className="text-right">
                      {line.qty} {line.unit}
                    </TableCell>
                    <TableCell numeric className="text-right">
                      <Money amount={line.unitPrice} />
                    </TableCell>
                    <TableCell numeric className="text-right">
                      <Money amount={line.estimate} />
                    </TableCell>
                    {showActual ? (
                      <>
                        <TableCell numeric className="text-right">
                          {line.actual !== null ? <Money amount={line.actual} /> : <span className="text-fg-label">Not logged</span>}
                        </TableCell>
                        <TableCell numeric className="text-right">
                          {diff !== null ? <Money amount={diff} signColor /> : <span className="text-fg-label">—</span>}
                        </TableCell>
                      </>
                    ) : null}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          )}
        </div>
      ))}
      <div className="flex flex-col gap-1.5 border-t border-line-subtle pt-3">
        <SummaryRow label="Subtotal of fees" amount={feesSubtotal} />
        {depositLines.map((line) => (
          <SummaryRow key={line.id} label={line.label} amount={line.estimate} />
        ))}
        <SummaryRow label="Total" amount={total} emphasized />
        {showActual && actualTotal !== null ? <SummaryRow label="Actual total" amount={actualTotal} /> : null}
      </div>
    </div>
  )
}

export { FeeTable }
