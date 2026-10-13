import * as React from "react"
import { cn } from "cn"
import type { LucideIcon } from "lucide-react"

interface EmptyStateProps extends React.ComponentProps<"div"> {
  icon: LucideIcon
  title: string
  text?: string
  action?: React.ReactNode
  /** Renders the title as a heading of this level: 1 when the empty state is the whole page (a case that does not exist). */
  headingLevel?: 1 | 2 | 3
}

/** A role's empty queue, a filter with no result, a case with nothing yet. */
function EmptyState({ icon: Icon, title, text, action, headingLevel, className, ...props }: EmptyStateProps) {
  const Title = headingLevel ? (`h${headingLevel}` as const) : "p"
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center gap-3 rounded-panel border border-dashed border-line-subtle px-6 py-12 text-center",
        className
      )}
      {...props}
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-fg-label">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <Title className="text-sm font-semibold text-fg">{title}</Title>
        {text ? <p className="max-w-sm text-sm text-fg-secondary">{text}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}

export { EmptyState }
