"use client";

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { routes } from "@/lib/routes";
import { useDemo, useHydrated } from "@/lib/state";
import { usePersonaSwitch } from "@/components/shell";
import { CITY_STAFF_BY_DEPT } from "@/lib/data/people";

/** Closing card and footer (plan 7, row 10). */
function ClosingFooter() {
  const hydrated = useHydrated();
  const switchPersona = usePersonaSwitch();
  const personaId = useDemo((s) => s.personaId);
  const clerk = CITY_STAFF_BY_DEPT.clerk;

  function handlePlanAnEvent(event: React.MouseEvent) {
    if (!hydrated) return;
    event.preventDefault();
    useDemo.getState().setRole("applicant");
    switchPersona(personaId);
  }

  return (
    <>
      <section className="page-container py-[var(--section-space)]">
        <Panel
          variant="frosted"
          className="flex flex-col items-center gap-5 rounded-stage px-6 py-16 text-center shadow-stage"
        >
          <h2 className="max-w-[26ch] text-display font-bold text-balance text-fg">
            Describe your event. We&rsquo;ll take it from there.
          </h2>
          <p className="max-w-[52ch] text-lead text-pretty text-fg-secondary">
            No lookup tables, no guessing which form you need — just the five questions and a tier worked out for
            you.
          </p>
          <Button asChild size="lg">
            <Link href={routes.apply()} onClick={handlePlanAnEvent}>
              Plan an event
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
        </Panel>
      </section>

      <footer className="page-container flex flex-col gap-6 border-t border-line-subtle py-10 text-sm text-fg-secondary sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[11px] font-bold tracking-[.12em] text-fg-label uppercase">City Clerk&rsquo;s Office</p>
          <p>{clerk.name}, {clerk.title}</p>
          <p className="font-mono text-[13px]">{clerk.phone}</p>
          <p>Office hours: Monday&ndash;Friday, 8 am&ndash;5 pm</p>
        </div>
        <div className="flex flex-col gap-1 sm:items-end sm:text-right">
          <Link href={routes.demo()} className="font-medium text-fg-accent underline-offset-4 hover:underline">
            Presenting this prototype? Open the demo guide
          </Link>
          <p className="max-w-[46ch] text-fg-secondary sm:text-right">
            Permitopolis is a fictional city. This is a front-end-only prototype; nothing here is submitted anywhere.
          </p>
        </div>
      </footer>
    </>
  );
}

export { ClosingFooter };
