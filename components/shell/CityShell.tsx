"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/ui/skip-link";
import { useSettle } from "@/components/ui/use-settle";
import { TopBar } from "@/components/shell/TopBar";
import { StorageBanner } from "@/components/shell/StorageBanner";
import { SwitchRolePanel } from "@/components/shell/SwitchRolePanel";
import { CoachStrip } from "@/components/shell/CoachStrip";
import { CityNav } from "@/components/shell/CityNav";
import { RememberPath } from "@/components/shell/RememberPath";
import { useRoleSwitch } from "@/components/shell/useRoleSwitch";
import { queueFor, useDemo, useHydrated } from "@/lib/state";
import { PARTY_LABEL, type Dept, type Party } from "@/lib/types";
import { cityToolOwner } from "@/lib/view/shell";

const CITY_ROLES: Party[] = ["clerk", "pws", "hl"];

function isCityRole(role: Party): role is Dept {
  return role !== "applicant";
}

/** As it reads after "built for": the Clerk takes an article, the departments do not. */
const OWNER_NAME: Record<Dept, string> = {
  clerk: `the ${PARTY_LABEL.clerk}`,
  pws: PARTY_LABEL.pws,
  hl: PARTY_LABEL.hl,
};

interface CityShellProps {
  children: React.ReactNode;
}

/**
 * The frame for every city screen (app/city/layout.tsx): AppShell's skip link and top bar, then
 * a row of section tabs right below the header (My queue, Cases, Active permits, then the role's
 * own tools), then the `<main>` landmark with the page inside the page container. The tabs sit
 * outside `<main>`, so the skip link lands past them, on the page. A screen starts with its
 * PageHeader and never adds `page-container` of its own. If the Applicant is current, there are
 * no tabs and the page is swapped for a panel offering to switch to a city role.
 *
 * A role's own tools are that role's alone (the PRD's route map). A city role on another
 * role's tool page (a typed-in URL) keeps its tabs and gets the panel in place of the page,
 * and the page is not remembered as its last.
 */
function CityShell({ children }: CityShellProps) {
  const hydrated = useHydrated();
  const role = useDemo((s) => s.role);
  const storageOk = useDemo((s) => s.storageOk);
  const cases = useDemo((s) => s.cases);
  const demoToday = useDemo((s) => s.demoToday);
  const pathname = usePathname();
  const switchTo = useRoleSwitch();
  const toolOwner = cityToolOwner(pathname);
  // Two city roles share a URL, so a switch re-deals the page in place with no other sign that
  // it changed; the page fades back in. A fade only, so nothing fixed or sticky is re-anchored.
  const pageRef = useSettle<HTMLDivElement>(role, { y: 0, fromOpacity: 0.4 });

  return (
    <div className="app-ground flex min-h-dvh flex-col">
      <SkipLink />
      <TopBar />
      {hydrated && isCityRole(role) ? <CityNav role={role} pathname={pathname} queueCount={queueFor(cases, role, demoToday).length} /> : null}
      {/* The skip link lands here, past the tabs. guard-allow-outline: no ring, it is the whole page, not a control. */}
      <main id={MAIN_CONTENT_ID} tabIndex={-1} aria-busy={!hydrated} className="flex-1 outline-none">
        {!hydrated ? (
          <PageSkeleton />
        ) : (
          <>
            {!storageOk ? <StorageBanner /> : null}
            <CoachStrip />
            {isCityRole(role) ? (
              <div className="page-container py-6">
                <div ref={pageRef}>
                  {toolOwner === null || toolOwner === role ? (
                    <>
                      <React.Suspense fallback={null}>
                        <RememberPath role={role} />
                      </React.Suspense>
                      {children}
                    </>
                  ) : (
                    <SwitchRolePanel message={`This screen is built for ${OWNER_NAME[toolOwner]}.`} targets={[toolOwner]} onSwitch={switchTo} />
                  )}
                </div>
              </div>
            ) : (
              <SwitchRolePanel message="This screen is built for a city role." targets={CITY_ROLES} onSwitch={switchTo} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export { CityShell };
