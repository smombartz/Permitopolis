import { cn } from "cn"
import { ArrowRightIcon, CheckIcon, ClockIcon, MinusIcon, type LucideIcon } from "lucide-react"
import { DueDate } from "@/components/domain/DueDate"
import { PartyAvatar } from "@/components/domain/PartyAvatar"
import { plural } from "@/lib/format"
import { taskDueDate } from "@/lib/state"
import { PARTY_LABEL, type ISODate } from "@/lib/types"
import type { PartyStanding, PartyStatus } from "@/lib/state/types"

const STATUS_LABEL: Record<PartyStanding, string> = {
  up_now: "Up now",
  done_for_now: "Done for now",
  waiting: "Waiting",
  not_involved: "Not involved",
}

const STATUS_ICON: Record<PartyStanding, LucideIcon> = {
  up_now: ArrowRightIcon,
  done_for_now: CheckIcon,
  waiting: ClockIcon,
  not_involved: MinusIcon,
}

const STATUS_PILL_CLASS: Record<PartyStanding, string> = {
  up_now: "border-pill-border bg-pill text-fg-pill",
  done_for_now: "border-success-border bg-success-surface text-success-fg",
  waiting: "border-line-subtle bg-surface-2 text-fg-secondary",
  not_involved: "border-line-magnetic bg-transparent text-fg-secondary",
}

interface WhoIsUpProps extends React.ComponentProps<"div"> {
  /** Always four rows, applicant/clerk/pws/hl, exactly as `waitingOn()` returns them. */
  items: PartyStatus[]
  today: ISODate
  /** The generated sentence from `nextMove()`, e.g. "Next: ... uploads ..., then ... re-reviews." */
  nextMove: string
  onSelectTask?: (taskId: string) => void
}

/**
 * "Who's up", the case-detail centerpiece (docs/spec/img/wireframe-case-s5.png): one row
 * per party with its status pill, each open action with its own due date (oldest due first,
 * as `waitingOn()` sorts them), and days holding. A party with nothing open shows its note
 * instead. Up-now rows get an indigo wash and a leading bar (plan 3.2 moves this off the
 * wireframe's amber, since indigo is the only action color), not a status-pill color alone.
 */
function WhoIsUp({ items, today, nextMove, onSelectTask, className, ...props }: WhoIsUpProps) {
  return (
    <div
      data-slot="who-is-up"
      className={cn("flex flex-col overflow-hidden rounded-panel border border-line-subtle bg-surface-1", className)}
      {...props}
    >
      <div role="list" aria-label="Who's up" className="flex flex-col divide-y divide-line-subtle">
        {items.map((item) => {
          const StatusIcon = STATUS_ICON[item.status]
          return (
            <div
              key={item.party}
              role="listitem"
              data-status={item.status}
              className={cn(
                "grid grid-cols-1 gap-2 px-4 py-3.5 sm:grid-cols-[1fr_auto_1.4fr] sm:items-center sm:gap-4",
                item.status === "up_now" && "border-l-[3px] border-indigo-650 bg-pill"
              )}
            >
              <div className="flex items-center gap-2.5">
                {/* The name is spelled out beside it, so the tile adds nothing for a screen reader. */}
                <PartyAvatar party={item.party} aria-hidden="true" />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-fg">{PARTY_LABEL[item.party]}</span>
                  <span className="text-xs text-fg-secondary">{item.scope}</span>
                </div>
              </div>
              <span
                className={cn(
                  "inline-flex h-7 w-fit items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold whitespace-nowrap",
                  STATUS_PILL_CLASS[item.status]
                )}
              >
                <StatusIcon className="size-3.5" aria-hidden="true" />
                {STATUS_LABEL[item.status]}
              </span>
              <div className="flex flex-col gap-1">
                {item.openTasks.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {item.openTasks.map((task) => {
                      const due = taskDueDate(task)
                      return (
                        <li key={task.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          {onSelectTask ? (
                            <button
                              type="button"
                              onClick={() => onSelectTask(task.id)}
                              className="w-fit rounded-control text-left text-sm font-medium text-fg underline-offset-2 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                            >
                              {task.title}
                            </button>
                          ) : (
                            <span className="text-sm font-medium text-fg">{task.title}</span>
                          )}
                          {due ? <DueDate date={due} today={today} className="text-xs" /> : null}
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <span className="text-sm text-fg-secondary">{item.note}</span>
                )}
                {item.daysHolding > 0 ? (
                  <span className="text-xs text-fg-secondary">{plural(item.daysHolding, "day")} holding</span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
      <p className="border-t border-line-subtle bg-surface-2 px-4 py-3 text-sm text-fg-secondary">{nextMove}</p>
    </div>
  )
}

export { WhoIsUp }
