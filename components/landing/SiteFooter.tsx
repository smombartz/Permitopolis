"use client";

import Link from "next/link";
import { cn } from "cn";
import { routes } from "@/lib/routes";
import { CITY_STAFF_BY_DEPT } from "@/lib/data/people";
import { PARTY_LABEL } from "@/lib/types";
import { CitySeal } from "./CitySeal";
import { useDoors } from "./hooks";
import { NIGHT_TEXT_LINK, SECTION_LINKS } from "./sections";

// Rime & Ink's footer heading: the 11px/700 uppercase overline at .14em.
const COLUMN_HEADING = "text-eyebrow font-bold tracking-[.14em] text-night-fg-secondary uppercase";
// A footer link on its own line: tall enough to tap on a touch screen.
const FOOTER_LINK = cn(NIGHT_TEXT_LINK, "w-fit pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center");

/**
 * The city site's footer, and the page's one night section (Rime & Ink "Dark interlude": ink
 * with a teal glow top-right and an indigo glow bottom-left). It holds the office's contact
 * details, the page's sections again, the door for city staff, and what this site is (a prototype
 * of a fictional city, with the presenter's guide). Rendered after `<main>`, not inside it: a
 * `<footer>` inside `<main>` is not the page's contentinfo landmark.
 */
function SiteFooter() {
  const doors = useDoors();
  const clerk = CITY_STAFF_BY_DEPT.clerk;

  return (
    <footer data-tone="night" className="relative isolate overflow-hidden bg-night text-sm text-night-fg-secondary">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(640px 420px at 88% 8%, color-mix(in srgb, var(--teal-500) 24%, transparent), transparent 60%), radial-gradient(640px 460px at 6% 96%, color-mix(in srgb, var(--indigo-500) 18%, transparent), transparent 60%)",
        }}
      />
      <div className="page-container grid grid-cols-1 gap-x-10 gap-y-10 py-16 sm:grid-cols-2 lg:grid-cols-[1.35fr_0.8fr_1.1fr_1.2fr]">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3 text-night-fg">
            <CitySeal />
            <p className="flex flex-col">
              <span className="font-heading text-base leading-tight font-bold">City of Permitopolis</span>
              <span className="text-night-fg-secondary">Office of the City Clerk</span>
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className={cn(COLUMN_HEADING, "mb-1.5")}>Contact the City Clerk&rsquo;s Office</h2>
            <p className="text-night-fg">
              {clerk.name}, {clerk.title}
            </p>
            <p className="font-mono text-[13px] tabular-nums">{clerk.phone}</p>
            <p>Monday to Friday, 8 am to 5 pm</p>
          </div>
        </div>

        <nav aria-label="Footer" className="flex flex-col gap-3">
          <h2 className={COLUMN_HEADING}>Event permits</h2>
          <ul className="flex flex-col gap-2 pointer-coarse:gap-0">
            {SECTION_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className={FOOTER_LINK}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-3">
          <h2 className={COLUMN_HEADING}>For city staff</h2>
          <p>
            The {PARTY_LABEL.clerk}, {PARTY_LABEL.pws} and {PARTY_LABEL.hl} review applications in the staff
            workspace.
          </p>
          <Link href={routes.city.queue()} onClick={doors.cityStaff} className={FOOTER_LINK}>
            Open the staff workspace
          </Link>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className={COLUMN_HEADING}>About this site</h2>
          <p>Permitopolis is a fictional city. This is a front-end-only prototype; nothing here is submitted anywhere.</p>
          <Link href={routes.demo()} className={FOOTER_LINK}>
            Presenting this prototype? Open the demo guide
          </Link>
        </div>
      </div>
    </footer>
  );
}

export { SiteFooter };
