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

interface BannerProps extends React.ComponentProps<"div">, VariantProps<typeof bannerVariants> {
  /**
   * Set it on a banner that appears in answer to something the person just did (a date picked,
   * a form sent): it is then a polite status, read out once. Without it a banner is page
   * content with no live role. Most banners are on the page when it opens, and a `role="alert"`
   * on each of those interrupted a screen reader on arrival and again on every remount.
   */
  live?: boolean
}

/** A page-level message: an icon, a tint and the words. The icon and the words carry it, never the tint alone. */
function Banner({
  className,
  variant = "info",
  live = false,
  children,
  ...props
}: BannerProps) {
  const Icon = ICONS[variant ?? "info"]
  return (
    <div
      data-slot="banner"
      data-variant={variant}
      role={live ? "status" : undefined}
      className={cn(bannerVariants({ variant }), className)}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {/* Full strength: at 85% the success and warning inks are 3.9:1 on their tints (lib/contrast.test.ts). */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export { Banner, bannerVariants }
