import * as React from "react"
import { cn } from "cn"

export interface KeyValueItem {
  label: React.ReactNode
  /** null, undefined or "" renders "Not provided" in fg-label. */
  value: React.ReactNode
}

interface KeyValueListProps extends React.ComponentProps<"dl"> {
  items: KeyValueItem[]
  columns?: 1 | 2
}

function isEmpty(value: React.ReactNode): boolean {
  return value === null || value === undefined || value === ""
}

/** A definition list for record facts: event summary, applicant details, add-ons. */
function KeyValueList({ items, columns = 1, className, ...props }: KeyValueListProps) {
  return (
    <dl
      data-slot="key-value-list"
      className={cn("grid grid-cols-1 gap-x-6 gap-y-4", columns === 2 && "sm:grid-cols-2", className)}
      {...props}
    >
      {items.map((item, index) => (
        <div key={index} className="flex flex-col gap-1">
          <dt className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">{item.label}</dt>
          <dd className="text-sm text-fg">
            {isEmpty(item.value) ? <span className="text-fg-label">Not provided</span> : item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export { KeyValueList }
