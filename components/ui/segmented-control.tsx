"use client"

import * as React from "react"
import { cn } from "cn"

export interface SegmentedControlOption<T extends string> {
  value: T
  label: React.ReactNode
  icon?: React.ReactNode
}

interface SegmentedControlProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: SegmentedControlOption<T>[]
  className?: string
  "aria-label": string
}

/** The role switcher and small view toggles: a radiogroup of equal-weight options. */
function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
  ...props
}: SegmentedControlProps<T>) {
  return (
    <div
      data-slot="segmented-control"
      role="radiogroup"
      className={cn("inline-flex items-center gap-[3px] rounded-control bg-surface-2 p-[3px]", className)}
      {...props}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-row px-3 text-sm font-medium whitespace-nowrap outline-none transition-all duration-[var(--dur-fast)] ease-frost focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
              selected
                ? "bg-surface-strong text-fg shadow-card"
                : "text-fg-secondary hover:text-fg"
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export { SegmentedControl }
