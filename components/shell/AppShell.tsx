"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { TopBar } from "@/components/shell/TopBar";
import { StorageBanner } from "@/components/shell/StorageBanner";
import { SwitchRolePanel } from "@/components/shell/SwitchRolePanel";
import { useRoleSwitch } from "@/components/shell/useRoleSwitch";
import { useDemo, useHydrated } from "@/lib/state";

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * The frame for every applicant screen (app/apply/layout.tsx, app/events/layout.tsx), on the
 * .app-ground: the top bar, a skeleton until the store is hydrated, the storage banner, and
 * the page itself. If a city role is current, the page is swapped for a panel offering to
 * switch to the Applicant, since every screen under here is built for that role.
 */
function AppShell({ children }: AppShellProps) {
  const hydrated = useHydrated();
  const role = useDemo((s) => s.role);
  const storageOk = useDemo((s) => s.storageOk);
  const rememberPath = useDemo((s) => s.rememberPath);
  const pathname = usePathname();
  const switchTo = useRoleSwitch();

  React.useEffect(() => {
    if (hydrated && role === "applicant") rememberPath("applicant", pathname);
  }, [hydrated, role, pathname, rememberPath]);

  return (
    <div className="app-ground flex min-h-dvh flex-col">
      <TopBar />
      {!hydrated ? (
        <PageSkeleton />
      ) : (
        <main className="flex-1">
          {!storageOk ? <StorageBanner /> : null}
          {role === "applicant" ? (
            children
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
