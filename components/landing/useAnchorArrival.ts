"use client";

import * as React from "react";
import { SECTION_ID } from "./sections";

/** How long a section stays marked after its eyebrow comes into view. */
const ARRIVAL_HOLD_MS = 1400;

const SECTION_IDS = new Set<string>(Object.values(SECTION_ID));

/** The section a hash names, if it is one of the page's own. */
function sectionFor(hash: string): HTMLElement | null {
  const id = hash.replace(/^#/, "");
  return SECTION_IDS.has(id) ? document.getElementById(id) : null;
}

/**
 * Anchor arrival (Rime & Ink "Motion"): following an in-page link marks the section it lands on
 * with `data-arrived` for a moment, and the section's eyebrow lights like a step marker the
 * scroll thread has reached (`SectionHeading`). The mark is set when the eyebrow comes into view,
 * so it is lit as the page glides to rest, and it is a state, not a keyframe: under reduced
 * motion the jump is instant and the eyebrow still lights and clears.
 *
 * Returns a click handler for the page's root. React clicks bubble out of the phone menu's
 * portal, so one handler hears every anchor. A deep link (`/#fees`) and back/forward arrive the
 * same way. With no IntersectionObserver (the render-test harness) the mark is set at once.
 */
export function useAnchorArrival(): (event: React.MouseEvent) => void {
  const pending = React.useRef<{ stop: () => void } | null>(null);

  const arrive = React.useCallback((section: HTMLElement) => {
    pending.current?.stop();

    let observer: IntersectionObserver | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const stop = () => {
      observer?.disconnect();
      if (timeout) clearTimeout(timeout);
      section.removeAttribute("data-arrived");
    };
    const mark = () => {
      observer?.disconnect();
      section.setAttribute("data-arrived", "");
      timeout = setTimeout(stop, ARRIVAL_HOLD_MS);
    };
    pending.current = { stop };

    if (typeof IntersectionObserver === "undefined") {
      mark();
      return;
    }
    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) mark();
    });
    observer.observe(section.querySelector<HTMLElement>('[data-slot="eyebrow"]') ?? section);
  }, []);

  React.useEffect(() => {
    const fromHash = () => {
      const section = sectionFor(window.location.hash);
      if (section) arrive(section);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      pending.current?.stop();
    };
  }, [arrive]);

  return React.useCallback(
    (event: React.MouseEvent) => {
      const link = (event.target as Element).closest?.<HTMLAnchorElement>('a[href^="#"]');
      const section = link ? sectionFor(link.getAttribute("href") ?? "") : null;
      if (section) arrive(section);
    },
    [arrive],
  );
}
