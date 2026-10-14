"use client";

import * as React from "react";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/ui/skip-link";
import { buildSeed } from "@/lib/state";
import { SiteHeader } from "./SiteHeader";
import { PageIntro } from "./PageIntro";
import { QuickTasks } from "./QuickTasks";
import { PermitChecker } from "./PermitChecker";
import { HowToApply } from "./HowToApply";
import { PermitTiers } from "./PermitTiers";
import { ComparisonTable } from "./ComparisonTable";
import { Fees } from "./Fees";
import { Faq } from "./Faq";
import { SiteFooter } from "./SiteFooter";

/**
 * The public landing page at `/`: the "Event permits" page of the Office of the City Clerk,
 * inside the city site's own header and footer, with no app shell. It is laid out as a city
 * office's service page (plan `docs/plans/2026-10-13-government-landing-page.md`): flat solid
 * surfaces, a title band, a task list, then plain sections of lists and tables.
 *
 * Unlike a screen that shows store-backed content, nothing here depends on the stored demo
 * (`buildSeed()` below is pure and store-free, never `useDemo`), so the page renders in full
 * right away — there is no skeleton to flash. Only the two doors' smart role-and-persona handoff
 * waits on `useHydrated()`; each door component checks that flag itself and falls back to a
 * plain link to the same route until then.
 */
function LandingScreen() {
  const seed = React.useMemo(() => buildSeed(), []);

  return (
    <div className="min-h-dvh bg-surface-solid">
      <SkipLink />
      {/* The header (with the primary nav) and the footer are landmarks of the page, so they sit beside <main>, not in it. */}
      <SiteHeader />
      {/* The skip link lands here. guard-allow-outline: no ring, it is the whole page, not a control. */}
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="outline-none">
        <PageIntro />
        <div className="page-container grid grid-cols-1 gap-x-14 gap-y-10 pt-10 pb-6 sm:pt-12 sm:pb-8 lg:grid-cols-[1fr_1.1fr]">
          <QuickTasks />
          <PermitChecker />
        </div>
        <HowToApply />
        <PermitTiers seed={seed} />
        <ComparisonTable />
        <Fees />
        <Faq />
      </main>
      <SiteFooter />
    </div>
  );
}

export { LandingScreen };
