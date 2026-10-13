"use client"

import { Button } from "@/components/ui/button"
import { Section } from "@/components/ui/section"
import { InlineAlert } from "@/components/ui/inline-alert"
import { ConditionList, FeeTable, ReviewClock, ReviewStatusDot } from "@/components/domain"
import { fmtDate } from "@/lib/format"
import { reviewClock, useDemo } from "@/lib/state"
import { PARTY_LABEL, type Dept, type EventCase, type Party } from "@/lib/types"
import { openKeyForAction, reviewSummaries } from "@/lib/view/caseDetail"
import { meetingCardsFor } from "@/lib/view/reviewTools"

/** A dept's meeting cards, each reachable here instead of only through Who's up: Schedule (or Reschedule) and Mark held. */
function MeetingRow({ c, dept, onOpen }: { c: EventCase; dept: Dept; onOpen: (key: string) => void }) {
  const meetings = meetingCardsFor(c, dept)
  if (meetings.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Meetings</p>
      {meetings.map((task) => (
        <div key={task.id} className="flex items-center justify-between gap-3 rounded-control border border-line-subtle bg-surface-2 px-3 py-2">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm text-fg">{task.title}</span>
            <span className="text-xs text-fg-label">{task.payload.scheduledFor ? `Scheduled for ${fmtDate(task.payload.scheduledFor)}` : "Not yet scheduled"}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => onOpen(`schedule_meeting:${task.id}`)}>
              {task.payload.scheduledFor ? "Reschedule" : "Schedule"}
            </Button>
            {task.payload.scheduledFor && task.status !== "done" ? (
              <Button type="button" size="sm" onClick={() => onOpen(`complete_city_task:${task.id}`)}>
                Mark held
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}

interface ReviewsTabProps {
  c: EventCase
  role: Party
  onOpen: (key: string) => void
}

function ReviewsTab({ c, role, onOpen }: ReviewsTabProps) {
  const today = useDemo((s) => s.demoToday)
  const summaries = reviewSummaries(c, role)
  const own = role !== "applicant" ? (role as Dept) : null
  // The viewer's own department first and actionable; the rest read-only, in the usual order.
  const ordered = own ? [...summaries.filter((s) => s.dept === own), ...summaries.filter((s) => s.dept !== own)] : summaries

  return (
    <div className="flex flex-col gap-8">
      {ordered.map((summary) => {
        const cardsNamedForDept = !summary.routed ? c.tasks.filter((t) => t.owner === "applicant" && t.reviewer === summary.dept) : []
        const clock = summary.routed && !summary.review!.decidedOn && (role === "clerk" || summary.isOwn) ? reviewClock(c, summary.dept, today) : null

        return (
          <Section
            key={summary.dept}
            title={<ReviewStatusDot dept={summary.dept} status={summary.review?.status ?? "not_routed"} />}
            description={summary.routed ? summary.review!.sections.join(", ") : summary.dept === "clerk" ? "Nothing here for the City Clerk to review." : "Not routed to this case."}
            actions={
              summary.isOwn && summary.review && (summary.review.status === "pending" || summary.review.status === "needs_info") ? (
                <div className="flex items-center gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => onOpen(openKeyForAction("request_info"))}>
                    Request information
                  </Button>
                  <Button type="button" size="sm" disabled={summary.review.status !== "pending"} onClick={() => onOpen(openKeyForAction("review_decide"))}>
                    Decide your review
                  </Button>
                </div>
              ) : undefined
            }
          >
            {!summary.routed ? (
              <p className="text-sm text-fg-secondary">
                {summary.dept === "clerk"
                  ? "No license review on this case."
                  : c.ending
                    ? "This case ended before it could be routed here."
                    : cardsNamedForDept.length > 0
                      ? `Named on ${cardsNamedForDept.length === 1 ? "a card" : "cards"} (${cardsNamedForDept.map((t) => t.title).join(", ")}), waiting for routing.`
                      : "The City Clerk has not routed this case to this department."}
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {clock ? <ReviewClock dayCount={clock.day} allowedDays={clock.of} paused={clock.paused} pausedDays={clock.pausedDays} /> : null}
                {summary.review!.decidedOn ? <p className="text-xs text-fg-label">Decided {fmtDate(summary.review!.decidedOn)}</p> : null}
                {summary.review!.status === "needs_info" ? <InlineAlert variant="warning">Waiting on the applicant&apos;s response.</InlineAlert> : null}
                {summary.conditions.length > 0 ? <ConditionList conditions={summary.conditions} /> : null}
                {summary.feeLines.length > 0 ? <FeeTable lines={summary.feeLines} /> : null}
                {summary.review!.messageToApplicant ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Message to the applicant</p>
                    <p className="text-sm text-fg">{summary.review!.messageToApplicant}</p>
                  </div>
                ) : null}
                {summary.review!.internalNote && role !== "applicant" ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Internal note</p>
                    <p className="text-sm text-fg-secondary">{summary.review!.internalNote}</p>
                  </div>
                ) : null}
                {!summary.isOwn && role !== "clerk" ? <p className="text-xs text-fg-label">Read-only: this is {PARTY_LABEL[summary.dept]}&apos;s own section.</p> : null}
                {role === "clerk" || summary.isOwn ? <MeetingRow c={c} dept={summary.dept} onOpen={onOpen} /> : null}
              </div>
            )}
          </Section>
        )
      })}
    </div>
  )
}

export { ReviewsTab }
