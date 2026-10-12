import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

/**
 * Rime & Ink button. Sizes map to the system's 36/44/56px scale (sm/default/lg).
 * Hover rises 2px, active compresses the shadow back to the resting plane, all
 * on the 180ms frost easing. Primary is the only filled, high-contrast variant;
 * "Indigo is the only action color" means every other variant stays quiet.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-control border bg-clip-padding font-semibold whitespace-nowrap transition-all duration-[var(--dur-fast)] ease-frost outline-none select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:stroke-[2px] [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "border-black/10 bg-indigo-650 text-fg-on-accent shadow-button hover:-translate-y-0.5 hover:bg-indigo-500 active:translate-y-0 active:shadow-button-pressed",
        secondary:
          "border-line-subtle bg-surface-1 text-fg shadow-card backdrop-blur-button hover:-translate-y-0.5 hover:bg-surface-strong active:translate-y-0 active:shadow-secondary-pressed",
        dark:
          "border-transparent bg-ink-950 text-fg-on-accent shadow-button-dark hover:-translate-y-0.5 hover:bg-ink-800 active:translate-y-0",
        ghost:
          "border-transparent bg-transparent text-fg-secondary hover:bg-surface-2 hover:text-fg active:bg-surface-3",
        destructive:
          "border-danger-border bg-danger-surface text-danger-fg hover:bg-danger-surface-strong active:bg-danger-surface",
        link: "h-auto! border-transparent bg-transparent p-0! font-medium text-fg-accent underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 gap-1.5 px-3 text-xs has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        default: "h-11 gap-1.5 px-4 text-sm has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        lg: "h-14 gap-2 px-5 text-base has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-11 p-0",
        "icon-sm": "size-9 p-0",
        "icon-lg": "size-14 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "primary",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
