"use client";

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { routes } from "@/lib/routes";
import { useDoors } from "./hooks";

/** The hand-drawn indigo stroke under the headline's last word: the system's one organic gesture. */
function HeadlineUnderline() {
  return (
    <svg
      viewBox="0 0 120 14"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-1.5 left-[18%] h-2.5 w-[64%] stroke-indigo-500 opacity-85"
    >
      <path d="M2 8 Q 22 2, 42 7 T 82 5 T 118 8" fill="none" strokeWidth={4} strokeLinecap="round" />
    </svg>
  );
}

/**
 * The page's title: the office the page belongs to as the eyebrow pill, the one `<h1>` at the
 * hero scale with the hand-drawn underline under its last word, what the page is for in two
 * sentences, and the way in. A service page names the service; it does not pitch it.
 */
function PageIntro() {
  const doors = useDoors();

  return (
    <section className="page-container flex flex-col items-start gap-6 pt-16 lg:pt-24">
      {/* 60px below 640px, where the two words stack rather than push the page sideways. */}
      <h1 className="text-display font-bold text-balance break-words text-fg sm:text-hero">
        Event{" "}
        <span className="relative inline-block">
          permits
          <HeadlineUnderline />
        </span>
      </h1>
      <p className="max-w-[52ch] text-lead text-pretty text-fg-secondary">
        Apply for a permit to hold an event in a city park, plaza or street. Tell us about your event and we
        will work out which permit it needs, what it costs and how much notice to give.
      </p>
      <Button asChild size="lg">
        <Link href={routes.apply()} onClick={doors.planAnEvent}>
          Plan an event
          <ArrowRightIcon aria-hidden="true" />
        </Link>
      </Button>
    </section>
  );
}

export { PageIntro };
