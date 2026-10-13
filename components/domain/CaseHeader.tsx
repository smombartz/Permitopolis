import { cn } from "cn"
import { CaseId } from "@/components/domain/CaseId"
import { DateText } from "@/components/domain/DateText"
import { HoldStatus } from "@/components/domain/HoldStatus"
import { ReviewClock } from "@/components/domain/ReviewClock"
import { StateStepper } from "@/components/domain/StateStepper"
import { TierBadge } from "@/components/domain/TierBadge"
import { fmtDaysToGo } from "@/lib/format"
import type { CaseState, DateHold, Ending, ISODate, Tier } from "@/lib/types"

interface CaseHeaderReviewClock {
  dayCount: number
  allowedDays: number
  paused?: boolean
  pausedDays?: number
}

interface CaseHeaderProps extends React.ComponentProps<"div"> {
  name: string
  tier: Tier
  caseId: string
  applicantName: string
  eventDate: ISODate
  today: ISODate
  state: CaseState
  ending?: Ending | null
  hold: DateHold
  /** Omit when no department's review clock applies yet (before routing, or after Quote sent). */
  reviewClock?: CaseHeaderReviewClock | null
  /** The role's primary actions, right-aligned next to the title. */
  actions?: React.ReactNode
}

/** The header strip from both wireframes: event, tier, case id, applicant, stepper, hold and clock. */
function CaseHeader({
  name,
  tier,
  caseId,
  applicantName,
  eventDate,
  today,
  state,
  ending,
  hold,
  reviewClock,
  actions,
  className,
  ...props
}: CaseHeaderProps) {
  return (
    <div data-slot="case-header" className={cn("flex flex-col gap-4 rounded-panel border border-line-subtle bg-surface-1 p-5", className)} {...props}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-h4 font-bold text-fg">{name}</h1>
            <TierBadge tier={tier} />
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-secondary">
            <CaseId id={caseId} />
            <span aria-hidden="true">·</span>
            <span>{applicantName}</span>
            <span aria-hidden="true">·</span>
            <DateText date={eventDate} />
            <span aria-hidden="true">·</span>
            <span>{fmtDaysToGo(eventDate, today)}</span>
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <StateStepper state={state} ending={ending} />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line-subtle pt-3">
        <HoldStatus hold={hold} />
        {reviewClock ? (
          <ReviewClock
            dayCount={reviewClock.dayCount}
            allowedDays={reviewClock.allowedDays}
            paused={reviewClock.paused}
            pausedDays={reviewClock.pausedDays}
          />
        ) : null}
      </div>
    </div>
  )
}

export { CaseHeader }
