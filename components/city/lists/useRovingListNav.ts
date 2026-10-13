"use client";

import * as React from "react";

const FIELD_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
/** Widgets that handle the arrow keys themselves. */
const OWN_ARROW_KEYS = '[role="radiogroup"], [role="menu"], [role="listbox"], [role="dialog"], [role="tablist"]';

/**
 * `j`/`k` and the arrow keys move focus through a list of rows (the queue, the table), Enter
 * opens the focused one. Queried live from the DOM through `selector`, so the shared `Table`
 * and `Link` components need no ref forwarding of their own. Never hijacks a key while a field
 * has focus, a key another handler took, a modified key, or a key pressed inside a widget with
 * arrow keys of its own; and never traps focus: it only moves it between the matching elements.
 */
export function useRovingListNav(containerRef: React.RefObject<HTMLElement | null>, selector: string) {
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Somebody else's key: already handled, a shortcut (Ctrl/Cmd+K is the command palette's),
      // or pressed inside a widget that moves by arrows itself (the role switcher is a
      // radiogroup; an open menu, listbox or dialog).
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (FIELD_TAGS.has(target.tagName) || target.isContentEditable)) return;
      if (target?.closest?.(OWN_ARROW_KEYS)) return;
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
