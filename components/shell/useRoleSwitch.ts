"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDemo } from "@/lib/state";
import { resolveRoleSwitch } from "@/lib/view/shell";
import type { Party } from "@/lib/types";

/**
 * Switches role the way the PRD describes: two city roles keep the URL; the Applicant and a
 * city role follow a case on screen (lib/view/shell.ts's `resolveRoleSwitch`); otherwise the
 * role's remembered path, then its home. Used by the top bar's switcher and by the
 * applicant/city mismatch panels, so every way of changing role lands the same place.
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
      router.push(path);
    },
    [router, pathname],
  );
}
