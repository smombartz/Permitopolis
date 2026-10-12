import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full min-w-0 rounded-control border border-line-subtle bg-surface-strong px-3.5 py-3 text-base text-fg transition-colors duration-[var(--dur-fast)] ease-frost outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-fg placeholder:text-fg-tertiary focus-visible:border-focus-ring focus-visible:bg-surface-hover focus-visible:shadow-focus-halo disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:shadow-[0_0_0_4px_var(--danger-surface)] md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
