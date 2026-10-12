import { cn } from "cn"
import { ENDING_LABEL, STATE_LABEL, type CaseState, type Ending } from "@/lib/types"
import { CASE_STATE_ICON, ENDING_ICON } from "@/components/domain/icons"

/** Rime & Ink semantics (plan 3.2): success for done/valid, warning for needs-info, danger for denied/not-valid. */
const STATE_CLASS: Record<CaseState, string> = {
  draft: "border-line-subtle bg-surface-2 text-fg-secondary",
  submitted: "border-pill-border bg-pill text-fg-pill",
  in_review: "border-pill-border bg-pill text-fg-pill",
  needs_info: "border-warning-border bg-warning-surface text-warning-fg",
  quote_sent: "border-pill-border bg-pill text-fg-pill",
  permitted: "border-success-border bg-success-surface text-success-fg",
  event_day: "border-pill-border bg-pill text-fg-pill",
  closeout: "border-pill-border bg-pill text-fg-pill",
  closed: "border-success-border bg-success-surface text-success-fg",
}

const ENDING_CLASS: Record<Ending, string> = {
  withdrawn: "border-line-magnetic bg-surface-2 text-fg-secondary",
  denied: "border-danger-border bg-danger-surface text-danger-fg",
  cancelled: "border-line-magnetic bg-surface-2 text-fg-secondary",
  hold_expired: "border-danger-border bg-danger-surface text-danger-fg",
}

interface StateChipProps extends React.ComponentProps<"span"> {
  state: CaseState
  /** A case with an ending keeps the state it ended in; pass it to show the ending instead. */
  ending?: Ending | null
}

/** The nine case states and the four off-path endings, each with its own icon. */
function StateChip({ state, ending, className, ...props }: StateChipProps) {
  const Icon = ending ? ENDING_ICON[ending] : CASE_STATE_ICON[state]
  const label = ending ? ENDING_LABEL[ending] : STATE_LABEL[state]
  const classes = ending ? ENDING_CLASS[ending] : STATE_CLASS[state]
  return (
    <span
      data-slot="state-chip"
      data-state={ending ?? state}
      className={cn(
        "inline-flex h-7 w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold whitespace-nowrap",
        classes,
        className
      )}
      {...props}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  )
}

export { StateChip }
