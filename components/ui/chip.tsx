import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/**
 * A small rounded row: party chips, waiting-on chips, filter chips. Always
 * pair with an icon or a leading dot plus a label; color never carries the
 * meaning alone (CLAUDE.md).
 */
const chipVariants = cva(
  "inline-flex h-7 w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "border-line-subtle bg-surface-2 text-fg-secondary",
        pill: "border-pill-border bg-pill text-fg-pill",
        success: "border-success-border bg-success-surface text-success-fg",
        warning: "border-warning-border bg-warning-surface text-warning-fg",
        danger: "border-danger-border bg-danger-surface text-danger-fg",
        outline: "border-line-magnetic bg-transparent text-fg-secondary",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
)

function Chip({
  className,
  variant = "neutral",
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof chipVariants>) {
  return (
    <span
      data-slot="chip"
      data-variant={variant}
      className={cn(chipVariants({ variant }), className)}
      {...props}
    />
  )
}

/** A chip's leading identity dot: color plus always an adjacent icon/label. */
function ChipDot({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="chip-dot"
      aria-hidden="true"
      className={cn("size-1.5 shrink-0 rounded-full bg-current", className)}
      {...props}
    />
  )
}

export { Chip, ChipDot, chipVariants }
