"use client";

import * as React from "react";
import { buildSeed } from "@/lib/state";
import { Nav } from "./Nav";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { EventTiers } from "./EventTiers";
import { ComparisonTable } from "./ComparisonTable";
import { TodoBoard } from "./TodoBoard";
import { FeesPanels } from "./FeesPanels";
import { StaffInterlude } from "./StaffInterlude";
import { Faq } from "./Faq";
import { ClosingFooter } from "./ClosingFooter";

/**
 * The public landing page at `/` (plan 7): a resident-facing Clerk's Office site, built on
 * `.page-atmosphere` with no shell. Unlike a screen that shows store-backed content, nothing
 * here depends on the stored demo (`buildSeed()` below is pure and store-free, never
 * `useDemo`), so the page renders in full right away — there is no skeleton to flash. Only the
 * two doors' smart role-and-persona handoff waits on `useHydrated()`; each door component
 * checks that flag itself and falls back to a plain link to the same route until then.
 */
function LandingScreen() {
  const seed = React.useMemo(() => buildSeed(), []);

  return (
    <div className="page-atmosphere min-h-dvh">
      <main>
        <Nav />
        <Hero />
        <HowItWorks seed={seed} />
        <EventTiers seed={seed} />
        <ComparisonTable />
        <TodoBoard seed={seed} />
        <FeesPanels />
        <StaffInterlude seed={seed} />
        <Faq />
        <ClosingFooter />
      </main>
    </div>
  );
}

export { LandingScreen };
