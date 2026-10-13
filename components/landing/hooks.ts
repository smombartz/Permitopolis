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

/**
 * True once `prefers-reduced-motion: reduce` matches. Starts false (the default for the first
 * paint and for environments with no `matchMedia`, such as the render-test harness before it
 * stubs one); an effect then reads the real value and subscribes to changes. Used only where a
 * motion pattern needs a JS decision (the scroll thread's drawing and the hero float's own
 * scheduling); the CSS motion classes already collapse under the global reduced-motion rule in
 * `app/globals.css`.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return reduced;
}
