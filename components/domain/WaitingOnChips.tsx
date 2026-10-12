import { cn } from "cn"
import { PartyChip } from "@/components/domain/PartyChip"
import type { Party } from "@/lib/types"

export interface WaitingOnEntry {
  party: Party
  /** Days holding the open item, e.g. 4 renders "Applicant · 4d". */
  days: number
}

interface WaitingOnChipsProps extends React.ComponentProps<"div"> {
  items: WaitingOnEntry[]
  emptyText?: string
}

/** A row of "Applicant · 4d" style chips for whoever a case is waiting on. */
function WaitingOnChips({ items, emptyText = "Nothing waiting", className, ...props }: WaitingOnChipsProps) {
  if (items.length === 0) {
    return (
      <p data-slot="waiting-on-chips" className={cn("text-sm text-fg-secondary", className)}>
        {emptyText}
      </p>
    )
  }
  return (
    <div data-slot="waiting-on-chips" className={cn("flex flex-wrap gap-1.5", className)} {...props}>
      {items.map((item) => (
        <PartyChip key={item.party} party={item.party} suffix={`${item.days}d`} />
      ))}
    </div>
  )
}

export { WaitingOnChips }
