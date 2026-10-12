import * as React from "react"
import { cn } from "cn"

/** The pill above a section headline: 11px/600 uppercase, .12em, pill colors. */
function Eyebrow({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="eyebrow"
      className={cn(
        "inline-flex w-fit items-center rounded-control border border-pill-border bg-pill px-2.5 py-1 text-eyebrow font-semibold tracking-[.12em] text-fg-pill uppercase",
        className
      )}
      {...props}
    />
  )
}

export { Eyebrow }
