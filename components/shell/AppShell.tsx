"use client";

import * as React from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/ui/skip-link";
import { useSettle } from "@/components/ui/use-settle";
import { TopBar } from "@/components/shell/TopBar";
import { StorageBanner } from "@/components/shell/StorageBanner";
import { SwitchRolePanel } from "@/components/shell/SwitchRolePanel";
import { CoachStrip } from "@/components/shell/CoachStrip";
import { RememberPath } from "@/components/shell/RememberPath";
import { useRoleSwitch } from "@/components/shell/useRoleSwitch";
import { useDemo, useHydrated } from "@/lib/state";

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * The frame for every applicant screen (app/apply/layout.tsx, app/events/layout.tsx), on the
 * .app-ground: a skip link, the top bar, and the `<main>` landmark holding a skeleton until the
 * store is hydrated, then the storage banner and the page itself inside the page container. A screen starts with its PageHeader and never
 * adds `page-container` of its own. If a city role is current, the page is swapped for a
 * panel offering to switch to the Applicant, since every screen under here is built for that
 * role.
 */
function AppShell({ children }: AppShellProps) {
  const hydrated = useHydrated();
  const role = useDemo((s) => s.role);
  const storageOk = useDemo((s) => s.storageOk);
  const personaId = useDemo((s) => s.personaId);
  const switchTo = useRoleSwitch();
  // Switching applicant re-deals the page in place; it fades back in so the change shows. A fade
  // only: a transform here would re-anchor the wizard's fixed plan bar while it ran.
  const pageRef = useSettle<HTMLDivElement>(personaId, { y: 0, fromOpacity: 0.4 });

  return (
    <div className="app-ground flex min-h-dvh flex-col">
      <SkipLink />
      <TopBar />
      {/* The skip link lands here. guard-allow-outline: no ring, it is the whole page, not a control. */}
      <main id={MAIN_CONTENT_ID} tabIndex={-1} aria-busy={!hydrated} className="flex-1 outline-none">
        {!hydrated ? (
          <PageSkeleton />
        ) : (
          <>
            {!storageOk ? <StorageBanner /> : null}
            <CoachStrip />
            {role === "applicant" ? (
              <>
                <React.Suspense fallback={null}>
                  <RememberPath role={role} />
                </React.Suspense>
                <div ref={pageRef} className="page-container py-6">
                  {children}
                </div>
              </>
            ) : (
              <SwitchRolePanel message="This screen is built for the Applicant." targets={["applicant"]} onSwitch={switchTo} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export { AppShell };
