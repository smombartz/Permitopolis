import * as React from "react"
import { cn } from "cn"

/** The id a page's `<main>` carries, so the skip link has somewhere to land. */
export const MAIN_CONTENT_ID = "main-content"

/**
 * The first tab stop on a page: past the header and its user menu, straight to the page's
 * content (WCAG 2.4.1). Pinned to the top-left corner over everything and slid up out of the
 * viewport until it has focus, so it takes no room in the layout and is still in the tab order
 * and the accessibility tree. It is a plain anchor, not a next/link: a hash on the same page
 * needs no router.
 * The `<main>` it points at takes `id={MAIN_CONTENT_ID}` and `tabIndex={-1}`, so focus really
 * moves there in every browser.
 */
function SkipLink({ className, children = "Skip to main content", ...props }: React.ComponentProps<"a">) {
  return (
    <a
      data-slot="skip-link"
      href={`#${MAIN_CONTENT_ID}`}
      className={cn(
        "fixed top-3 left-3 z-[60] -translate-y-[200%] rounded-control bg-surface-solid px-4 py-2.5 text-sm font-semibold text-fg shadow-hud transition-transform duration-[var(--dur-fast)] ease-frost focus:translate-y-0",
        className
      )}
      {...props}
    >
      {children}
    </a>
  )
}

export { SkipLink }
