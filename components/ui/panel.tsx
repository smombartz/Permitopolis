import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/**
 * The base raised surface. `frosted` is the everyday card/panel (glass-edge
 * border, surface-1 fill, card shadow, 28px blur). `hud` is the modal/palette
 * treatment (magnetic border, tinted glass, HUD shadow, 30px blur). `night`
 * is the one dark-interlude surface in the system. `plain` and `soft` are flat
 * fills with no blur, for repeated rows and cards where blur would stutter
 * (CLAUDE.md: "Backdrop blur is for chrome ... not for repeated rows and cards").
 */
const panelVariants = cva("rounded-panel", {
  variants: {
    variant: {
      frosted: "border border-line-glass bg-surface-1 text-fg shadow-card backdrop-blur-panel",
      hud: "border border-line-magnetic bg-glass-tinted text-fg shadow-hud backdrop-blur-hud",
      plain: "border border-line-subtle bg-surface-2 text-fg",
      soft: "border border-dashed border-line-subtle bg-surface-soft text-fg-secondary",
      night: "border border-night-line bg-night text-night-fg shadow-glass-dark backdrop-blur-hud",
    },
  },
  defaultVariants: {
    variant: "frosted",
  },
})

function Panel({
  className,
  variant = "frosted",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof panelVariants>) {
  return (
    <div
      data-slot="panel"
      data-variant={variant}
      className={cn(panelVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Panel, panelVariants }
