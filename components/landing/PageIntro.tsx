"use client";

import Link from "next/link";
import { ArrowRightIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { useDoors } from "./hooks";

/** Where this page sits in the city's site. The two parents are not pages of this prototype, so they are text, not links. */
const TRAIL = ["City of Permitopolis", "Office of the City Clerk"];

/**
 * The page's title band: where the page sits in the city's site, the one `<h1>`, what the page
 * is for in two sentences, and the way in. A service page names the service; it does not pitch it.
 */
function PageIntro() {
  const doors = useDoors();

  return (
    <section className="border-b border-line-subtle bg-page">
      <div className="page-container flex flex-col items-start gap-5 py-8 sm:py-12">
        <ol aria-label="You are here" className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-fg-label">
          {TRAIL.map((name) => (
            <li key={name} className="flex items-center gap-1.5">
              {name}
              <ChevronRightIcon className="size-3.5 shrink-0" aria-hidden="true" />
            </li>
          ))}
          <li aria-current="page" className="font-semibold text-fg">
            Event permits
          </li>
        </ol>
        <h1 className="text-price font-bold break-words text-fg sm:text-feature">Event permits</h1>
        <p className="max-w-[62ch] text-body-l text-pretty text-fg-secondary">
          Apply for a permit to hold an event in a city park, plaza or street. Tell us about your event and we
          will work out which permit it needs, what it costs and how much notice to give.
        </p>
        <Button asChild size="lg">
          <Link href={routes.apply()} onClick={doors.planAnEvent}>
            Plan an event
            <ArrowRightIcon aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

export { PageIntro };
