"use client";

import { usePathname } from "next/navigation";
import { useDemo, useHydrated } from "@/lib/state";
import { fmtDate, fmtMonthDay } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { SiteHeader, SiteIdentity } from "@/components/ui/site-header";
import { usePersonaSwitch, useRoleSwitch } from "@/components/shell/useRoleSwitch";
import { useIsNarrow } from "@/components/shell/useIsNarrow";
import { UserMenu } from "@/components/shell/UserMenu";
import { DemoMenu } from "@/components/shell/DemoMenu";
import { CommandCenter } from "@/components/shell/CommandCenter";
import { actingAsName, applicantLanding, userMenuPersonaIds } from "@/lib/view/shell";

/**
 * The app's header, shared by AppShell and CityShell: the site header the landing page has
 * (`components/ui/site-header.tsx`: the solid band, the city's seal and name linking home),
 * pinned to the top, with the app's controls where the public page has its navigation. In
 * order: the demo date, Search, the user menu (who the presenter is acting as: a city official
 * or an applicant) and the Demo menu. A pick in the user menu goes through useRoleSwitch() or
 * usePersonaSwitch(), so it also takes the presenter to the right page.
 *
 * Everything but the identity comes from the stored demo (the role, the persona, the date), so
 * until that has been read the row shows placeholders in their place. The prerendered page
 * would otherwise show the seed's Applicant and May 3 for a moment on every reload.
 */
function TopBar() {
  const hydrated = useHydrated();

  return (
    <SiteHeader pinned>
      <SiteIdentity truncate />
      {hydrated ? <TopBarControls /> : <TopBarPlaceholder />}
    </SiteHeader>
  );
}

/** The demo date, Search, the user menu and the Demo menu: all read from the store. */
function TopBarControls() {
  const role = useDemo((s) => s.role);
  const personaId = useDemo((s) => s.personaId);
  const demoToday = useDemo((s) => s.demoToday);
  const cases = useDemo((s) => s.cases);
  const lastPathByRole = useDemo((s) => s.lastPathByRole);
  const pathname = usePathname();
  const switchRole = useRoleSwitch();
  const switchPersona = usePersonaSwitch();
  // Below 1024px the name and the controls share a tighter row: the day alone, then (below 640px)
  // nothing to see. The full text is always there for a screen reader.
  const compactDate = useIsNarrow("(max-width: 1023px)");
  const dateText = `Demo today: ${fmtDate(demoToday)}`;
  // The applicant a switch to the Applicant would land as is offered even when it is not one of the seven.
  const landing = applicantLanding({ fromRole: role, personaId, pathname, cases, lastPathByRole });

  return (
    <div className="flex shrink-0 items-center gap-2">
      {/* Polite: a date jump from the Demo menu or the palette is read out, once. */}
      <span className="font-mono text-xs whitespace-nowrap text-fg-label sm:mr-1" aria-live="polite">
        {compactDate ? (
          <>
            <span aria-hidden="true" className="max-sm:hidden">
              {fmtMonthDay(demoToday)}
            </span>
            <span className="sr-only">{dateText}</span>
          </>
        ) : (
          dateText
        )}
      </span>
      <CommandCenter />
      <UserMenu role={role} personaId={personaId} personaIds={userMenuPersonaIds(landing.personaId)} onRoleChange={switchRole} onPersonaChange={switchPersona} />
      {/* Polite: who the presenter is acting as, read out when a pick (here or in the palette) changes it. */}
      <span className="sr-only" aria-live="polite">
        Acting as {actingAsName(role, personaId)}
      </span>
      <DemoMenu />
    </div>
  );
}

/** Stands in for the controls until the stored demo has been read. Hidden from assistive technology. */
function TopBarPlaceholder() {
  return (
    <div data-slot="top-bar-placeholder" aria-hidden="true" className="flex shrink-0 items-center gap-2">
      <Skeleton className="h-4 w-12 max-sm:hidden lg:w-44" />
      <Skeleton className="h-9 w-9 sm:w-28" />
      <Skeleton className="h-9 w-9 md:w-36" />
      <Skeleton className="size-9" />
    </div>
  );
}

export { TopBar };
