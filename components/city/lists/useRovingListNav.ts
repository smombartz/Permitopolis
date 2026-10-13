"use client";

import * as React from "react";

const FIELD_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * `j`/`k` and the arrow keys move focus through a list of rows (the queue, the table), Enter
 * opens the focused one. Queried live from the DOM through `selector`, so the shared `Table`
 * and `Link` components need no ref forwarding of their own. Never hijacks a key while a field
 * has focus, and never traps focus: it only moves it between the matching elements.
 */
export function useRovingListNav(containerRef: React.RefObject<HTMLElement | null>, selector: string) {
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (FIELD_TAGS.has(target.tagName) || target.isContentEditable)) return;
      const container = containerRef.current;
      if (!container) return;
      const items = Array.from(container.querySelectorAll<HTMLElement>(selector));
      if (items.length === 0) return;
      const current = items.indexOf(document.activeElement as HTMLElement);
      let next = -1;
      if (event.key === "j" || event.key === "ArrowDown") next = current < 0 ? 0 : Math.min(items.length - 1, current + 1);
      else if (event.key === "k" || event.key === "ArrowUp") next = current < 0 ? 0 : Math.max(0, current - 1);
      else return;
      event.preventDefault();
      items[next]?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [containerRef, selector]);
}
