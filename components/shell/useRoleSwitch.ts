"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDemo } from "@/lib/state";
import { applicantLanding, resolvePersonaPick, resolveRoleSwitch } from "@/lib/view/shell";
import type { Party } from "@/lib/types";

/**
 * Switches role the way the PRD describes: two city roles keep the URL; the Applicant and a
 * city role follow a case on screen (lib/view/shell.ts's `resolveRoleSwitch`); otherwise the
 * role's remembered page, then its home. Used by the header's user menu and by the
 * applicant/city mismatch panels, so every way of changing role lands the same place. A page
 * opened under the wrong role stays put when the switch is to a role it is built for.
 *
 * When the page does not change (two city roles), nothing is pushed: the URL stays exactly as
 * it is, query string and all, and the screen re-renders for the new role from the store.
 */
export function useRoleSwitch(): (toRole: Party) => void {
  const router = useRouter();
  const pathname = usePathname();

  return React.useCallback(
    (toRole: Party) => {
      const state = useDemo.getState();
      if (toRole === state.role) return;
      const { path, personaId } = resolveRoleSwitch({
        fromRole: state.role,
        toRole,
        pathname,
        // Read at the click, not with `useSearchParams()`: the top bar renders outside a Suspense
        // boundary, and only a wizard link opened under a city role needs it.
        search: window.location.search,
        cases: state.cases,
        lastPathByRole: state.lastPathByRole,
      });
      state.setRole(toRole);
      if (personaId) state.setPersona(personaId);
      if (path !== pathname) router.push(path);
    },
    [router, pathname],
  );
}

/**
 * Picks an applicant in the header's user menu (or the command palette). As the Applicant, it
 * goes where that persona starts (`pathForPersona`): the wizard for a new applicant or for one
 * whose only event is still a draft, My events for everyone else. From a city role it also
 * switches to the Applicant, and the organizer of the case on screen keeps that case
 * (`resolvePersonaPick`). Picking never leaves the presenter on another organizer's event.
 */
export function usePersonaSwitch(): (personaId: string) => void {
  const router = useRouter();
  const pathname = usePathname();

  return React.useCallback(
    (personaId: string) => {
      const state = useDemo.getState();
      const fromRole = state.role;
      const landing = applicantLanding({
        fromRole,
        personaId: state.personaId,
        pathname,
        search: window.location.search,
        cases: state.cases,
        lastPathByRole: state.lastPathByRole,
      });
      const path = resolvePersonaPick({ picked: personaId, fromRole, landing, cases: state.cases });
      if (fromRole !== "applicant") state.setRole("applicant");
      state.setPersona(personaId);
      // A page opened under a city role that is this applicant's own stays put, as a role switch does.
      if (fromRole === "applicant" || path !== pathname) router.push(path);
    },
    [router, pathname],
  );
}
