import { cn } from "cn"
import { Truncate } from "@/components/ui/truncate"

interface EventTitleProps extends React.ComponentProps<"div"> {
  name: string
  applicantName: string
}

/** A dense list row's identity cell: the event name over the applicant's name, both truncated. */
function EventTitle({ name, applicantName, className, ...props }: EventTitleProps) {
  return (
    <div data-slot="event-title" className={cn("flex min-w-0 flex-col", className)} {...props}>
      <Truncate text={name} className="text-sm font-semibold text-fg" />
      <Truncate text={applicantName} className="text-xs text-fg-secondary" />
    </div>
  )
}

export { EventTitle }
