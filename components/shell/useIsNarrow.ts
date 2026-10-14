"use client";

import * as React from "react";

/**
 * True once the viewport matches `query` (default: below 768px). Starts false so the first
 * paint picks the wider layout; an effect then reads the real match and subscribes to changes.
 * Used instead of a CSS-only `md:hidden` pair so the header renders exactly one form of a
 * control at a time (the user button with its name, or the icon alone): two would otherwise
 * both sit in the DOM (jsdom never applies the stylesheet that would hide one of them), which is
 * what lets tests interact with a single, unambiguous control.
 */
export function useIsNarrow(query: string = "(max-width: 767px)"): boolean {
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
