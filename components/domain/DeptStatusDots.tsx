import { cn } from "cn"
import { CheckIcon, CircleHelpIcon, ClockIcon, ListChecksIcon, MinusIcon, XIcon, type LucideIcon } from "lucide-react"
import { DEPT_ICON } from "@/components/domain/icons"
import { REVIEW_STATUS_TEXT } from "@/components/domain/ReviewStatusDot"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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

/**
 * The shape that says the status, so it never rests on the tint: a dash, a clock, a check, a
 * checklist (approved, with conditions to read), a question mark, a cross.
 */
const STATUS_GLYPH: Record<ReviewStatus, LucideIcon> = {
  not_routed: MinusIcon,
  pending: ClockIcon,
  approved: CheckIcon,
  approved_with_conditions: ListChecksIcon,
  needs_info: CircleHelpIcon,
  denied: XIcon,
}

export interface DeptStatusEntry {
  dept: Dept
  status: ReviewStatus
}

interface DeptStatusDotsProps extends React.ComponentProps<"div"> {
  items: DeptStatusEntry[]
}

const textFor = ({ dept, status }: DeptStatusEntry) => `${PARTY_LABEL[dept]}: ${REVIEW_STATUS_TEXT[status]}`

/**
 * One marker per department for a dense table row: the department's own icon beside a glyph
 * for its review status, both tinted by that status. The words are one tab stop away: the
 * row of markers takes focus and shows every department's status in a tooltip, on hover too,
 * and reads them out as its name.
 */
function DeptStatusDots({ items, className, ...props }: DeptStatusDotsProps) {
  if (items.length === 0) return <div data-slot="dept-status-dots" className={cn("flex items-center gap-1", className)} {...props} />

  return (
    // Its own provider, so the row works wherever it is rendered (a test, the kit, a table).
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            data-slot="dept-status-dots"
            role="img"
            tabIndex={0}
            aria-label={`Reviews: ${items.map(textFor).join("; ")}`}
            className={cn(
              "flex w-fit items-center gap-1 rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
              className
            )}
            {...props}
          >
            {items.map(({ dept, status }) => {
              const Icon = DEPT_ICON[dept]
              const Glyph = STATUS_GLYPH[status]
              return (
                <span
                  key={dept}
                  data-dept={dept}
                  data-status={status}
                  className={cn("flex h-5 shrink-0 items-center gap-0.5 rounded-full border px-1", STATUS_RING[status], STATUS_ICON_COLOR[status])}
                >
                  <Icon className="size-3" aria-hidden="true" />
                  <Glyph className="size-3" aria-hidden="true" />
                </span>
              )
            })}
          </div>
        </TooltipTrigger>
        <TooltipContent className="flex-col items-start gap-0.5">
          {items.map((item) => (
            <span key={item.dept}>{textFor(item)}</span>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export { DeptStatusDots }
