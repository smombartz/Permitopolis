"use client";

import Link from "next/link";
import { useDemo } from "@/lib/state";
import { fmtDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { usePersonaSwitch, useRoleSwitch } from "@/components/shell/useRoleSwitch";
import { useIsNarrow } from "@/components/shell/useIsNarrow";
import { RoleSwitcher } from "@/components/shell/RoleSwitcher";
import { PersonaPicker } from "@/components/shell/PersonaPicker";
import { MobileNavMenu } from "@/components/shell/MobileNavMenu";
import { DemoMenu } from "@/components/shell/DemoMenu";

/**
 * Glass chrome shared by AppShell and CityShell. Left: the wordmark, linking home. Center:
 * the role switcher, with the applicant's persona picker beside it; below 768px both
 * collapse into one menu button (see useIsNarrow). Right: the demo date and the Demo menu.
 * A role change goes through useRoleSwitch() and a persona pick through usePersonaSwitch(),
 * so both also take the presenter to the right page.
 */
function TopBar() {
  const role = useDemo((s) => s.role);
  const personaId = useDemo((s) => s.personaId);
  const demoToday = useDemo((s) => s.demoToday);
  const switchRole = useRoleSwitch();
  const switchPersona = usePersonaSwitch();
  const narrow = useIsNarrow();

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

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          {narrow ? (
            <MobileNavMenu role={role} onRoleChange={switchRole} personaId={personaId} onPersonaChange={switchPersona} />
          ) : (
            <>
              <RoleSwitcher value={role} onChange={switchRole} />
              {role === "applicant" ? <PersonaPicker personaId={personaId} onChange={switchPersona} /> : null}
            </>
          )}

          <span className="hidden whitespace-nowrap font-mono text-xs text-fg-label sm:inline">
            Demo today: {fmtDate(demoToday)}
          </span>
          <DemoMenu />
        </div>
      </div>
    </header>
  );
}

export { TopBar };
