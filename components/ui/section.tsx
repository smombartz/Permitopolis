import * as React from "react"
import { cn } from "cn"

interface SectionProps extends Omit<React.ComponentProps<"section">, "title"> {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}

/** A titled block of a page: Reviews, Documents, Conditions and fees, and so on. */
function Section({ title, description, actions, className, children, ...props }: SectionProps) {
  return (
    <section data-slot="section" className={cn("flex flex-col gap-4", className)} {...props}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-subtle pb-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-base font-bold text-fg">{title}</h2>
          {description ? <p className="max-w-2xl text-sm text-fg-secondary">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}

export { Section }
