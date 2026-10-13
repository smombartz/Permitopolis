"use client";

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { routes } from "@/lib/routes";
import { useDemo, useHydrated } from "@/lib/state";
import { useRoleSwitch, usePersonaSwitch } from "@/components/shell";
import { HeroPreviewPanel } from "./HeroPreviewPanel";

/** The hand-drawn indigo stroke under the headline's last word: one organic gesture. */
function HeroUnderline() {
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
 * Hero (plan 7, row 2): the eyebrow pill, the 72px headline with the hand-drawn underline
 * under its last word, the lead paragraph, the two doors, and the live preview panel.
 */
function Hero() {
  const hydrated = useHydrated();
  const switchRole = useRoleSwitch();
  const switchPersona = usePersonaSwitch();
  const personaId = useDemo((s) => s.personaId);

  function handlePlanAnEvent(event: React.MouseEvent) {
    if (!hydrated) return;
    event.preventDefault();
    useDemo.getState().setRole("applicant");
    switchPersona(personaId);
  }

  function handleCityStaff(event: React.MouseEvent) {
    if (!hydrated) return;
    event.preventDefault();
    switchRole("clerk");
  }

  return (
    <section className="page-container grid grid-cols-1 items-center gap-16 pt-16 pb-10 lg:grid-cols-[0.9fr_1.1fr] lg:pt-24">
      <div className="flex flex-col items-start gap-6">
        <Eyebrow>City Clerk &middot; Events Permitting</Eyebrow>
        <h1 className="text-hero font-bold text-balance text-fg">
          Describe your event. We work out your{" "}
          <span className="relative inline-block">
            permit
            <HeroUnderline />
          </span>
          .
        </h1>
        <p className="max-w-[46ch] text-lead text-pretty text-fg-secondary">
          Tell us what, where and how big — no permit lookup, no guessing. Permitopolis sorts
          your event into Instant, Reviewed or Special, and builds the to-do list for you.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href={routes.apply()} onClick={handlePlanAnEvent}>
              Plan an event
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href={routes.city.queue()} onClick={handleCityStaff}>
              City staff
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex justify-center lg:justify-end">
        <div className="anim-idle-float">
          <HeroPreviewPanel />
        </div>
      </div>
    </section>
  );
}

export { Hero };
