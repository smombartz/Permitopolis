import { cn } from "cn"
import { TIER_LABEL, type Tier } from "@/lib/types"
import { TIER_ICON } from "@/components/domain/icons"

const TIERS: Tier[] = ["instant", "reviewed", "special"]

const TIER_DOT: Record<Tier, string> = {
  instant: "bg-tier-instant",
  reviewed: "bg-tier-reviewed",
  special: "bg-tier-special",
}

interface TierLegendProps extends React.ComponentProps<"ul"> {
  /** What the legend belongs to, for a screen reader: "Map legend: tiers". */
  "aria-label": string
}

/**
 * The key to a view that colors its items by tier (the map, the calendar): each tier's dot,
 * icon and name, so the color never carries the tier alone.
 */
function TierLegend({ className, ...props }: TierLegendProps) {
  return (
    <ul data-slot="tier-legend" className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)} {...props}>
      {TIERS.map((tier) => {
        const Icon = TIER_ICON[tier]
        return (
          <li key={tier} className="flex items-center gap-1.5 text-xs text-fg-secondary">
            <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", TIER_DOT[tier])} />
            <Icon aria-hidden="true" className="size-3 shrink-0" />
            {TIER_LABEL[tier]}
          </li>
        )
      })}
    </ul>
  )
}

export { TierLegend }
