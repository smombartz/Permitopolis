"use client";

import Link from "next/link";
import { cn } from "cn";
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
import { CitySeal } from "./CitySeal";
import { useDoors } from "./hooks";
import { SECTION_LINKS, TEXT_LINK } from "./sections";

/**
 * The city site's header, one row on a solid surface: the city's seal and name, then the section
 * nav, "City staff" and "Plan an event". It scrolls with the page; a city office's header is part
 * of the document, not a floating control.
 *
 * Below 1024px the row has no room for the anchors and the doors beside the name, so they fold
 * into one "Menu" button. The two layouts are both in the markup and switched with CSS, so a
 * phone gets the right one from the first paint, before any script runs.
 *
 * The doors are plain links until `useHydrated()` is true (readme: "enable a door or a jump
 * only once useHydrated() is true"); afterwards they also set the role first (`useDoors()`), so
 * the destination opens for the right role.
 */
function SiteHeader() {
  const doors = useDoors();

  return (
    <header className="border-b border-line-subtle bg-surface-solid">
      <div className="page-container flex items-center justify-between gap-6 py-4 sm:py-5">
        <Link
          href={routes.home()}
          className="flex min-w-0 items-center gap-3 rounded-control text-ink-950 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring sm:gap-4"
        >
          <CitySeal className="sm:size-14" />
          <span className="flex min-w-0 flex-col">
            <span className="font-heading text-lg leading-tight font-bold text-fg sm:text-h4">City of Permitopolis</span>
            <span className="text-sm text-fg-secondary">Office of the City Clerk</span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-6">
          <nav aria-label="Primary">
            <ul className="hidden items-center gap-1 lg:flex">
              {SECTION_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="flex h-11 items-center rounded-control px-3 text-sm font-semibold text-fg underline-offset-4 outline-none hover:underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>

            <div className="lg:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="text-sm shadow-none">
                    <MenuIcon aria-hidden="true" />
                    Menu
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  {SECTION_LINKS.map((link) => (
                    <DropdownMenuItem key={link.href} asChild>
                      <a href={link.href}>{link.label}</a>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={routes.apply()} onClick={doors.planAnEvent}>
                      Plan an event
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={routes.city.queue()} onClick={doors.cityStaff}>
                      City staff
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </nav>

          <div className="hidden items-center gap-6 lg:flex">
            <Link href={routes.city.queue()} onClick={doors.cityStaff} className={cn("text-sm", TEXT_LINK)}>
              City staff
            </Link>
            <Button asChild>
              <Link href={routes.apply()} onClick={doors.planAnEvent}>
                Plan an event
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

export { SiteHeader };
