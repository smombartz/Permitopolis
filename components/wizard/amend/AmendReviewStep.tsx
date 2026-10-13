"use client"

import { Button } from "@/components/ui/button"
import { InlineAlert } from "@/components/ui/inline-alert"
import { Money } from "@/components/domain/Money"
import { DateGateBanner, type DateGateBannerProps } from "@/components/wizard/DateGateBanner"
import { plural } from "@/lib/format"
import type { AmendmentDiff } from "@/lib/view/amend"

export interface AmendReviewStepProps {
  diff: AmendmentDiff
  gateBanner: Omit<DateGateBannerProps, "gate" | "leadTimeDays">
  leadTimeDays: number
  ready: boolean
  error: string | null
  onConfirm: () => void
}

/** With a permit the change is settled against what was paid; before it, the change joins the application and its quote. */
function whatHappensNext(diff: AmendmentDiff): string {
  if (diff.material) {
    return diff.permitted
      ? "This needs a look from the city. Finish the new cards and submit the amendment from your board. The departments check them, the City Clerk decides, and you then sign and pay what the change adds. Your permit keeps covering the original plan until then."
      : "This needs a look from the city. Finish the new cards and submit the amendment from your board. The departments check them and the City Clerk decides; the change is then part of your application."
  }
  const atOnce = "Nothing here needs another look: it takes effect as soon as you confirm"
  if (diff.feeDiff === 0) return `${atOnce}.`
  if (!diff.permitted) return `${atOnce}, and your fees follow the new plan.`
  return diff.feeDiff > 0 ? `${atOnce}, and what it adds to your fees is then due from your board.` : `${atOnce}, and the difference is refunded.`
}

/**
 * The amendment's last step (PRD "Amend", step 3 of the brief): "What changes", "What stays",
 * "What happens next", then the confirm button, which is the only place anything is dispatched
 * (brief 5A step 1: "nothing is dispatched until the applicant confirms on the last step").
 */
function AmendReviewStep({ diff, gateBanner, leadTimeDays, ready, error, onConfirm }: AmendReviewStepProps) {
  const changedTriggers = diff.cardsAdded.length > 0 || diff.cardsRemoved.length > 0 || diff.tierBefore !== diff.tierAfter;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-h5 font-bold text-fg">Review your change</h2>
        <p className="mt-1 text-sm text-fg-secondary">Nothing is sent until you confirm below.</p>
      </div>

      <DateGateBanner gate={diff.gate} leadTimeDays={leadTimeDays} {...gateBanner} />

      <section className="flex flex-col gap-2 rounded-panel border border-line-subtle bg-surface-2 p-4">
        <h3 className="text-sm font-bold text-fg">What changes</h3>
        {changedTriggers ? (
          <p className="text-sm text-fg-secondary">
            {diff.tierBefore !== diff.tierAfter ? `Your event becomes ${diff.tierLabelAfter}. ` : ""}
            {diff.cardsAdded.length > 0 ? `${plural(diff.cardsAdded.length, "new card")} will be added. ` : ""}
            {diff.cardsRemoved.length > 0 ? `${plural(diff.cardsRemoved.length, "card")} no longer ${diff.cardsRemoved.length === 1 ? "applies" : "apply"}. ` : ""}
          </p>
        ) : (
          <p className="text-sm text-fg-secondary">The tier and your cards stay as they are; only your answers change.</p>
        )}
        {diff.feeDiff === 0 ? null : diff.permitted ? (
          <p className="text-sm text-fg-secondary">
            {diff.feeDiff > 0 ? (
              <>
                <Money amount={diff.feeDiff} /> more will be due.
              </>
            ) : (
              <>
                <Money amount={-diff.feeDiff} /> will be refunded.
              </>
            )}
          </p>
        ) : (
          // Nothing has been paid for before the permit: the change is to what the quote asks for.
          <p className="text-sm text-fg-secondary">
            Your fees go {diff.feeDiff > 0 ? "up" : "down"} by <Money amount={Math.abs(diff.feeDiff)} />.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-panel border border-line-subtle bg-surface-2 p-4">
        <h3 className="text-sm font-bold text-fg">What stays</h3>
        <p className="text-sm text-fg-secondary">
          Everything you have already entered and every card you have already finished.
          {diff.permitted ? " Your current permit stays valid for the original plan until this is settled." : ""}
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-panel border border-line-subtle bg-surface-2 p-4">
        <h3 className="text-sm font-bold text-fg">What happens next</h3>
        <p className="text-sm text-fg-secondary">{whatHappensNext(diff)}</p>
      </section>

      {error ? (
        <InlineAlert variant="danger" live>
          {error}
        </InlineAlert>
      ) : null}

      <Button type="button" disabled={!ready} onClick={onConfirm} className="self-start">
        {diff.material ? "Confirm change" : "Apply change"}
      </Button>
    </div>
  )
}

export { AmendReviewStep }
