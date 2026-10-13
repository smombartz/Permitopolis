import * as React from "react"
import { cn } from "cn"

interface TruncateProps extends React.ComponentProps<"span"> {
  text: string
  /** 1 clips to a single line; 2 clips after the second. Default 1. */
  lines?: 1 | 2
}

/**
 * Single- or two-line truncation with the full text always in `title` (a native
 * tooltip on hover/focus), for the 90-character event and organization names the
 * seed stress-tests.
 */
function Truncate({ text, lines = 1, className, ...props }: TruncateProps) {
  return (
    <span
      data-slot="truncate"
      data-lines={lines}
      title={text}
      className={cn(lines === 1 ? "block truncate" : "line-clamp-2 break-words", className)}
      {...props}
    >
      {text}
    </span>
  )
}

export { Truncate }
