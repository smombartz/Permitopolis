import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const countBadgeVariants = cva(
  "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border px-1.5 font-mono text-[11px] font-semibold tabular-nums",
  {
    variants: {
      variant: {
        neutral: "border-line-subtle bg-surface-2 text-fg-secondary",
        accent: "border-indigo-650/20 bg-pill text-fg-pill",
        danger: "border-danger-border bg-danger-surface text-danger-fg",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
)

interface CountBadgeProps extends React.ComponentProps<"span">, VariantProps<typeof countBadgeVariants> {
  count: number
}

/** A small numeric pill: nav item counts, "6" next to "My queue". */
function CountBadge({ count, variant = "neutral", className, ...props }: CountBadgeProps) {
  return (
    <span
      data-slot="count-badge"
      className={cn(countBadgeVariants({ variant }), className)}
      {...props}
    >
      {count}
    </span>
  )
}

export { CountBadge, countBadgeVariants }
