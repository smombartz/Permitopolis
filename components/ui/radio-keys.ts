import type * as React from "react"

/**
 * The keyboard of a radio group, for a set of `role="radio"` buttons inside one
 * `role="radiogroup"`: the group is one tab stop, and Left/Right, Up/Down, Home and End move to
 * another option and choose it. `SegmentedControl` has this built in; this is for the groups
 * whose options are cards or stars and so are laid out by their screen.
 *
 * Put `onKeyDown={handleRadioGroupKeyDown}` on the group and
 * `tabIndex={radioTabIndex(selected, anySelected, index)}` on each option.
 */
export function handleRadioGroupKeyDown(event: React.KeyboardEvent<HTMLElement>): void {
  const radios = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not(:disabled)'))
  const index = radios.indexOf(event.target as HTMLElement)
  if (index < 0 || event.metaKey || event.ctrlKey || event.altKey) return
  const last = radios.length - 1
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
  radios[next].focus()
  if (radios[next].getAttribute("aria-checked") !== "true") radios[next].click()
}

/** The checked option is the group's tab stop; with nothing checked, the first one is. */
export function radioTabIndex(selected: boolean, anySelected: boolean, index: number): 0 | -1 {
  return selected || (!anySelected && index === 0) ? 0 : -1
}
