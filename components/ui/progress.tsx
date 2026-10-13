import * as React from "react"
import { cn } from "cn"

interface ProgressProps extends React.ComponentProps<"div"> {
  value: number
  max: number
  /** The visible label, e.g. "9 of 12 neighbors". */
  label: React.ReactNode
}

/** A labeled progress bar: sign-off cards, series payment schedules, closeout checklists. */
function Progress({ value, max, label, className, ...props }: ProgressProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div data-slot="progress" className={cn("flex flex-col gap-1.5", className)} {...props}>
      <p className="text-xs font-medium text-fg-secondary">{label}</p>
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={typeof label === "string" ? label : undefined}
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full rounded-full bg-indigo-650 transition-[width] duration-[var(--dur-fast)] ease-frost"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export { Progress }
