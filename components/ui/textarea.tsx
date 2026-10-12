import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-control border border-line-subtle bg-surface-strong px-3.5 py-3 text-base text-fg transition-colors duration-[var(--dur-fast)] ease-frost outline-none placeholder:text-fg-tertiary focus-visible:border-focus-ring focus-visible:bg-surface-hover focus-visible:shadow-focus-halo disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:shadow-[0_0_0_4px_var(--danger-surface)] md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
