"use client";

import * as React from "react";
import { isInsideOverlay, isPlainShortcut } from "@/lib/keyboard";

/**
 * `j` and `k` move focus through a list of rows (the queue, the table) from anywhere on the
 * page; the arrow keys do the same once a row has focus, and are left to scroll the page until
 * then. Enter opens the focused row. Queried live from the DOM through `selector`, so the shared
 * `Table` and `Link` components need no ref forwarding of their own. Never takes a key while a
 * field has focus, a key another handler took, a modified key, or a key pressed inside a widget
 * with keys of its own or an open dialog (`lib/keyboard.ts`); and never traps focus: it only
 * moves it between the matching elements.
 */
export function useRovingListNav(containerRef: React.RefObject<HTMLElement | null>, selector: string) {
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isPlainShortcut(event) || event.shiftKey || isInsideOverlay(event.target)) return;
      const container = containerRef.current;
      if (!container) return;
      const items = Array.from(container.querySelectorAll<HTMLElement>(selector));
      if (items.length === 0) return;
      const current = items.indexOf(document.activeElement as HTMLElement);
      const down = event.key === "j" || (event.key === "ArrowDown" && current >= 0);
      const up = event.key === "k" || (event.key === "ArrowUp" && current >= 0);
      if (!down && !up) return;
      const next = current < 0 ? 0 : down ? Math.min(items.length - 1, current + 1) : Math.max(0, current - 1);
      event.preventDefault();
      items[next]?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [containerRef, selector]);
}
