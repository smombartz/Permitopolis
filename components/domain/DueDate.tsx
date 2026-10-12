import { cn } from "cn"
import { CircleAlertIcon, ClockIcon } from "lucide-react"
import { fmtDue, fmtDueFull, isOverdue } from "@/lib/format"
import type { ISODate } from "@/lib/types"

interface DueDateProps extends React.ComponentProps<"span"> {
  date: ISODate;
  today: ISODate;
  /** Drops the absolute date, keeping only "Overdue by 2 days". */
  relativeOnly?: boolean;
}

/** "Due in 6 days · Sat, May 8", in danger color with a warning icon once overdue. */
function DueDate({ date, today, relativeOnly = false, className, ...props }: DueDateProps) {
  const overdue = isOverdue(date, today);
  const Icon = overdue ? CircleAlertIcon : ClockIcon;
  return (
    <span
      data-slot="due-date"
      data-overdue={overdue || undefined}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm",
        overdue ? "font-semibold text-danger-fg" : "text-fg-secondary",
        className
      )}
      {...props}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {relativeOnly ? fmtDue(date, today) : fmtDueFull(date, today)}
    </span>
  );
}

export { DueDate };
