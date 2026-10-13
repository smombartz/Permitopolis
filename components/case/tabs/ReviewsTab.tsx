"use client"

import { Button } from "@/components/ui/button"
import { Section } from "@/components/ui/section"
import { InlineAlert } from "@/components/ui/inline-alert"
import { ConditionList, FeeTable, ReviewStatusDot } from "@/components/domain"
import { fmtDate } from "@/lib/format"
import { PARTY_LABEL, type EventCase, type Party } from "@/lib/types"
import { openKeyForAction, reviewSummaries } from "@/lib/view/caseDetail"

interface ReviewsTabProps {
  c: EventCase
  role: Party
  onOpen: (key: string) => void
}

function ReviewsTab({ c, role, onOpen }: ReviewsTabProps) {
  const summaries = reviewSummaries(c, role)

  return (
    <div className="flex flex-col gap-8">
      {summaries.map((summary) => (
        <Section
          key={summary.dept}
          title={<ReviewStatusDot dept={summary.dept} status={summary.review?.status ?? "not_routed"} />}
          description={summary.routed ? summary.review!.sections.join(", ") : "Not routed to this case."}
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
              {c.ending ? "This case ended before it could be routed here." : "The City Clerk has not routed this case to this department."}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
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
              {summary.review!.internalNote ? (
                <div className="flex flex-col gap-1">
                  <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Internal note</p>
                  <p className="text-sm text-fg-secondary">{summary.review!.internalNote}</p>
                </div>
              ) : null}
              {!summary.isOwn ? <p className="text-xs text-fg-label">Read-only: this is {PARTY_LABEL[summary.dept]}&apos;s own section.</p> : null}
            </div>
          )}
        </Section>
      ))}
    </div>
  )
}

export { ReviewsTab }
