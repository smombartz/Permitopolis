import { cn } from "cn"
import { TIER_LABEL, type Tier } from "@/lib/types"
import { TIER_ICON } from "@/components/domain/icons"

const TIER_CLASS: Record<Tier, string> = {
  instant: "border-tier-instant-border bg-tier-instant-surface text-tier-instant-fg",
  reviewed: "border-tier-reviewed-border bg-tier-reviewed-surface text-tier-reviewed-fg",
  special: "border-tier-special-border bg-tier-special-surface text-tier-special-fg",
}

interface TierBadgeProps extends React.ComponentProps<"span"> {
  tier: Tier
}

/** Outline micro-badge, name spelled out: Instant / Standard / Special event. */
function TierBadge({ tier, className, ...props }: TierBadgeProps) {
  const Icon = TIER_ICON[tier]
  return (
    <span
      data-slot="tier-badge"
      data-tier={tier}
      className={cn(
        "inline-flex h-7 w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold whitespace-nowrap",
        TIER_CLASS[tier],
        className
      )}
      {...props}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {TIER_LABEL[tier]}
    </span>
  )
}

export { TierBadge }
