"use client"

import * as React from "react"
import { cn } from "cn"
import { CogIcon, UsersIcon, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PartyAvatar } from "@/components/domain/PartyAvatar"
import { fmtDateTime } from "@/lib/format"
import { PARTIES, type Activity, type Actor, type Party } from "@/lib/types"

const SYSTEM_ACTOR_ICON: Record<"system" | "neighbor", LucideIcon> = {
  system: CogIcon,
  neighbor: UsersIcon,
}
const SYSTEM_ACTOR_LABEL: Record<"system" | "neighbor", string> = {
  system: "System",
  neighbor: "Neighbor",
}

function isParty(actor: Actor): actor is Party {
  return (PARTIES as string[]).includes(actor)
}

function ActorAvatar({ actor }: { actor: Actor }) {
  if (isParty(actor)) return <PartyAvatar party={actor} size="sm" />
  const Icon = SYSTEM_ACTOR_ICON[actor]
  return (
    <span
      title={SYSTEM_ACTOR_LABEL[actor]}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-line-subtle bg-surface-2 text-fg-label"
    >
      <Icon className="size-3" aria-hidden="true" />
      <span className="sr-only">{SYSTEM_ACTOR_LABEL[actor]}</span>
    </span>
  )
}

interface ActivityTimelineProps extends React.ComponentProps<"div"> {
  /** Already in the order to render; the component does not sort. */
  items: Activity[]
  /** When set, shows only the latest N with a "Show all" button. */
  collapsedCount?: number
}

/** The case's activity log: actor avatar, text, and a mono timestamp via fmtDateTime. */
function ActivityTimeline({ items, collapsedCount, className, ...props }: ActivityTimelineProps) {
  const [expanded, setExpanded] = React.useState(false)
  const hasMore = Boolean(collapsedCount) && items.length > (collapsedCount as number)
  const visible = hasMore && !expanded ? items.slice(0, collapsedCount) : items

  return (
    <div data-slot="activity-timeline" className={cn("flex flex-col gap-4", className)} {...props}>
      <ol className="flex flex-col gap-4">
        {visible.map((item, index) => (
          <li key={`${item.at}-${index}`} className="flex gap-3">
            <ActorAvatar actor={item.actor} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
              <p className="text-sm text-fg">{item.text}</p>
              <span className="font-mono text-[11px] tabular-nums text-fg-label">{fmtDateTime(item.at)}</span>
            </div>
          </li>
        ))}
      </ol>
      {hasMore && !expanded ? (
        <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setExpanded(true)}>
          Show all {items.length}
        </Button>
      ) : null}
    </div>
  )
}

export { ActivityTimeline }
