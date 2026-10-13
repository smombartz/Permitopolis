import * as React from "react"
import { cn } from "cn"

interface ToolbarProps extends React.ComponentProps<"div"> {
  "aria-label": string
}

/** A row of grouped actions above a list or table. */
function Toolbar({ className, ...props }: ToolbarProps) {
  return (
    <div
      data-slot="toolbar"
      role="toolbar"
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    />
  )
}

export { Toolbar }
