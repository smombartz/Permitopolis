import * as React from "react"
import { cn } from "cn"
import { SparklesIcon } from "lucide-react"

/** A demo hint: "try this next" callouts the Demo menu and hint mode use. */
function Callout({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="callout"
      className={cn(
        "flex items-start gap-2.5 rounded-control border border-dashed border-indigo-650/35 bg-pill px-3.5 py-3 text-sm text-fg-pill",
        className
      )}
      {...props}
    >
      <SparklesIcon className="mt-0.5 size-4 shrink-0 text-indigo-650" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export { Callout }
