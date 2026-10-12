import * as React from "react"
import { cn } from "cn"

/** Mono keyboard hint. Adapts to any text color via currentColor. */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex items-center rounded-kbd border border-current/20 bg-current/8 px-1.5 py-0.5 font-mono text-[0.72em] leading-none",
        className
      )}
      {...props}
    />
  )
}

export { Kbd }
