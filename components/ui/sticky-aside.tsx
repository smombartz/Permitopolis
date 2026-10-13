import * as React from "react"
import { cn } from "cn"
import { Panel, type panelVariants } from "@/components/ui/panel"
import type { VariantProps } from "class-variance-authority"

interface StickyAsideProps extends React.ComponentProps<"aside">, VariantProps<typeof panelVariants> {
  /** How far from the top of the viewport it sticks, e.g. below a fixed top bar. */
  topOffset?: string
}

/** A right-hand panel that stays in view while the page scrolls: a case's action panel. */
function StickyAside({ topOffset = "5rem", variant = "frosted", className, children, ...props }: StickyAsideProps) {
  return (
    <aside
      data-slot="sticky-aside"
      className={cn("h-fit", className)}
      style={{ position: "sticky", top: topOffset }}
      {...props}
    >
      <Panel variant={variant} className="p-5">
        {children}
      </Panel>
    </aside>
  )
}

export { StickyAside }
