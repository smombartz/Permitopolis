"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useDemo, useHydrated } from "@/lib/state";
import { cityStaffDoor, planAnEventPath } from "@/lib/view/landing";

export interface Doors {
  /** "Plan an event": the Applicant, in the wizard. */
  planAnEvent: (event: React.MouseEvent) => void;
  /** "City staff": a city role, on My queue. */
  cityStaff: (event: React.MouseEvent) => void;
}

/**
 * The landing page's two doors, as click handlers for links that already point at the right
 * page. Until the stored demo has been read (`useHydrated()`), they do nothing and the plain
 * link navigates: a role set before then would be replaced a moment later by the stored one.
 * Afterwards they set the role first, so the page the door opens is not the shell's "built for
 * another role" panel.
 */
export function useDoors(): Doors {
  const hydrated = useHydrated();
  const router = useRouter();

  return React.useMemo(
    () => ({
      planAnEvent(event) {
        if (!hydrated) return;
        event.preventDefault();
        const state = useDemo.getState();
        state.setRole("applicant");
        router.push(planAnEventPath(state.personaId, state.cases));
      },
      cityStaff(event) {
        if (!hydrated) return;
        event.preventDefault();
        const state = useDemo.getState();
        const door = cityStaffDoor(state.role);
        state.setRole(door.role);
        router.push(door.href);
      },
    }),
    [hydrated, router],
  );
}
