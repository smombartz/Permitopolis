"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { TopBar } from "@/components/shell/TopBar";
import { StorageBanner } from "@/components/shell/StorageBanner";
import { SwitchRolePanel } from "@/components/shell/SwitchRolePanel";
import { CoachStrip } from "@/components/shell/CoachStrip";
import { CitySidebar } from "@/components/shell/CitySidebar";
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
 * The frame for every city screen (app/city/layout.tsx): AppShell's top bar plus a left
 * sidebar (My queue, Cases, Active permits, then the role's own tools), with the page beside
 * it, both inside the page container. A screen starts with its PageHeader and never adds
 * `page-container` of its own. If the Applicant is current, the sidebar and page are swapped
 * for a panel offering to switch to a city role.
 *
 * A role's own tools are that role's alone (the PRD's route map). A city role on another
 * role's tool page (a typed-in URL) keeps its sidebar and gets the panel in place of the page,
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

  return (
    <div className="app-ground flex min-h-dvh flex-col">
      <TopBar />
      {!hydrated ? (
        <PageSkeleton />
      ) : (
        <main className="flex-1">
          {!storageOk ? <StorageBanner /> : null}
          <CoachStrip />
          {isCityRole(role) ? (
            <div className="page-container flex gap-6 py-6">
              <CitySidebar role={role} pathname={pathname} queueCount={queueFor(cases, role, demoToday).length} />
              {toolOwner === null || toolOwner === role ? (
                <div className="min-w-0 flex-1">
                  <React.Suspense fallback={null}>
                    <RememberPath role={role} />
                  </React.Suspense>
                  {children}
                </div>
              ) : (
                <div className="min-w-0 flex-1">
                  <SwitchRolePanel message={`This screen is built for ${OWNER_NAME[toolOwner]}.`} targets={[toolOwner]} onSwitch={switchTo} />
                </div>
              )}
            </div>
          ) : (
            <SwitchRolePanel message="This screen is built for a city role." targets={CITY_ROLES} onSwitch={switchTo} />
          )}
        </main>
      )}
    </div>
  );
}

export { CityShell };
