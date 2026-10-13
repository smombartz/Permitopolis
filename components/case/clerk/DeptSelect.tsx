"use client"

import { cn } from "cn"
import { DEPTS, PARTY_LABEL, type Dept } from "@/lib/types"

/** A native select at the height of an `Input`: the look of the flat pickers in the Clerk's editors. */
export const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-control border border-line-subtle bg-surface-1 px-2.5 text-sm text-fg outline-none focus-visible:border-focus-ring focus-visible:shadow-focus-halo"

/**
 * Which department a condition or a fee line belongs to. A flat list of three with no groups
 * or icons, so a native select and not the Radix one (the readme's rule; `FilterBar` does the
 * same), which also keeps a sheet with a dozen rows cheap to mount.
 *
 * Inside a `Field` it takes the id the label points at (and the hint and error ids) and puts
 * them on the select: dropped, they left "Department" a label for nothing.
 */
interface DeptSelectProps {
  value: Dept
  onChange: (dept: Dept) => void
  ariaLabel?: string
  className?: string
  /** Set by `Field`. */
  id?: string
  "aria-describedby"?: string
  "aria-invalid"?: boolean | "true" | "false"
  "aria-required"?: boolean | "true" | "false"
}

function DeptSelect({ value, onChange, ariaLabel, className, ...field }: DeptSelectProps) {
  return (
    <select {...field} aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value as Dept)} className={cn(NATIVE_SELECT_CLASS, className)}>
      {DEPTS.map((d) => (
        <option key={d} value={d}>
          {PARTY_LABEL[d]}
        </option>
      ))}
    </select>
  )
}

export { DeptSelect }
