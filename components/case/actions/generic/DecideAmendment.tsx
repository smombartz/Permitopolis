"use client"

import * as React from "react"
import { ArrowRightIcon } from "lucide-react"
import { Money, TierBadge } from "@/components/domain"
import { Field } from "@/components/ui/field"
import { InlineAlert } from "@/components/ui/inline-alert"
import { KeyValueList } from "@/components/ui/key-value"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { fmtDate, fmtMoney } from "@/lib/format"
import { checkDecideAmendment } from "@/lib/state"
import { amendmentReview } from "@/lib/view/amend"
import { PanelActions, PanelBody, PanelHeader, useCaseContext, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

type Decision = "approve" | "decline"

/** What each decision does, said before the button is pressed. */
function summaryFor(decision: Decision, balance: number, hasPermit: boolean): string {
  if (decision === "decline") return "Puts the record back exactly as it was before the amendment and takes its cards off the applicant's board. The permit is untouched."
  if (!hasPermit) return "The amended plan becomes the application under review."
  if (balance > 0) return `The applicant then signs and pays ${fmtMoney(balance)}; the amended plan takes effect when they have. Nothing is charged now.`
  if (balance < 0) return `Refunds ${fmtMoney(-balance)} now; the amended plan takes effect once the applicant has signed anything it adds.`
  return "The amended plan takes effect once the applicant has signed anything it adds."
}

/**
 * The City Clerk's decision on an amendment the applicant has submitted (PRD, "Amend"): what
 * the change is, the cards it added and who has each, what it costs beyond what was paid, then
 * Approve or Decline. Approving waits for the departments checking those cards, and the reason
 * shown is the engine's own (`checkDecideAmendment()`); declining needs a reason for the
 * applicant.
 */
function DecideAmendmentPanel({ caseId, onClose }: ActionPanelProps) {
  const { c, cfg } = useCaseContext(caseId)
  const [decision, setDecision] = React.useState<Decision>("approve")
  const [reason, setReason] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const dispatch = useCaseDispatch(caseId)
  if (!c) return null

  const review = amendmentReview(c, cfg)
  if (!review) {
    return (
      <>
        <PanelHeader title="Decide amendment" />
        <PanelBody>
          <InlineAlert variant="info">There is no amendment pending on this case.</InlineAlert>
        </PanelBody>
        <PanelActions onCancel={onClose} submitLabel="Close" disabled onSubmit={onClose} />
      </>
    )
  }

  const check = checkDecideAmendment(c, decision, decision === "decline" ? reason : undefined)
  // An empty reason is said under its own field, not as a warning before anything was typed.
  const missingReason = decision === "decline" && reason.trim().length === 0
  const tierChanged = review.tierBefore !== review.tierAfter

  function submit() {
    const result = dispatch(
      decision === "approve" ? { type: "decide_amendment", decision } : { type: "decide_amendment", decision, reason: reason.trim() },
      decision === "approve" ? "Amendment approved." : "Amendment declined.",
    )
    if (result.ok) onClose()
    else setError(result.reason ?? "That could not be decided.")
  }

  return (
    <>
      <PanelHeader title="Decide amendment" description={review.proposedOn ? `Proposed ${fmtDate(review.proposedOn)}. The permit covers the original plan until the amendment is in effect.` : "The permit covers the original plan until the amendment is in effect."} />
      <PanelBody>
        {!check.ok && !missingReason ? <InlineAlert variant="warning">{check.reason}</InlineAlert> : null}

        <div className="flex flex-col gap-2">
          <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">What changes</p>
          <div className="flex items-center gap-2">
            <TierBadge tier={review.tierBefore} />
            {tierChanged ? (
              <>
                <ArrowRightIcon className="size-4 text-fg-label" aria-hidden="true" />
                <span className="sr-only">to</span>
                <TierBadge tier={review.tierAfter} />
              </>
            ) : null}
          </div>
          {review.changes.length > 0 ? (
            <ul className="flex flex-col gap-1 text-sm text-fg">
              {review.changes.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Cards it added</p>
          <ul className="flex flex-col gap-1.5">
            {review.cards.map((card) => (
              <li key={card.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 text-fg">{card.title}</span>
                <span className="shrink-0 text-xs text-fg-secondary">{card.statusText}</span>
              </li>
            ))}
          </ul>
        </div>

        <KeyValueList
          columns={2}
          items={[
            { label: "Original plan", value: <Money amount={review.totalBefore} /> },
            { label: "Amended plan", value: <Money amount={review.totalAfter} /> },
            { label: "Paid", value: <Money amount={review.paid} /> },
            { label: review.balance < 0 ? "Goes back to the applicant" : "Due from the applicant", value: <Money amount={Math.abs(review.balance)} /> },
          ]}
        />
        {review.lateFee ? <p className="text-xs text-fg-secondary">The amended plan includes a {fmtMoney(review.lateFee)} late fee the applicant chose at the date gate.</p> : null}

        <fieldset className="flex flex-col gap-2">
          <legend className="text-eyebrow mb-1 font-bold tracking-[.12em] text-fg-label uppercase">Decision</legend>
          <RadioGroup value={decision} onValueChange={(v) => setDecision(v as Decision)} className="gap-2">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="approve" id="amendment-approve" />
              <Label htmlFor="amendment-approve" className="normal-case">
                Approve
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="decline" id="amendment-decline" />
              <Label htmlFor="amendment-decline" className="normal-case">
                Decline
              </Label>
            </div>
          </RadioGroup>
        </fieldset>

        {decision === "decline" ? (
          <Field label="Reason" required hint="Recorded on the case as the reason the amendment was declined.">
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this change is declined" />
          </Field>
        ) : null}

        <InlineAlert variant="info">{summaryFor(decision, review.balance, c.permit !== null)}</InlineAlert>
      </PanelBody>
      <PanelActions
        error={error}
        onCancel={onClose}
        submitLabel={decision === "approve" ? "Approve amendment" : "Decline amendment"}
        submitVariant={decision === "decline" ? "destructive" : "primary"}
        disabled={!check.ok}
        onSubmit={submit}
      />
    </>
  )
}

export { DecideAmendmentPanel }
