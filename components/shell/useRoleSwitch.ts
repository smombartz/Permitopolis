"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDemo } from "@/lib/state";
import { pathForPersona, resolveRoleSwitch } from "@/lib/view/shell";
import type { Party } from "@/lib/types";

/**
 * Switches role the way the PRD describes: two city roles keep the URL; the Applicant and a
 * city role follow a case on screen (lib/view/shell.ts's `resolveRoleSwitch`); otherwise the
 * role's remembered page, then its home. Used by the top bar's switcher and by the
 * applicant/city mismatch panels, so every way of changing role lands the same place.
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
 * Picks an applicant persona and goes where that persona starts (`pathForPersona`): the
 * wizard for a new applicant or for one whose only event is still a draft, My events for
 * everyone else. Picking never leaves the presenter on another organizer's event.
 */
export function usePersonaSwitch(): (personaId: string) => void {
  const router = useRouter();

  return React.useCallback(
    (personaId: string) => {
      const state = useDemo.getState();
      state.setPersona(personaId);
      router.push(pathForPersona(personaId, state.cases));
    },
    [router],
  );
}
