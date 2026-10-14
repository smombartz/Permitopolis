import Link from "next/link";
import { cn } from "cn";
import { CountBadge } from "@/components/ui/count-badge";
import { plural } from "@/lib/format";
import { CITY_CORE_LINKS, cityToolLinks, type SidebarLink } from "@/lib/view/shell";
import type { Dept } from "@/lib/types";

interface CityNavProps {
  role: Dept;
  pathname: string;
  queueCount: number;
}

function basePath(href: string): string {
  return href.split("?")[0];
}

/** One tab in the row: the current one gets the indigo underline the line tabs use, nothing else moves. */
function NavTab({ link, active, badge }: { link: SidebarLink; active: boolean; badge?: number }) {
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-12 items-center gap-2 rounded-row px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors duration-[var(--dur-fast)] ease-frost focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring",
        "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-indigo-650 after:opacity-0 after:transition-opacity after:duration-[var(--dur-fast)]",
        active ? "text-fg after:opacity-100" : "text-fg-secondary hover:text-fg",
      )}
    >
      <span>{link.label}</span>
      {badge !== undefined && badge > 0 ? (
        <>
          <CountBadge count={badge} variant="accent" aria-hidden="true" />
          <span className="sr-only">, {plural(badge, "task")} to do</span>
        </>
      ) : null}
    </Link>
  );
}

/**
 * The city's section navigation, a row of tabs on a band right below the site header: My queue,
 * Cases, Active permits, a rule, then the role's own tools. `queueCount` is the number of tasks
 * the role can act on now (`queueFor(...).length`), the same rows My queue lists. It scrolls
 * away with the page (only the header is pinned), and scrolls sideways if a narrow window
 * cannot fit it.
 */
function CityNav({ role, pathname, queueCount }: CityNavProps) {
  // A page under a link's path belongs to it: a case's detail page keeps "Cases" current.
  const isActive = (href: string) => pathname === basePath(href) || pathname.startsWith(`${basePath(href)}/`);

  return (
    <nav aria-label="City" className="border-b border-line-subtle bg-surface-1">
      <div className="page-container flex items-center gap-1 overflow-x-auto">
        <ul className="flex items-center gap-1">
          {CITY_CORE_LINKS.map((link) => (
            <li key={link.href}>
              <NavTab link={link} active={isActive(link.href)} badge={link.label === "My queue" ? queueCount : undefined} />
            </li>
          ))}
        </ul>
        <div aria-hidden="true" className="mx-2 h-5 w-px shrink-0 bg-line-subtle" />
        <ul className="flex items-center gap-1">
          {cityToolLinks(role).map((link) => (
            <li key={link.href}>
              <NavTab link={link} active={isActive(link.href)} />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

export { CityNav };
