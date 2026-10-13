import Link from "next/link"
import { BillingBadge } from "@/components/domain/BillingBadge"
import { DateText } from "@/components/domain/DateText"
import { Money } from "@/components/domain/Money"
import { Button } from "@/components/ui/button"
import { SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Stat } from "@/components/ui/stat"
import { fmtDateShort, plural } from "@/lib/format"
import { useDemo } from "@/lib/state"
import type { EventCase } from "@/lib/types"
import { seriesSessions, seriesTotals } from "@/lib/view/board"

/**
 * A series' "Pay fees and deposit" card opens this once the booking or the quote is paid:
 * every session with where it stands, the total paid and outstanding, and a pay link for the
 * one session the checkout takes now (PRD "Applicant to-do board", series).
 */
function SeriesScheduleSheet({ c }: { c: EventCase }) {
  const cfg = useDemo((s) => s.cfg)
  const rows = seriesSessions(c, cfg)
  const totals = seriesTotals(c, cfg)
  const dueNow = rows.find((row) => row.billing === "due" && row.payHref)

  return (
    <SheetContent>
      <SheetHeader>
        <SheetTitle>Session schedule</SheetTitle>
        <SheetDescription>
          {plural(rows.length, "session")}, {rows[0] ? <Money amount={rows[0].amount} /> : null} each.
        </SheetDescription>
        <div className="flex gap-6 pt-1">
          <Stat label="Paid" value={<Money amount={totals.paid} />} />
          <Stat label="Outstanding" value={<Money amount={totals.outstanding} />} />
        </div>
        {dueNow ? (
          <Button asChild className="self-start">
            <Link href={dueNow.payHref!}>Pay the session due <DateText date={dueNow.date} short /></Link>
          </Button>
        ) : null}
      </SheetHeader>
      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-5 py-4">
        {rows.map((row) => (
          <li key={row.date} className="flex items-center justify-between gap-3 rounded-control border border-line-subtle bg-surface-2 px-3 py-2.5 text-sm">
            <div className="flex items-center gap-2.5">
              <DateText date={row.date} short />
              <BillingBadge billing={row.billing} />
            </div>
            {row.payHref ? (
              <Button asChild size="sm" variant="secondary">
                <Link href={row.payHref} aria-label={`Pay this session: ${fmtDateShort(row.date)}`}>
                  Pay this session
                </Link>
              </Button>
            ) : (
              <Money amount={row.amount} />
            )}
          </li>
        ))}
      </ul>
    </SheetContent>
  )
}

export { SeriesScheduleSheet }
