import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import { ArrowLeftIcon } from "lucide-react"
import { Eyebrow } from "@/components/ui/eyebrow"

const BACK_LINK_CLASS =
  "inline-flex w-fit items-center gap-1.5 rounded-control text-sm font-medium text-fg-secondary outline-none transition-colors duration-[var(--dur-fast)] ease-frost hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"

interface PageHeaderProps extends Omit<React.ComponentProps<"header">, "title"> {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  /** Buttons or other controls, right-aligned next to the title. */
  actions?: React.ReactNode
  /** Renders a back link (a next/link, so the store stays in memory). Use `onBack` instead when there is no URL to go to. */
  backHref?: string
  onBack?: () => void
  backLabel?: React.ReactNode
}

/** The top of a page: an optional back link, an eyebrow, the title and description, and an actions slot. */
function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  backHref,
  onBack,
  backLabel = "Back",
  className,
  ...props
}: PageHeaderProps) {
  const showBack = Boolean(backHref || onBack)
  return (
    <header data-slot="page-header" className={cn("flex flex-col gap-3", className)} {...props}>
      {showBack ? (
        backHref ? (
          <Link href={backHref} className={BACK_LINK_CLASS}>
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            {backLabel}
          </Link>
        ) : (
          <button type="button" onClick={onBack} className={BACK_LINK_CLASS}>
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            {backLabel}
          </button>
        )
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <h1 className="text-h4 font-bold text-fg">{title}</h1>
          {description ? <p className="max-w-2xl text-sm text-fg-secondary">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}

export { PageHeader }
