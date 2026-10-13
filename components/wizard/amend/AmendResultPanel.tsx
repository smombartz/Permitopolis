"use client"

import { ArrowRightIcon, CheckIcon, PlusIcon } from "lucide-react"
import { Banner } from "@/components/ui/banner"
import { Money } from "@/components/domain/Money"
import { TierBadge } from "@/components/domain/TierBadge"
import { tierRiseBannerText, type AmendmentDiff } from "@/lib/view/amend"

export interface AmendResultPanelProps {
  diff: AmendmentDiff
}

/**
 * The amendment wizard's live panel (PRD "Amend"): compares the new plan with the current one
 * on every change (brief 5A, step 1). The date gate's own fixes are shown by `DateGateBanner`
 * next to it, the way the ordinary wizard shows it on steps 3 and 5; this panel is the diff
 * alone, so the two read together without repeating each other.
 */
function AmendResultPanel({ diff }: AmendResultPanelProps) {
  const tierChanged = diff.tierBefore !== diff.tierAfter

  return (
    <div data-slot="amend-result-panel" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <TierBadge tier={diff.tierBefore} className="h-8 text-sm" />
          {tierChanged ? (
            <>
              <ArrowRightIcon className="size-4 text-fg-tertiary" aria-hidden="true" /> {/* guard-allow-tertiary: an arrow, not text */}
              <TierBadge tier={diff.tierAfter} className="h-8 text-sm" />
            </>
          ) : null}
        </div>
        <p className="text-sm text-fg-secondary">{diff.summary}</p>
      </div>

      {diff.material && diff.tierRose ? <Banner variant="warning">{tierRiseBannerText(diff)}</Banner> : null}
      {!diff.material ? <Banner variant="success">This takes effect right away: nothing here needs the City Clerk to look at it again.</Banner> : null}

      {diff.cardsAdded.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Cards that will be added</p>
          <ul className="flex flex-col gap-1">
            {diff.cardsAdded.map((card) => (
              <li key={card.catalogId} className="flex items-center gap-2 text-sm text-fg-secondary">
                <PlusIcon className="size-3.5 shrink-0 text-fg-tertiary" aria-hidden="true" /> {/* guard-allow-tertiary: a glyph, not text */}
                {card.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {diff.cardsRemoved.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Cards that no longer apply</p>
          <ul className="flex flex-col gap-1">
            {diff.cardsRemoved.map((card) => (
              <li key={card.catalogId} className="flex items-center gap-2 text-sm text-fg-secondary line-through">
                <CheckIcon className="size-3.5 shrink-0 text-fg-tertiary" aria-hidden="true" /> {/* guard-allow-tertiary: a glyph, not text */}
                {card.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5 border-t border-line-subtle pt-3">
        <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Fees</p>
        <div className="flex items-center justify-between text-sm">
          <span className="text-fg-secondary">New total</span>
          <Money amount={diff.feeAfter} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-fg-secondary">Already paid</span>
          <Money amount={diff.paid} />
        </div>
        <div className="flex items-center justify-between text-sm font-semibold text-fg">
          <span>{diff.feeDiff > 0 ? "To pay" : diff.feeDiff < 0 ? "To be refunded" : "Difference"}</span>
          <Money amount={Math.abs(diff.feeDiff)} />
        </div>
        {diff.lateFeeAmount ? (
          <p className="text-xs text-fg-secondary">
            Includes a <Money amount={diff.lateFeeAmount} /> late fee.
          </p>
        ) : null}
      </div>
    </div>
  )
}

export { AmendResultPanel }
