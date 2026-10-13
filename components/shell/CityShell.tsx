"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { TopBar } from "@/components/shell/TopBar";
import { StorageBanner } from "@/components/shell/StorageBanner";
import { SwitchRolePanel } from "@/components/shell/SwitchRolePanel";
import { CitySidebar } from "@/components/shell/CitySidebar";
import { useRoleSwitch } from "@/components/shell/useRoleSwitch";
import { queueFor, useDemo, useHydrated } from "@/lib/state";
import type { Dept, Party } from "@/lib/types";

const CITY_ROLES: Party[] = ["clerk", "pws", "hl"];

function isCityRole(role: Party): role is Dept {
  return role !== "applicant";
}

interface CityShellProps {
  children: React.ReactNode;
}

/**
 * The frame for every city screen (app/city/layout.tsx): AppShell's top bar plus a left
 * sidebar (My queue, Cases, Active permits, then the role's own tools). If the Applicant is
 * current, the sidebar and page are swapped for a panel offering to switch to a city role.
 */
function CityShell({ children }: CityShellProps) {
  const hydrated = useHydrated();
  const role = useDemo((s) => s.role);
  const storageOk = useDemo((s) => s.storageOk);
  const cases = useDemo((s) => s.cases);
  const demoToday = useDemo((s) => s.demoToday);
  const rememberPath = useDemo((s) => s.rememberPath);
  const pathname = usePathname();
  const switchTo = useRoleSwitch();

  React.useEffect(() => {
    if (hydrated && isCityRole(role)) rememberPath(role, pathname);
  }, [hydrated, role, pathname, rememberPath]);

  return (
    <div className="app-ground flex min-h-dvh flex-col">
      <TopBar />
      {!hydrated ? (
        <PageSkeleton />
      ) : (
        <main className="flex-1">
          {!storageOk ? <StorageBanner /> : null}
          {isCityRole(role) ? (
            <div className="page-container flex gap-6 py-6">
              <CitySidebar role={role} pathname={pathname} queueCount={queueFor(cases, role, demoToday).length} />
              <div className="min-w-0 flex-1">{children}</div>
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
