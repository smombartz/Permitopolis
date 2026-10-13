"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Field } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { InlineAlert } from "@/components/ui/inline-alert"
import { ReviewClock } from "@/components/domain"
import { ConditionBuilder } from "@/components/case/review/ConditionBuilder"
import { feeRowTotal, FeeLineBuilder, type FeeRow } from "@/components/case/review/FeeLineBuilder"
import { SubmittedMaterial } from "@/components/case/review/SubmittedMaterial"
import { CONDITION_TEMPLATES } from "@/lib/data/templates"
import { fmtMoney, plural } from "@/lib/format"
import { checkReviewDecide, reviewClock } from "@/lib/state"
import type { FeeLineDraft, ReviewDecision } from "@/lib/state/actions"
import { routes, type CaseTab } from "@/lib/routes"
import { PARTY_LABEL, type Dept } from "@/lib/types"
import { existingFeeLines, feePresetsFor, reviewMaterial, routingReasons } from "@/lib/view/reviewTools"
import { PanelActions, PanelBody, PanelHeader, useCaseContext, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

/** The decision radio's own options: "request_info" is a hand-off to the request panel, not a review_decide value. */
type DecisionChoice = ReviewDecision | "request_info";

const CHOICE_LABEL: Record<DecisionChoice, string> = {
  approve: "Approve",
  approve_with_conditions: "Approve with conditions",
  request_info: "Request information",
  deny: "Deny",
}

function summaryFor(choice: DecisionChoice, conditions: string[], feeRows: FeeRow[]): string {
  if (choice === "request_info") return "Opens a request to the applicant; nothing is decided here."
  if (choice === "deny") return "Denies your section. The City Clerk decides what happens to the application."
  const extras: string[] = []
  if (conditions.length > 0) extras.push(plural(conditions.length, "condition"))
  const total = feeRowTotal(feeRows.filter((r) => r.label.trim().length > 0 && r.qty > 0))
  if (total > 0) extras.push(`${fmtMoney(total)} in fee lines`)
  if (extras.length === 0) return "Approves your section. Nothing else is added."
  return `Approves your section, carrying ${extras.join(" and ")} into the quote.`
}

/** The shared decision panel for every department, and the Clerk's own license review. */
function ReviewDecidePanel({ caseId, role, onClose }: ActionPanelProps) {
  const { c, cfg, today } = useCaseContext(caseId)
  const router = useRouter()
  const searchParams = useSearchParams()
  const dept = role as Dept
  const [choice, setChoice] = React.useState<DecisionChoice>("approve")
  const [conditions, setConditions] = React.useState<string[]>([])
  const [feeRows, setFeeRows] = React.useState<FeeRow[]>([])
  const [internalNote, setInternalNote] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const dispatch = useCaseDispatch(caseId)
  if (!c) return null

  const check = checkReviewDecide(c, dept)
  const templates = CONDITION_TEMPLATES[dept] ?? []
  const material = reviewMaterial(c, dept)
  const reasons = routingReasons(c, dept, cfg)
  const clock = reviewClock(c, dept, today)

  // Conditions belong to "Approve with conditions" alone (PRD, review panel): a plain approval
  // carries none, and that decision needs at least one or it says something that is not so.
  const withConditions = choice === "approve_with_conditions"
  const needsCondition = withConditions && conditions.length === 0
  // A named fee line with no quantity would be a $0 charge. It is never left out in silence:
  // the reviewer gives it a quantity or takes it off.
  const unquantified = choice === "approve" || withConditions ? feeRows.find((r) => r.label.trim().length > 0 && !(r.qty > 0)) : undefined

  function openRequestInfo() {
    router.replace(
      routes.city.case(caseId, {
        task: "request_info",
        tab: (searchParams.get("tab") as CaseTab | null) ?? undefined,
        from: searchParams.get("from") ?? undefined,
      }),
    )
  }

  function submit() {
    if (choice === "request_info") {
      openRequestInfo()
      return
    }
    const feeLines: FeeLineDraft[] = feeRows
      .filter((r) => r.label.trim().length > 0 && r.qty > 0)
      .map((r) => ({ dept: r.dept, label: r.label, qty: r.qty, unit: r.unit, unitPrice: r.unitPrice, kind: r.kind }))
    const result = dispatch(
      { type: "review_decide", decision: choice, conditions: withConditions ? conditions : [], feeLines: choice === "deny" ? [] : feeLines, internalNote: internalNote.trim() || undefined, message: message.trim() || undefined },
      choice === "deny" ? "Section denied." : "Review decided.",
    )
    if (result.ok) onClose()
    else setError(result.reason ?? "That review could not be decided.")
  }

  return (
    <>
      <PanelHeader title="Decide your review" description={`${PARTY_LABEL[dept]} · ${reasons.length > 0 ? reasons.join(", ") : "Coordination"}`}>
        {clock ? <ReviewClock dayCount={clock.day} allowedDays={clock.of} paused={clock.paused} pausedDays={clock.pausedDays} className="mt-1" /> : null}
      </PanelHeader>
      <PanelBody>
        {!check.ok ? <InlineAlert variant="warning">{check.reason}</InlineAlert> : null}

        <div className="flex flex-col gap-2">
          <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">What the applicant submitted</p>
          <SubmittedMaterial sections={material} />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-eyebrow mb-1 font-bold tracking-[.12em] text-fg-label uppercase">Decision</legend>
          <RadioGroup value={choice} onValueChange={(v) => setChoice(v as DecisionChoice)} className="gap-2">
            {(Object.keys(CHOICE_LABEL) as DecisionChoice[]).map((d) => (
              <div key={d} className="flex items-center gap-2">
                <RadioGroupItem value={d} id={`decision-${d}`} />
                <Label htmlFor={`decision-${d}`} className="normal-case">
                  {CHOICE_LABEL[d]}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </fieldset>

        {choice === "approve" || choice === "approve_with_conditions" ? (
          <>
            {withConditions ? (
              <div className="flex flex-col gap-2">
                <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Conditions</p>
                <ConditionBuilder templates={templates} value={conditions} onChange={setConditions} />
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Fee lines</p>
              <FeeLineBuilder presets={feePresetsFor(dept, c, cfg)} existing={existingFeeLines(c, dept)} value={feeRows} onChange={setFeeRows} />
            </div>
          </>
        ) : null}

        {choice !== "request_info" ? (
          <>
            <Field label="Internal note" hint="City staff only; never shown to the applicant.">
              <Textarea rows={2} value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
            </Field>
            <Field label={choice === "deny" ? "Reason, shown to the applicant" : "Message to the applicant"}>
              <Textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
            </Field>
          </>
        ) : null}

        <InlineAlert variant="info">
          {needsCondition
            ? "Add at least one condition, or choose Approve."
            : unquantified
              ? `Give ${unquantified.label.trim()} a quantity, or remove the line.`
              : summaryFor(choice, withConditions ? conditions : [], feeRows)}
        </InlineAlert>
      </PanelBody>
      <PanelActions
        error={error}
        onCancel={onClose}
        submitLabel={choice === "request_info" ? "Continue" : CHOICE_LABEL[choice]}
        submitVariant={choice === "deny" ? "destructive" : "primary"}
        disabled={choice !== "request_info" && (!check.ok || needsCondition || unquantified !== undefined)}
        onSubmit={submit}
      />
    </>
  )
}

export { ReviewDecidePanel }
