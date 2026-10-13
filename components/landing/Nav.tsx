"use client";

import Link from "next/link";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { routes } from "@/lib/routes";
import { useIsNarrow } from "@/components/shell";
import { useDoors } from "./hooks";

const ANCHOR_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#event-tiers", label: "Event tiers" },
  { href: "#fees", label: "Fees" },
  { href: "#questions", label: "Questions" },
];

/**
 * The floating glass nav (plan 7, row 1): centered, 16px from the top, the wordmark and the
 * four in-page anchors, then the two doors. Below 768px the anchors and doors collapse into
 * one menu button, the same shape as the app's own `useIsNarrow` collapse.
 *
 * The doors are plain links until `useHydrated()` is true (readme: "enable a door or a jump
 * only once useHydrated() is true"); afterwards they also set the role first (`useDoors()`), so
 * the destination opens for the right role.
 */
function Nav() {
  const narrow = useIsNarrow();
  const doors = useDoors();

  return (
    <nav
      aria-label="Primary"
      className="sticky top-4 z-50 mx-auto flex w-fit max-w-[calc(100vw-32px)] items-center gap-1 rounded-window border border-line-glass bg-glass-tinted px-2 py-2 shadow-nav backdrop-blur-nav"
    >
      <Link
        href={routes.home()}
        className="flex shrink-0 items-center gap-2 rounded-control px-2.5 py-1.5 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        <span className="font-heading text-sm font-bold text-fg">Permitopolis</span>
        <span className="hidden text-xs text-fg-secondary sm:inline">City Clerk &middot; Events Permitting</span>
      </Link>

      {narrow ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Open menu" className="ml-auto">
              <MenuIcon aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {ANCHOR_LINKS.map((link) => (
              <DropdownMenuItem key={link.href} asChild>
                <a href={link.href}>{link.label}</a>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={routes.city.queue()} onClick={doors.cityStaff}>
                City staff
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={routes.apply()} onClick={doors.planAnEvent}>
                Plan an event
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <>
          <div className="flex items-center gap-1 px-1">
            {ANCHOR_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-control px-3 py-2 text-sm font-medium text-fg-secondary outline-none transition-colors duration-150 ease-nav hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                {link.label}
              </a>
            ))}
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href={routes.city.queue()} onClick={doors.cityStaff}>
              City staff
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={routes.apply()} onClick={doors.planAnEvent}>
              Plan an event
            </Link>
          </Button>
        </>
      )}
    </nav>
  );
}

export { Nav };
