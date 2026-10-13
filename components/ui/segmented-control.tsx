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

/**
 * The role switcher and small view toggles: a radiogroup of equal-weight options. It behaves
 * as a radio group does for a keyboard: the group is one tab stop (the selected option), and
 * Left/Right (or Up/Down), Home and End move to another option and select it.
 */
function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
  ...props
}: SegmentedControlProps<T>) {
  const buttons = React.useRef<(HTMLButtonElement | null)[]>([])
  const selectedIndex = options.findIndex((option) => option.value === value)
  // With nothing selected the first option takes the tab stop, so the group stays reachable.
  const tabStop = selectedIndex === -1 ? 0 : selectedIndex

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = options.length - 1
    let next: number
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = index === last ? 0 : index + 1
        break
      case "ArrowLeft":
      case "ArrowUp":
        next = index === 0 ? last : index - 1
        break
      case "Home":
        next = 0
        break
      case "End":
        next = last
        break
      default:
        return
    }
    event.preventDefault()
    buttons.current[next]?.focus()
    if (options[next].value !== value) onChange(options[next].value)
  }

  return (
    <div
      data-slot="segmented-control"
      role="radiogroup"
      className={cn("inline-flex items-center gap-[3px] rounded-control bg-surface-2 p-[3px]", className)}
      {...props}
    >
      {options.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            ref={(node) => {
              buttons.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={index === tabStop ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
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
