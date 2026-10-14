import Link from "next/link";
import { cn } from "cn";
import { CountBadge } from "@/components/ui/count-badge";
import { plural } from "@/lib/format";
import { CITY_CORE_LINKS, cityToolLinks, type SidebarLink } from "@/lib/view/shell";
import type { Dept } from "@/lib/types";

interface CitySidebarProps {
  role: Dept;
  pathname: string;
  queueCount: number;
}

function basePath(href: string): string {
  return href.split("?")[0];
}

function NavRow({ link, active, badge }: { link: SidebarLink; active: boolean; badge?: number }) {
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center justify-between gap-2 rounded-row px-3 py-2 text-sm font-medium outline-none transition-colors duration-[var(--dur-fast)] ease-frost focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
        active ? "bg-surface-strong text-fg" : "text-fg-secondary hover:bg-surface-2 hover:text-fg",
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
 * The city layout's left sidebar: My queue, Cases, Active permits, then the role's own tools.
 * `queueCount` is the number of tasks the role can act on now (`queueFor(...).length`), the
 * same rows My queue lists.
 */
function CitySidebar({ role, pathname, queueCount }: CitySidebarProps) {
  // A page under a link's path belongs to it: a case's detail page keeps "Cases" current.
  const isActive = (href: string) => pathname === basePath(href) || pathname.startsWith(`${basePath(href)}/`);

  return (
    <nav aria-label="City" className="flex w-56 shrink-0 flex-col gap-1">
      <ul className="flex flex-col gap-0.5">
        {CITY_CORE_LINKS.map((link) => (
          <li key={link.href}>
            <NavRow link={link} active={isActive(link.href)} badge={link.label === "My queue" ? queueCount : undefined} />
          </li>
        ))}
      </ul>
      <div className="my-2 h-px bg-line-subtle" />
      <ul className="flex flex-col gap-0.5">
        {cityToolLinks(role).map((link) => (
          <li key={link.href}>
            <NavRow link={link} active={isActive(link.href)} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

export { CitySidebar };
