"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import { MenuIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SiteHeader as SiteHeaderBand, SiteHeaderNavLink, SiteIdentity } from "@/components/ui/site-header";
import { routes } from "@/lib/routes";
import { useDoors } from "./hooks";
import { SECTION_LINKS, TEXT_LINK } from "./sections";

/**
 * The city site's header: Rime & Ink's "Site header" (`docs/rime-and-ink-design-system.md`,
 * under Layout and Links). One row on a solid band across the whole screen: the city's seal and
 * name, then the section nav, "City staff" and "Plan an event". It scrolls with the page; a city
 * office's header is part of the document, not a floating control. The band, the identity and the
 * section link are the shared ones in `components/ui/site-header.tsx`; the app's header is built
 * from the same parts (`components/shell/TopBar.tsx`).
 *
 * Below 1024px the row has no room for the anchors and the doors beside the name, so they fold
 * into one "Menu" button that opens a menu over the whole screen. The two layouts are both in
 * the markup and switched with CSS, so a phone gets the right one from the first paint, before
 * any script runs.
 *
 * The doors are plain links until `useHydrated()` is true (readme: "enable a door or a jump
 * only once useHydrated() is true"); afterwards they also set the role first (`useDoors()`), so
 * the destination opens for the right role.
 */
function SiteHeader() {
  const doors = useDoors();
  const [menuOpen, setMenuOpen] = React.useState(false);
  // A section link in the menu scrolls the page away from the "Menu" button. Radix would hand
  // focus back to the button as the menu closes, which scrolls the header back into view and
  // undoes the jump; after an anchor, focus is left to follow the link instead.
  const followedAnchor = React.useRef(false);

  // The menu is for a narrow screen. Widened past 1024px (a tablet turned sideways) the row has
  // its own links again and the trigger is gone, so the menu closes rather than cover them.
  React.useEffect(() => {
    if (!menuOpen) return;
    const wide = window.matchMedia("(min-width: 1024px)");
    const closeIfWide = () => {
      if (wide.matches) setMenuOpen(false);
    };
    closeIfWide();
    wide.addEventListener("change", closeIfWide);
    return () => wide.removeEventListener("change", closeIfWide);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <SiteHeaderBand>
      <SiteIdentity />

      <div className="flex shrink-0 items-center gap-6">
        <nav aria-label="Primary">
          <ul className="hidden items-center gap-1 lg:flex">
            {SECTION_LINKS.map((link) => (
              <li key={link.href}>
                <SiteHeaderNavLink href={link.href}>{link.label}</SiteHeaderNavLink>
              </li>
            ))}
          </ul>

          <div className="lg:hidden">
            <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" size="sm" className="text-sm shadow-none">
                  <MenuIcon aria-hidden="true" />
                  Menu
                </Button>
              </DialogTrigger>
              <DialogContent
                fullScreen
                showCloseButton={false}
                aria-describedby={undefined}
                onCloseAutoFocus={(event) => {
                  if (followedAnchor.current) event.preventDefault();
                  followedAnchor.current = false;
                }}
              >
                <DialogTitle className="sr-only">Menu</DialogTitle>

                {/* The header's own row, so the Close button sits where "Menu" was. */}
                <div className="border-b border-line-subtle">
                  <div className="page-container flex items-center justify-between gap-6 py-4 sm:py-5">
                    <SiteIdentity onClick={closeMenu} />
                    <DialogClose asChild>
                      <Button variant="secondary" size="sm" className="shrink-0 text-sm shadow-none">
                        <XIcon aria-hidden="true" />
                        Close
                      </Button>
                    </DialogClose>
                  </div>
                </div>

                <div className="page-container flex flex-1 flex-col gap-10 py-6">
                  <ul className="flex flex-col">
                    {SECTION_LINKS.map((link) => (
                      <li key={link.href} className="border-b border-line-subtle">
                        <a
                          href={link.href}
                          onClick={() => {
                            followedAnchor.current = true;
                            closeMenu();
                          }}
                          className="-mx-2 flex min-h-16 items-center rounded-control px-2 font-heading text-h4 font-bold text-fg underline decoration-transparent underline-offset-4 outline-none transition-colors duration-[var(--dur-fast)] ease-frost hover:decoration-current focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto flex flex-col items-stretch gap-6 pb-2">
                    <Link
                      href={routes.city.queue()}
                      onClick={doors.cityStaff}
                      className={cn("self-start text-base", TEXT_LINK)}
                    >
                      City staff
                    </Link>
                    <Button asChild className="w-full">
                      <Link href={routes.apply()} onClick={doors.planAnEvent}>
                        Plan an event
                      </Link>
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
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
    </SiteHeaderBand>
  );
}

export { SiteHeader };
