import Link from "next/link"
import { CheckIcon, ClockIcon } from "lucide-react"
import { Money } from "@/components/domain/Money"
import { Button } from "@/components/ui/button"
import { SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { fmtDateShort } from "@/lib/format"
import { routes } from "@/lib/routes"
import { useDemo } from "@/lib/state"
import type { EventCase } from "@/lib/types"
import { seriesSessions } from "@/lib/view/board"

const BILLING_LABEL: Record<string, string> = {
  paid: "Paid",
  due: "Due now",
  upcoming: "Upcoming",
  skipped: "Skipped",
};

/** A series' "Pay fees and deposit" card opens this instead of a form: every session, its status, and a pay link for the ones still owed. */
function SeriesScheduleSheet({ c }: { c: EventCase }) {
  const cfg = useDemo((s) => s.cfg)
  const rows = seriesSessions(c, cfg)

  return (
    <SheetContent>
      <SheetHeader>
        <SheetTitle>Session schedule</SheetTitle>
        <SheetDescription>{rows.length} sessions, {rows[0] ? <Money amount={rows[0].amount} /> : null} each.</SheetDescription>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-5 py-4">
        {rows.map((row) => {
          const payable = row.billing === "due" || row.billing === "upcoming"
          return (
            <div key={row.date} className="flex items-center justify-between gap-3 rounded-control border border-line-subtle bg-surface-2 px-3 py-2.5 text-sm">
              <div className="flex items-center gap-2">
                {row.billing === "paid" ? (
                  <CheckIcon className="size-3.5 shrink-0 text-success-fg" aria-hidden="true" />
                ) : (
                  <ClockIcon className="size-3.5 shrink-0 text-fg-label" aria-hidden="true" />
                )}
                <span className="text-fg">{fmtDateShort(row.date)}</span>
                <span className="text-xs text-fg-secondary">{BILLING_LABEL[row.billing]}</span>
              </div>
              {payable ? (
                <Button asChild size="sm" variant="secondary">
                  <Link href={routes.quote(c.id, { pay: "session", date: row.date })}>
                    Pay this session
                  </Link>
                </Button>
              ) : (
                <Money amount={row.amount} />
              )}
            </div>
          )
        })}
      </div>
    </SheetContent>
  )
}

export { SeriesScheduleSheet }
