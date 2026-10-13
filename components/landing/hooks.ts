"use client";

import * as React from "react";

/**
 * True once the viewport matches `query` (default: below 768px, the nav's collapse point).
 * Mirrors `components/shell/useIsNarrow`'s pattern (not re-exported from that surface's
 * barrel), kept local here per plan 4's "build it inside your own folder" rule.
 */
export function useLandingNarrow(query: string = "(max-width: 767px)"): boolean {
  const [narrow, setNarrow] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setNarrow(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);

  return narrow;
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
