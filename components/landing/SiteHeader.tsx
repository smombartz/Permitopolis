"use client";

import Link from "next/link";
import { cn } from "cn";
import { LandmarkIcon, MenuIcon } from "lucide-react";
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
 * The city site's header, in three bands: the official-website line, the city's seal and name
 * with the two doors, and the section nav on a solid night strip. It scrolls with the page; a
 * city office's header is part of the document, not a floating control.
 *
 * Below 768px the doors leave the identity row and the strip's anchors fold into one "Menu"
 * button that holds the anchors and both doors. The two layouts are both in the markup and
 * switched with CSS, so a phone gets the right one from the first paint, before any script runs.
 *
 * The doors are plain links until `useHydrated()` is true (readme: "enable a door or a jump
 * only once useHydrated() is true"); afterwards they also set the role first (`useDoors()`), so
 * the destination opens for the right role.
 */
function SiteHeader() {
  const doors = useDoors();

  return (
    <header className="bg-surface-solid">
      <div className="border-b border-line-subtle bg-page">
        <p className="page-container flex items-center gap-2 py-1.5 text-xs text-fg-label">
          <LandmarkIcon className="size-3.5 shrink-0" aria-hidden="true" />
          An official website of the City of Permitopolis
        </p>
      </div>

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

        <div className="hidden shrink-0 items-center gap-6 md:flex">
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

      <nav aria-label="Primary" data-tone="night" className="bg-night">
        <div className="page-container flex min-h-12 items-center">
          <ul className="-ml-4 hidden items-stretch md:flex">
            {SECTION_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="flex h-12 items-center border-b-[3px] border-transparent px-4 pt-[3px] text-sm font-semibold text-night-fg outline-none transition-colors duration-150 ease-nav hover:border-night-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="-ml-3 md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="dark" size="sm" className="text-sm shadow-none">
                  <MenuIcon aria-hidden="true" />
                  Menu
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60">
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
        </div>
      </nav>
    </header>
  );
}

export { SiteHeader };
