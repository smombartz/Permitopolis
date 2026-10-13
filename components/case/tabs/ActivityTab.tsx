"use client"

import * as React from "react"
import { ActivityTimeline } from "@/components/domain"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/components/ui/empty-state"
import { HistoryIcon } from "lucide-react"
import { PARTY_LABEL, type Actor, type EventCase } from "@/lib/types"
import { activityActors, filterActivity } from "@/lib/view/caseDetail"

const ACTOR_LABEL: Record<Actor, string> = {
  applicant: "Applicant",
  clerk: PARTY_LABEL.clerk,
  pws: PARTY_LABEL.pws,
  hl: PARTY_LABEL.hl,
  system: "System",
  neighbor: "Neighbor",
}

interface ActivityTabProps {
  c: EventCase
}

function ActivityTab({ c }: ActivityTabProps) {
  const [actor, setActor] = React.useState<Actor | "all">("all")
  const actors = activityActors(c)

  if (c.activity.length === 0) {
    return <EmptyState icon={HistoryIcon} title="No activity yet" text="Every step the applicant and city staff take on this case will be logged here, newest first." />
  }

  const items = filterActivity(c, actor)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-fg-secondary">{items.length} of {c.activity.length} entries</p>
        <Select value={actor} onValueChange={(v) => setActor(v as Actor | "all")}>
          <SelectTrigger size="sm" aria-label="Filter by actor">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            {actors.map((a) => (
              <SelectItem key={a} value={a}>
                {ACTOR_LABEL[a]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ActivityTimeline items={items} collapsedCount={10} />
    </div>
  )
}

export { ActivityTab }
