"use client"

import * as React from "react"
import { ActivityTimeline } from "@/components/domain"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/components/ui/empty-state"
import { HistoryIcon } from "lucide-react"
import { fmtDate } from "@/lib/format"
import { PARTY_LABEL, type Actor, type EventCase, type Party } from "@/lib/types"
import { activityActors, filterActivity, groupActivityByDay, lastActedAt, sinceLastActedCount, type ActivityDayGroup } from "@/lib/view/caseDetail"

const ACTOR_LABEL: Record<Actor, string> = {
  applicant: "Applicant",
  clerk: PARTY_LABEL.clerk,
  pws: PARTY_LABEL.pws,
  hl: PARTY_LABEL.hl,
  system: "System",
  neighbor: "Neighbor",
}

/** Shows at least this many entries before collapsing the rest behind "Show all". */
const COLLAPSE_COUNT = 10

interface ActivityTabProps {
  c: EventCase
  /** The viewing role, for the "Since you last acted" marker. */
  role: Party
}

/** The grouped days to show now: all of them once expanded, or enough from the top for 10 entries. */
function visibleGroups(groups: ActivityDayGroup[], expanded: boolean): ActivityDayGroup[] {
  if (expanded) return groups;
  const shown: ActivityDayGroup[] = [];
  let count = 0;
  for (const group of groups) {
    shown.push(group);
    count += group.items.length;
    if (count >= COLLAPSE_COUNT) break;
  }
  return shown;
}

function ActivityTab({ c, role }: ActivityTabProps) {
  const [actor, setActor] = React.useState<Actor | "all">("all")
  const [expanded, setExpanded] = React.useState(false)

  if (c.activity.length === 0) {
    return <EmptyState icon={HistoryIcon} title="No activity yet" text="Every step the applicant and city staff take on this case will be logged here, newest first." />
  }

  const actors = activityActors(c)
  const items = filterActivity(c, actor)
  const groups = groupActivityByDay(items)
  const lastActed = lastActedAt(c, role)
  const lastActedDay = lastActed ? lastActed.slice(0, 10) : null
  // How many of the newest entries happened after this role's own last activity entry; used
  // only to place the marker, since a filtered or collapsed view may not show all of them.
  const sinceCount = sinceLastActedCount(items, lastActed)
  const shown = visibleGroups(groups, expanded)
  const hasMore = shown.length < groups.length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-fg-secondary">
          {items.length} of {c.activity.length} entries
        </p>
        <Select value={actor} onValueChange={(v) => setActor(v as Actor | "all")}>
          <SelectTrigger size="sm" aria-label="Filter by party">
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

      {sinceCount !== null && sinceCount === 0 ? <p className="text-xs text-fg-secondary">Nothing new since you last acted.</p> : null}

      <div className="flex flex-col gap-5">
        {shown.map((group, index) => {
          // The marker sits right before the first day that is no later than this role's own
          // last entry: everything above it happened since, everything at or below it is what
          // this role already saw.
          const isNew = lastActedDay !== null && group.day > lastActedDay;
          const previousWasNew = index > 0 && lastActedDay !== null && shown[index - 1].day > lastActedDay;
          const showMarker = sinceCount !== null && sinceCount > 0 && !isNew && (index === 0 || previousWasNew);
          return (
            <div key={group.day} className="flex flex-col gap-2">
              {showMarker ? (
                <div role="separator" aria-label="Since you last acted" className="flex items-center gap-2 text-xs font-semibold text-fg-pill">
                  <span aria-hidden="true" className="h-px flex-1 bg-pill-border" />
                  Since you last acted
                  <span aria-hidden="true" className="h-px flex-1 bg-pill-border" />
                </div>
              ) : null}
              <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">{fmtDate(group.day)}</p>
              <ActivityTimeline items={group.items} />
            </div>
          );
        })}
      </div>

      {hasMore ? (
        <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setExpanded(true)}>
          Show all {items.length}
        </Button>
      ) : null}
    </div>
  )
}

export { ActivityTab }
