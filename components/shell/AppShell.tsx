"use client";

import * as React from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";
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
 * .app-ground: the top bar, a skeleton until the store is hydrated, the storage banner, and
 * the page itself inside the page container. A screen starts with its PageHeader and never
 * adds `page-container` of its own. If a city role is current, the page is swapped for a
 * panel offering to switch to the Applicant, since every screen under here is built for that
 * role.
 */
function AppShell({ children }: AppShellProps) {
  const hydrated = useHydrated();
  const role = useDemo((s) => s.role);
  const storageOk = useDemo((s) => s.storageOk);
  const switchTo = useRoleSwitch();

  return (
    <div className="app-ground flex min-h-dvh flex-col">
      <TopBar />
      {!hydrated ? (
        <PageSkeleton />
      ) : (
        <main className="flex-1">
          {!storageOk ? <StorageBanner /> : null}
          <CoachStrip />
          {role === "applicant" ? (
            <>
              <React.Suspense fallback={null}>
                <RememberPath role={role} />
              </React.Suspense>
              <div className="page-container py-6">{children}</div>
            </>
          ) : (
            <SwitchRolePanel
              message="This screen is built for the Applicant."
              targets={["applicant"]}
              onSwitch={switchTo}
            />
          )}
        </main>
      )}
    </div>
  );
}

export { AppShell };
