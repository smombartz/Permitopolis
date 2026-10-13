import * as React from "react"
import { cn } from "cn"
import { CheckIcon } from "lucide-react"

export interface WizardStepDef {
  label: string
}

interface WizardStepperProps extends React.ComponentProps<"ol"> {
  steps: WizardStepDef[]
  /** 0-based index of the step in view. */
  current: number
  /**
   * 0-based index of the furthest step reached so far. Defaults to `current`. Someone who goes
   * back from step 4 to step 2 has still done steps 3 and 4: they keep their mark and their link.
   */
  reached?: number
  /** Called for a done step, so it can be reopened for editing. Steps past `reached` are never clickable. */
  onStepSelect?: (index: number) => void
}

/**
 * The wizard's 1-to-5 stepper. Done steps (every step up to the furthest one reached, but the
 * one in view) are clickable to go and edit; labels collapse to numbered markers alone below
 * the `sm` breakpoint ("compact on mobile"). The label is only hidden from sight there
 * (`sr-only`, never `display: none`): the marker is decorative, so the label and "Step N" are
 * each step's whole accessible name.
 */
function WizardStepper({ steps, current, reached, onStepSelect, className, ...props }: WizardStepperProps) {
  const furthest = Math.max(current, reached ?? current)
  return (
    <ol
      data-slot="wizard-stepper"
      aria-label="Application steps"
      className={cn("flex w-full items-center", className)}
      {...props}
    >
      {steps.map((step, index) => {
        const isCurrent = index === current
        const done = !isCurrent && index <= furthest
        const clickable = done && Boolean(onStepSelect)
        const marker = (
          <span
            aria-hidden="true"
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold",
              done && "border-indigo-650 bg-indigo-650 text-fg-on-accent",
              isCurrent && "border-indigo-650 bg-surface-solid text-indigo-650 shadow-step-lit",
              !done && !isCurrent && "border-line-magnetic bg-surface-solid text-fg-label"
            )}
          >
            {done ? <CheckIcon className="size-3 stroke-[3px]" aria-hidden="true" /> : index + 1}
          </span>
        )
        return (
          <li key={step.label} className="flex flex-1 items-center gap-2 last:flex-none">
            {clickable ? (
              <button
                type="button"
                onClick={() => onStepSelect?.(index)}
                aria-current={isCurrent ? "step" : undefined}
                className="flex items-center gap-1.5 rounded-control outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                {marker}
                <span className="sr-only">Step {index + 1}: </span>
                <span className="sr-only text-xs font-medium whitespace-nowrap text-fg-secondary sm:not-sr-only">
                  {step.label}
                </span>
                <span className="sr-only">, done, edit</span>
              </button>
            ) : (
              <span className="flex items-center gap-1.5" aria-current={isCurrent ? "step" : undefined}>
                {marker}
                <span className="sr-only">Step {index + 1}: </span>
                <span
                  className={cn(
                    "sr-only text-xs font-medium whitespace-nowrap sm:not-sr-only",
                    isCurrent ? "font-bold text-fg" : "text-fg-secondary"
                  )}
                >
                  {step.label}
                </span>
              </span>
            )}
            {index < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn("h-px flex-1 sm:w-8", index < furthest ? "bg-indigo-650" : "bg-line-subtle")}
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

export { WizardStepper }
