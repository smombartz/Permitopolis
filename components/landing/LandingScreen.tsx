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
import { useAnchorArrival } from "./useAnchorArrival";

/**
 * The public landing page at `/`: the "Event permits" page of the Office of the City Clerk,
 * inside the city site's own header and footer, with no app shell. Its layout is a city office's
 * service page (plan `docs/plans/2026-10-13-government-landing-page.md`): a title, a task list
 * beside the permit checker, then sections of lists and tables. Its look is Rime & Ink's full
 * treatment (`.page-atmosphere`, the floating glass nav, eyebrow pills, frosted panels).
 *
 * Unlike a screen that shows store-backed content, nothing here depends on the stored demo
 * (`buildSeed()` below is pure and store-free, never `useDemo`), so the page renders in full
 * right away — there is no skeleton to flash. Only the two doors' smart role-and-persona handoff
 * waits on `useHydrated()`; each door component checks that flag itself and falls back to a
 * plain link to the same route until then.
 */
function LandingScreen() {
  const seed = React.useMemo(() => buildSeed(), []);
  const onAnchorClick = useAnchorArrival();

  return (
    // data-anchor-glide: in-page links scroll smoothly here (globals.css). The click handler only
    // listens: it marks the section a link lands on (`useAnchorArrival`), the link still navigates.
    <div data-anchor-glide="" onClick={onAnchorClick} className="page-atmosphere min-h-dvh">
      <SkipLink />
      {/* The header (with the primary nav) and the footer are landmarks of the page, so they sit beside <main>, not in it. */}
      <SiteHeader />
      {/* The skip link lands here. guard-allow-outline: no ring, it is the whole page, not a control. */}
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="outline-none">
        <PageIntro />
        <div className="page-container grid grid-cols-1 items-start gap-5 pt-14 lg:grid-cols-[1fr_1.1fr] lg:pt-16">
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
