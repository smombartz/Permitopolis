import { cn } from "cn"
import { BanIcon, CalendarXIcon, CircleCheckIcon, TriangleAlertIcon, type LucideIcon } from "lucide-react"
import type { Availability } from "@/lib/types"

const AVAILABILITY_ICON: Record<Availability["status"], LucideIcon> = {
  open: CircleCheckIcon,
  impacted: TriangleAlertIcon,
  booked: CalendarXIcon,
  blackout: BanIcon,
}

const AVAILABILITY_LABEL: Record<Availability["status"], string> = {
  open: "Open",
  impacted: "Impacted",
  booked: "Booked",
  blackout: "Blackout",
}

const AVAILABILITY_CLASS: Record<Availability["status"], string> = {
  open: "border-success-border bg-success-surface text-success-fg",
  impacted: "border-warning-border bg-warning-surface text-warning-fg",
  booked: "border-danger-border bg-danger-surface text-danger-fg",
  blackout: "border-danger-border bg-danger-surface text-danger-fg",
}

interface AvailabilityBadgeProps extends React.ComponentProps<"span"> {
  availability: Availability
}

/** Open, Impacted (with its reason), Booked or Blackout, each with its own icon. */
function AvailabilityBadge({ availability, className, ...props }: AvailabilityBadgeProps) {
  const Icon = AVAILABILITY_ICON[availability.status]
  return (
    <span
      data-slot="availability-badge"
      data-status={availability.status}
      className={cn(
        "inline-flex h-7 w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold whitespace-nowrap",
        AVAILABILITY_CLASS[availability.status],
        className
      )}
      {...props}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {AVAILABILITY_LABEL[availability.status]}
      {availability.reason ? (
        <span className="font-normal text-current/85 normal-case">· {availability.reason}</span>
      ) : null}
    </span>
  )
}

export { AvailabilityBadge }
