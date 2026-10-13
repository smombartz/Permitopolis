"use client"

/** The consolidation panel's side-by-side view: each routed department's decision, conditions and fee lines, with conflicts flagged above. */
import { InlineAlert } from "@/components/ui/inline-alert"
import { ConditionList, PartyChip, ReviewStatusDot } from "@/components/domain"
import { fmtMoney } from "@/lib/format"
import type { ReviewSummary } from "@/lib/view/caseDetail"
import type { ConditionConflict } from "@/lib/view/clerkTools"
import { PARTY_LABEL } from "@/lib/types"

function conflictSentence(conflict: ConditionConflict): string {
  const depts = [...new Set(conflict.conditions.map((c) => PARTY_LABEL[c.dept]))].join(" and ")
  if (conflict.kind === "duplicate") return `The same condition appears more than once (${depts}).`;
  const texts = conflict.conditions.map((c) => `"${c.text}" (${PARTY_LABEL[c.dept]})`).join(" vs. ");
  return `${depts} set different values for the same thing: ${texts}.`;
}

function DepartmentCard({ summary }: { summary: ReviewSummary }) {
  const feeTotal = summary.feeLines.reduce((sum, line) => sum + line.estimate, 0)
  return (
    <div className="flex flex-col gap-3 rounded-panel border border-line-subtle bg-surface-1 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <PartyChip party={summary.dept} />
        <ReviewStatusDot dept={summary.dept} status={summary.review?.status ?? "not_routed"} showDept={false} />
      </div>
      {!summary.routed ? (
        <p className="text-sm text-fg-secondary">Not routed to this case.</p>
      ) : (
        <>
          {summary.conditions.length > 0 ? (
            <ConditionList conditions={summary.conditions} />
          ) : (
            <p className="text-sm text-fg-secondary">No conditions from this department.</p>
          )}
          {summary.feeLines.length > 0 ? (
            <div className="flex items-center justify-between text-xs text-fg-label">
              <span>{summary.feeLines.length} fee line{summary.feeLines.length === 1 ? "" : "s"}</span>
              <span>{fmtMoney(feeTotal)}</span>
            </div>
          ) : null}
          {summary.review?.messageToApplicant ? <p className="text-xs text-fg-secondary">&ldquo;{summary.review.messageToApplicant}&rdquo;</p> : null}
        </>
      )}
    </div>
  )
}

interface DepartmentConsolidationProps {
  summaries: ReviewSummary[]
  conflicts: ConditionConflict[]
}

/** Every routed department's own decision, side by side, with the conflicts the merged list below should resolve. */
function DepartmentConsolidation({ summaries, conflicts }: DepartmentConsolidationProps) {
  const routed = summaries.filter((s) => s.routed)
  return (
    <div className="flex flex-col gap-3">
      {conflicts.length > 0 ? (
        <div className="flex flex-col gap-2">
          {conflicts.map((conflict) => (
            <InlineAlert key={conflict.key} variant="warning">
              {conflictSentence(conflict)}
            </InlineAlert>
          ))}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {routed.map((summary) => (
          <DepartmentCard key={summary.dept} summary={summary} />
        ))}
      </div>
    </div>
  )
}

export { DepartmentConsolidation }
