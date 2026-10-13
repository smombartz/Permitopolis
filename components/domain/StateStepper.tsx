import { Fragment } from "react"
import { cn } from "cn"
import { CheckIcon, TriangleAlertIcon } from "lucide-react"
import { ENDING_ICON } from "@/components/domain/icons"
import { ENDING_LABEL, MAIN_PATH, STATE_LABEL, type CaseState, type Ending } from "@/lib/types"

interface StateStepperProps {
  state: CaseState
  ending?: Ending | null
  /** Small markers with no labels, for a card. */
  compact?: boolean
  className?: string
}

/**
 * The eight MAIN_PATH states with the current one marked. `needs_info` shows
 * as a warning marker on top of "In review" rather than its own step, since
 * MAIN_PATH treats it as a variant of in_review. An ending stops the line at
 * the state it ended in, with its own marker and label.
 */
function StateStepper({ state, ending, compact = false, className }: StateStepperProps) {
  const effective: CaseState = state === "needs_info" ? "in_review" : state
  const activeIndex = MAIN_PATH.indexOf(effective)
  const EndingIcon = ending ? ENDING_ICON[ending] : null
  // The step actually in play right now, for the compact view's visible label:
  // the state it ended in, "Needs info" when that marker is showing, or the
  // plain current step otherwise.
  const currentLabel = ending
    ? ENDING_LABEL[ending]
    : state === "needs_info"
      ? "Needs info"
      : STATE_LABEL[effective]

  return (
    <div data-slot="state-stepper-group" className={cn("flex w-full flex-col gap-1.5", className)}>
      <div
        data-slot="state-stepper"
        data-compact={compact || undefined}
        role="list"
        aria-label="Case progress"
        // The Needs info pill sits 28px above its marker: the row keeps that room for it, so it
        // never lies over whatever is above the stepper (the case header's meta line).
        className={cn("flex w-full items-start", state === "needs_info" && !ending && !compact && "pt-7")}
      >
        {MAIN_PATH.map((step, index) => {
          const done = !ending && index < activeIndex
          const isCurrent = index === activeIndex
          const stopped = isCurrent && !!ending
          const showNeedsInfo = isCurrent && !ending && state === "needs_info"
          const stepName = stopped ? ENDING_LABEL[ending as Ending] : STATE_LABEL[step]

          return (
            <Fragment key={step}>
              <div role="listitem" className="relative flex flex-col items-center gap-2">
                {showNeedsInfo ? (
                  <span
                    className={cn(
                      "absolute -top-7 inline-flex items-center gap-1 rounded-full border border-warning-border bg-warning-surface px-2 py-0.5 text-[10px] font-bold whitespace-nowrap text-warning-fg uppercase",
                      compact && "hidden"
                    )}
                  >
                    <TriangleAlertIcon className="size-3" aria-hidden="true" />
                    Needs info
                  </span>
                ) : null}
                <span
                  aria-current={isCurrent ? "step" : undefined}
                  title={compact ? stepName : undefined}
                  className={cn(
                    "flex shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    compact ? "size-2.5" : "size-4",
                    done && "border-indigo-650 bg-indigo-650 text-fg-on-accent",
                    isCurrent &&
                      !stopped &&
                      "border-indigo-650 bg-surface-solid text-indigo-650 shadow-step-lit",
                    stopped && "border-danger bg-danger-surface text-danger-fg",
                    !done && !isCurrent && "border-line-magnetic bg-surface-solid"
                  )}
                >
                  {!compact && done ? <CheckIcon className="size-2.5 stroke-[3px]" aria-hidden="true" /> : null}
                  {!compact && stopped && EndingIcon ? (
                    <EndingIcon className="size-2.5 stroke-[3px]" aria-hidden="true" />
                  ) : null}
                  {/* Every marker, compact or not, carries its own accessible name. */}
                  <span className="sr-only">{stepName}</span>
                </span>
                {!compact ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "text-[11px] font-medium whitespace-nowrap",
                      done || isCurrent ? "text-fg" : "text-fg-secondary",
                      isCurrent && "font-bold"
                    )}
                  >
                    {stepName}
                  </span>
                ) : null}
              </div>
              {index < MAIN_PATH.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-2 h-px flex-1",
                    compact ? "mt-[5px]" : "mt-2",
                    done ? "bg-indigo-650" : "bg-line-subtle"
                  )}
                />
              ) : null}
            </Fragment>
          )
        })}
      </div>
      {compact ? (
        <p className={cn("text-xs font-semibold whitespace-nowrap", ending ? "text-danger-fg" : "text-fg")}>
          {currentLabel}
        </p>
      ) : null}
    </div>
  )
}

export { StateStepper }
