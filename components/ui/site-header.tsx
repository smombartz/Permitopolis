import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import { CitySeal } from "@/components/ui/city-seal";
import { routes } from "@/lib/routes";

interface SiteHeaderProps extends React.ComponentProps<"header"> {
  /** Stays at the top of the screen while the page scrolls: the app's header. Off for a public page. */
  pinned?: boolean;
}

/**
 * The default header: Rime & Ink's "Site header" (`docs/rime-and-ink-design-system.md`, under
 * Layout). One row on a solid band across the whole screen, the city's identity on the left and
 * whatever the page navigates with on the right. No blur and no shadow: it is the one opaque
 * surface that runs edge to edge.
 *
 * On a public page (`/`) it is part of the document and scrolls away with it. In the app it is
 * `pinned`, so the user menu and the Demo menu stay in reach; `--app-header-h` in globals.css is
 * its height, for anything that sticks below it.
 */
function SiteHeader({ pinned = false, className, children, ...props }: SiteHeaderProps) {
  return (
    <header
      data-slot="site-header"
      data-pinned={pinned ? "" : undefined}
      className={cn("border-b border-line-subtle bg-surface-solid", pinned && "sticky top-0 z-40", className)}
      {...props}
    >
      <div className="page-container flex items-center justify-between gap-6 py-4 sm:py-5">{children}</div>
    </header>
  );
}

interface SiteIdentityProps extends Omit<React.ComponentProps<typeof Link>, "href"> {
  href?: string;
  /** Keeps the name and the office to one line each, cut with an ellipsis: for a row shared with controls. */
  truncate?: boolean;
}

/**
 * The seal and the name, as one link to the city's home page. The name is always written out;
 * the seal never stands alone and is hidden from a screen reader.
 */
function SiteIdentity({ href = routes.home(), truncate = false, className, ...props }: SiteIdentityProps) {
  return (
    <Link
      data-slot="site-identity"
      href={href}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-control text-ink-950 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring sm:gap-4",
        className,
      )}
      {...props}
    >
      <CitySeal className="sm:size-14" />
      <span className="flex min-w-0 flex-col">
        <span className={cn("font-heading text-lg leading-tight font-bold text-fg sm:text-h4", truncate && "truncate")}>City of Permitopolis</span>
        <span className={cn("text-sm text-fg-secondary", truncate && "truncate")}>Office of the City Clerk</span>
      </span>
    </Link>
  );
}

/** A section link in the site header's row: 44px tall; on hover its underline fades in and nothing else moves. */
function SiteHeaderNavLink({ className, ...props }: React.ComponentProps<"a">) {
  return (
    <a
      data-slot="site-header-nav-link"
      className={cn(
        "flex h-11 items-center rounded-control px-3 text-sm font-semibold text-fg underline decoration-transparent underline-offset-4 outline-none transition-colors duration-[var(--dur-fast)] ease-frost hover:decoration-current focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring",
        className,
      )}
      {...props}
    />
  );
}

export { SiteHeader, SiteIdentity, SiteHeaderNavLink };
