import Link from "next/link"
import { TicketIcon } from "lucide-react"
import { StateChip } from "@/components/domain/StateChip"
import { TierBadge } from "@/components/domain/TierBadge"
import { DueDate } from "@/components/domain/DueDate"
import { Truncate } from "@/components/ui/truncate"
import { fmtDaysToGo } from "@/lib/format"
import { eventDate } from "@/lib/state"
import type { ISODate } from "@/lib/types"
import type { MyEventsItem } from "@/lib/view/board"

interface EventRowProps {
  item: MyEventsItem
  today: ISODate
}

/** One row of My events: the event's identity, its state, the next move, and where it goes. */
function EventRow({ item, today }: EventRowProps) {
  const c = item.case
  const date = eventDate(c, today)

  return (
    <div className="flex flex-col gap-3 rounded-panel border border-line-subtle bg-surface-1 p-4 transition-colors duration-[var(--dur-fast)] ease-frost sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <Link
        href={item.href}
        className="group/row flex min-w-0 flex-1 flex-col gap-2 rounded-control outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Truncate text={c.name} className="text-sm font-semibold text-fg group-hover/row:underline" />
          <TierBadge tier={c.tier} />
          <StateChip state={c.state} ending={c.ending} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-secondary">
          {date ? (
            <span>{fmtDaysToGo(date, today)}</span>
          ) : (
            <span>No date yet</span>
          )}
          <span aria-hidden="true">·</span>
          <span className="font-medium text-fg">{item.nextActionText}</span>
          {item.nextActionDue ? <DueDate date={item.nextActionDue} today={today} relativeOnly /> : null}
        </div>
      </Link>
      {item.permitHref ? (
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href={item.permitHref}
            // One per permitted event on the page: the name says whose permit, after the words on the link.
            aria-label={`View permit for ${c.name}`}
            className="inline-flex items-center gap-1.5 rounded-control text-sm font-medium text-fg-accent underline-offset-4 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring pointer-coarse:min-h-11"
          >
            <TicketIcon className="size-4" aria-hidden="true" />
            View permit
          </Link>
        </div>
      ) : null}
    </div>
  )
}

export { EventRow }
