import { cn } from "cn"
import { TriangleAlertIcon } from "lucide-react"

interface LeadTimeRiskProps extends React.ComponentProps<"span"> {
  /** `leadTimeRisk()`'s return value. Renders nothing when "ok". */
  risk: "ok" | "at_risk"
}

/** The pipeline and queue rows' lead-time risk flag: red when the remaining steps won't fit. */
function LeadTimeRisk({ risk, className, ...props }: LeadTimeRiskProps) {
  if (risk !== "at_risk") return null
  return (
    <span
      data-slot="lead-time-risk"
      role="status"
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center gap-1 rounded-full border border-danger-border bg-danger-surface px-2 text-[11px] font-semibold whitespace-nowrap text-danger-fg",
        className
      )}
      {...props}
    >
      <TriangleAlertIcon className="size-3" aria-hidden="true" />
      Lead-time risk
    </span>
  )
}

export { LeadTimeRisk }
