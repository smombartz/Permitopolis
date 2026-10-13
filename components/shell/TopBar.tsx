"use client";

import Link from "next/link";
import { useDemo, useHydrated } from "@/lib/state";
import { fmtDate, fmtMonthDay } from "@/lib/format";
import { routes } from "@/lib/routes";
import { Skeleton } from "@/components/ui/skeleton";
import { usePersonaSwitch, useRoleSwitch } from "@/components/shell/useRoleSwitch";
import { useIsNarrow } from "@/components/shell/useIsNarrow";
import { RoleSwitcher } from "@/components/shell/RoleSwitcher";
import { PersonaPicker } from "@/components/shell/PersonaPicker";
import { MobileNavMenu } from "@/components/shell/MobileNavMenu";
import { DemoMenu } from "@/components/shell/DemoMenu";
import { CommandCenter } from "@/components/shell/CommandCenter";

/**
 * Glass chrome shared by AppShell and CityShell. Left: the wordmark, linking home. Center:
 * the role switcher, with the applicant's persona picker beside it; below 768px both
 * collapse into one menu button (see useIsNarrow). Right: the demo date and the Demo menu.
 * A role change goes through useRoleSwitch() and a persona pick through usePersonaSwitch(),
 * so both also take the presenter to the right page.
 *
 * Everything but the wordmark comes from the stored demo (the role, the persona, the date), so
 * until that has been read the bar shows placeholders in their place. The prerendered page
 * would otherwise show the seed's Applicant and May 3 for a moment on every reload.
 */
function TopBar() {
  const hydrated = useHydrated();

  return (
    <header className="sticky top-0 z-40 border-b border-line-subtle bg-glass-tinted backdrop-blur-hud">
      <div className="page-container flex h-14 items-center justify-between gap-3">
        <Link
          href={routes.home()}
          className="flex min-w-0 shrink-0 items-center gap-2 rounded-control outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          <span className="truncate font-heading text-base font-bold text-fg">Permitopolis</span>
          <span className="hidden truncate text-xs text-fg-secondary lg:inline">
            City Clerk &middot; Events Permitting
          </span>
        </Link>

        {hydrated ? <TopBarControls /> : <TopBarPlaceholder />}
      </div>
    </header>
  );
}

/** The role switcher, the persona picker, the demo date and the Demo menu: all read from the store. */
function TopBarControls() {
  const role = useDemo((s) => s.role);
  const personaId = useDemo((s) => s.personaId);
  const demoToday = useDemo((s) => s.demoToday);
  const switchRole = useRoleSwitch();
  const switchPersona = usePersonaSwitch();
  const narrow = useIsNarrow();
  // Below 640px there is no room for the whole chip: the day alone, with the full text for a screen reader.
  const compactDate = useIsNarrow("(max-width: 639px)");
  const dateText = `Demo today: ${fmtDate(demoToday)}`;

  return (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
      {narrow ? (
        <MobileNavMenu role={role} onRoleChange={switchRole} personaId={personaId} onPersonaChange={switchPersona} />
      ) : (
        <>
          <RoleSwitcher value={role} onChange={switchRole} />
          {role === "applicant" ? <PersonaPicker personaId={personaId} onChange={switchPersona} /> : null}
        </>
      )}

      {compactDate ? (
        <span className="whitespace-nowrap font-mono text-xs text-fg-label">
          <span aria-hidden="true">{fmtMonthDay(demoToday)}</span>
          <span className="sr-only">{dateText}</span>
        </span>
      ) : (
        <span className="whitespace-nowrap font-mono text-xs text-fg-label">{dateText}</span>
      )}
      <CommandCenter />
      <DemoMenu />
    </div>
  );
}

/** Stands in for the controls until the stored demo has been read. Hidden from assistive technology. */
function TopBarPlaceholder() {
  return (
    <div data-slot="top-bar-placeholder" aria-hidden="true" className="flex min-w-0 flex-1 items-center justify-end gap-2">
      <Skeleton className="h-9 w-11 md:w-80" />
      <Skeleton className="h-4 w-12 sm:w-44" />
      <Skeleton className="size-9" />
    </div>
  );
}

export { TopBar };
