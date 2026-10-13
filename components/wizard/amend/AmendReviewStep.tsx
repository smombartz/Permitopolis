"use client"

import { Button } from "@/components/ui/button"
import { InlineAlert } from "@/components/ui/inline-alert"
import { Money } from "@/components/domain/Money"
import { DateGateBanner, type DateGateBannerProps } from "@/components/wizard/DateGateBanner"
import type { AmendmentDiff } from "@/lib/view/amend"

export interface AmendReviewStepProps {
  diff: AmendmentDiff
  gateBanner: Omit<DateGateBannerProps, "gate" | "leadTimeDays">
  leadTimeDays: number
  ready: boolean
  error: string | null
  onConfirm: () => void
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
            {diff.cardsAdded.length > 0 ? `${diff.cardsAdded.length} new card${diff.cardsAdded.length === 1 ? "" : "s"} will be added. ` : ""}
            {diff.cardsRemoved.length > 0 ? `${diff.cardsRemoved.length} card${diff.cardsRemoved.length === 1 ? "" : "s"} no longer apply. ` : ""}
          </p>
        ) : (
          <p className="text-sm text-fg-secondary">The tier and your cards stay as they are; only your answers change.</p>
        )}
        {diff.feeDiff !== 0 ? (
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
        ) : null}
      </section>

      <section className="flex flex-col gap-2 rounded-panel border border-line-subtle bg-surface-2 p-4">
        <h3 className="text-sm font-bold text-fg">What stays</h3>
        <p className="text-sm text-fg-secondary">
          Everything you have already entered and every card you have already finished. Your current permit stays valid for the original plan until this is settled.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-panel border border-line-subtle bg-surface-2 p-4">
        <h3 className="text-sm font-bold text-fg">What happens next</h3>
        <p className="text-sm text-fg-secondary">
          {diff.material
            ? "This needs a look from the city. Finish the new cards and submit the amendment from your board. The departments check them, the City Clerk decides, and you then sign and pay what the change adds. Your permit keeps covering the original plan until then."
            : diff.feeDiff > 0
              ? "Nothing here needs another look: it takes effect as soon as you confirm, and what it adds to your fees is then due from your board."
              : diff.feeDiff < 0
                ? "Nothing here needs another look: it takes effect as soon as you confirm, and the difference is refunded."
                : "Nothing here needs another look: it takes effect as soon as you confirm."}
        </p>
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
