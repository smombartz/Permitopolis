import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { CircleCheckIcon, InfoIcon, OctagonXIcon, TriangleAlertIcon } from "lucide-react"

const bannerVariants = cva(
  "flex items-start gap-3 rounded-panel border px-4 py-3.5 text-sm",
  {
    variants: {
      variant: {
        info: "border-pill-border bg-pill text-fg-pill",
        success: "border-success-border bg-success-surface text-success-fg",
        warning: "border-warning-border bg-warning-surface text-warning-fg",
        danger: "border-danger-border bg-danger-surface text-danger-fg",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
)

const ICONS = {
  info: InfoIcon,
  success: CircleCheckIcon,
  warning: TriangleAlertIcon,
  danger: OctagonXIcon,
} as const

function Banner({
  className,
  variant = "info",
  children,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof bannerVariants>) {
  const Icon = ICONS[variant ?? "info"]
  return (
    <div
      data-slot="banner"
      data-variant={variant}
      role={variant === "danger" || variant === "warning" ? "alert" : "status"}
      className={cn(bannerVariants({ variant }), className)}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 [&_p]:text-current/85 [&_strong]:text-current">{children}</div>
    </div>
  )
}

export { Banner, bannerVariants }
