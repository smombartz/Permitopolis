import { cn } from "cn"
import { PauseIcon, TimerIcon } from "lucide-react"
import { plural } from "@/lib/format"

interface ReviewClockProps extends React.ComponentProps<"span"> {
  /** Days counted so far against the allowance. */
  dayCount: number;
  allowedDays: number;
  /** True while a request to the applicant has the clock paused right now. */
  paused?: boolean;
  /** Days paused so far, shown as "paused 2 days". */
  pausedDays?: number;
}

/** "Day 9 of 21 · paused 2 days": a department's review-window clock, presentational only. */
function ReviewClock({ dayCount, allowedDays, paused = false, pausedDays = 0, className, ...props }: ReviewClockProps) {
  const overAllowance = dayCount > allowedDays;
  return (
    <span
      data-slot="review-clock"
      data-paused={paused || undefined}
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[13px]",
        overAllowance ? "text-danger-fg" : "text-fg-secondary",
        className
      )}
      {...props}
    >
      {paused ? <PauseIcon className="size-3.5 shrink-0 text-warning" aria-hidden="true" /> : <TimerIcon className="size-3.5 shrink-0" aria-hidden="true" />}
      Day {dayCount} of {allowedDays}
      {pausedDays > 0 ? ` · paused ${plural(pausedDays, "day")}` : ""}
    </span>
  );
}

export { ReviewClock };
