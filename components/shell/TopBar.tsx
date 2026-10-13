"use client";

import Link from "next/link";
import { useDemo } from "@/lib/state";
import { fmtDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useRoleSwitch } from "@/components/shell/useRoleSwitch";
import { useIsNarrow } from "@/components/shell/useIsNarrow";
import { RoleSwitcher } from "@/components/shell/RoleSwitcher";
import { PersonaPicker } from "@/components/shell/PersonaPicker";
import { MobileNavMenu } from "@/components/shell/MobileNavMenu";
import { DemoMenu } from "@/components/shell/DemoMenu";

/**
 * Glass chrome shared by AppShell and CityShell. Left: the wordmark, linking home. Center:
 * the role switcher, with the applicant's persona picker beside it; below 768px both
 * collapse into one menu button (see useIsNarrow). Right: the demo date and the Demo menu.
 */
function TopBar() {
  const role = useDemo((s) => s.role);
  const personaId = useDemo((s) => s.personaId);
  const demoToday = useDemo((s) => s.demoToday);
  const setPersona = useDemo((s) => s.setPersona);
  const switchRole = useRoleSwitch();
  const narrow = useIsNarrow();

  return (
    <header className="sticky top-0 z-40 border-b border-line-subtle bg-glass-tinted backdrop-blur-hud">
      <div className="page-container flex h-14 items-center justify-between gap-3">
        <Link href={routes.home()} className="flex min-w-0 shrink-0 items-center gap-2">
          <span className="truncate font-heading text-base font-bold text-fg">Permitopolis</span>
          <span className="hidden truncate text-xs text-fg-secondary lg:inline">
            City Clerk &middot; Events Permitting
          </span>
        </Link>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          {narrow ? (
            <MobileNavMenu role={role} onRoleChange={switchRole} personaId={personaId} onPersonaChange={setPersona} />
          ) : (
            <>
              <RoleSwitcher value={role} onChange={switchRole} />
              {role === "applicant" ? <PersonaPicker personaId={personaId} onChange={setPersona} /> : null}
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
