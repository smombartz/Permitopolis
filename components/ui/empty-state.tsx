import * as React from "react"
import { cn } from "cn"
import type { LucideIcon } from "lucide-react"

interface EmptyStateProps extends React.ComponentProps<"div"> {
  icon: LucideIcon
  title: string
  text?: string
  action?: React.ReactNode
}

/** A role's empty queue, a filter with no result, a case with nothing yet. */
function EmptyState({ icon: Icon, title, text, action, className, ...props }: EmptyStateProps) {
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
        <p className="text-sm font-semibold text-fg">{title}</p>
        {text ? <p className="max-w-sm text-sm text-fg-secondary">{text}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}

export { EmptyState }
