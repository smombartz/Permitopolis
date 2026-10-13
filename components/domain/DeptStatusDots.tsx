import { cn } from "cn"
import { DEPT_ICON } from "@/components/domain/icons"
import { REVIEW_STATUS_TEXT } from "@/components/domain/ReviewStatusDot"
import { PARTY_LABEL, type Dept, type ReviewStatus } from "@/lib/types"

const STATUS_RING: Record<ReviewStatus, string> = {
  not_routed: "border-line-subtle bg-surface-2",
  pending: "border-pill-border bg-pill",
  approved: "border-success-border bg-success-surface",
  approved_with_conditions: "border-success-border bg-success-surface",
  needs_info: "border-warning-border bg-warning-surface",
  denied: "border-danger-border bg-danger-surface",
}

const STATUS_ICON_COLOR: Record<ReviewStatus, string> = {
  not_routed: "text-fg-label",
  pending: "text-fg-pill",
  approved: "text-success-fg",
  approved_with_conditions: "text-success-fg",
  needs_info: "text-warning-fg",
  denied: "text-danger-fg",
}

export interface DeptStatusEntry {
  dept: Dept
  status: ReviewStatus
}

interface DeptStatusDotsProps extends React.ComponentProps<"div"> {
  items: DeptStatusEntry[]
}

/**
 * One dot per department for a dense table row. Each dot is the department's own icon
 * (never color alone), tinted by its review status, with the status in a native tooltip
 * and as accessible text.
 */
function DeptStatusDots({ items, className, ...props }: DeptStatusDotsProps) {
  return (
    <div data-slot="dept-status-dots" className={cn("flex items-center gap-1", className)} {...props}>
      {items.map(({ dept, status }) => {
        const Icon = DEPT_ICON[dept]
        const text = `${PARTY_LABEL[dept]}: ${REVIEW_STATUS_TEXT[status]}`
        return (
          <span
            key={dept}
            title={text}
            className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border", STATUS_RING[status])}
          >
            <Icon className={cn("size-3", STATUS_ICON_COLOR[status])} aria-hidden="true" />
            <span className="sr-only">{text}</span>
          </span>
        )
      })}
    </div>
  )
}

export { DeptStatusDots }
