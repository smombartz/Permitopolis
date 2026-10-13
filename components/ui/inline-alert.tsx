import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { CircleCheckIcon, InfoIcon, OctagonXIcon, TriangleAlertIcon } from "lucide-react"

/**
 * A compact, tight inline message: a reviewer's pinned request, a locked card's unlock
 * hint, a note under a value. `Banner` is the full panel treatment for page-level
 * messages, and `Field`'s own `error` prop already covers a form field's own error text;
 * this fills the gap for everything else.
 */
const inlineAlertVariants = cva("flex items-start gap-2 text-xs", {
  variants: {
    variant: {
      info: "text-fg-pill",
      success: "text-success-fg",
      warning: "text-warning-fg",
      danger: "text-danger-fg",
    },
  },
  defaultVariants: {
    variant: "info",
  },
})

const ICONS = {
  info: InfoIcon,
  success: CircleCheckIcon,
  warning: TriangleAlertIcon,
  danger: OctagonXIcon,
} as const

function InlineAlert({
  className,
  variant = "info",
  children,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inlineAlertVariants>) {
  const Icon = ICONS[variant ?? "info"]
  return (
    <div
      data-slot="inline-alert"
      data-variant={variant}
      role={variant === "danger" || variant === "warning" ? "alert" : "status"}
      className={cn(inlineAlertVariants({ variant }), className)}
      {...props}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 font-medium">{children}</div>
    </div>
  )
}

export { InlineAlert, inlineAlertVariants }
