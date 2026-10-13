import Link from "next/link"
import { BillingBadge } from "@/components/domain/BillingBadge"
import { DateText } from "@/components/domain/DateText"
import { Money } from "@/components/domain/Money"
import { Button } from "@/components/ui/button"
import { SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { plural } from "@/lib/format"
import { useDemo } from "@/lib/state"
import type { EventCase } from "@/lib/types"
import { seriesSessions } from "@/lib/view/board"

/**
 * A series' "Pay fees and deposit" card opens this once the booking or the quote is paid:
 * every session with where it stands, and a pay link for each one the checkout takes now.
 */
function SeriesScheduleSheet({ c }: { c: EventCase }) {
  const cfg = useDemo((s) => s.cfg)
  const rows = seriesSessions(c, cfg)

  return (
    <SheetContent>
      <SheetHeader>
        <SheetTitle>Session schedule</SheetTitle>
        <SheetDescription>
          {plural(rows.length, "session")}, {rows[0] ? <Money amount={rows[0].amount} /> : null} each.
        </SheetDescription>
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
                <Link href={row.payHref}>Pay this session</Link>
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
