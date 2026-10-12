import * as React from "react"
import { cn } from "cn"

interface StatProps extends React.ComponentProps<"div"> {
  label: React.ReactNode
  value: React.ReactNode
  icon?: React.ReactNode
}

/** A labeled number: queue counts, today's totals, fee summaries. */
function Stat({ label, value, icon, className, ...props }: StatProps) {
  return (
    <div data-slot="stat" className={cn("flex flex-col gap-1", className)} {...props}>
      <div className="flex items-center gap-1.5 text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">
        {icon}
        {label}
      </div>
      <div className="text-price font-extrabold text-fg">{value}</div>
    </div>
  )
}

export { Stat }
