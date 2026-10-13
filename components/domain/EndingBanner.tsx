import { cn } from "cn"
import { ENDING_ICON } from "@/components/domain/icons"
import { ENDING_LABEL, type Ending } from "@/lib/types"

const ENDING_TONE: Record<Ending, "danger" | "neutral"> = {
  withdrawn: "neutral",
  denied: "danger",
  cancelled: "neutral",
  hold_expired: "danger",
}

interface EndingBannerProps extends React.ComponentProps<"div"> {
  ending: Ending
  /** `EventCase.endingReason`. */
  reason?: string | null
}

/**
 * Withdrawn, Denied, Cancelled or Hold expired, with the reason from the activity log. Page
 * content, not a live region: it is there when the page opens (it was `role="alert"`, which
 * spoke over the page on every visit to an ended case). The moment a case ends is announced by
 * the action's toast, or by the case screen's status line when no one clicked anything.
 */
function EndingBanner({ ending, reason, className, ...props }: EndingBannerProps) {
  const Icon = ENDING_ICON[ending]
  const tone = ENDING_TONE[ending]
  return (
    <div
      data-slot="ending-banner"
      data-ending={ending}
      className={cn(
        "flex items-start gap-3 rounded-panel border px-4 py-3.5 text-sm",
        tone === "danger"
          ? "border-danger-border bg-danger-surface text-danger-fg"
          : "border-line-magnetic bg-surface-2 text-fg-secondary",
        className
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-current">{ENDING_LABEL[ending]}</p>
        {reason ? <p>{reason}</p> : null}
      </div>
    </div>
  )
}

export { EndingBanner }
