"use client";

import * as React from "react";

interface SettleOptions {
  /** How far below its place the element starts, in px. 0 fades it without moving it. */
  y?: number;
  /** The opacity it starts from. */
  fromOpacity?: number;
}

/** A duration token (`--dur-gentle: 240ms`) as milliseconds; 0 if it cannot be read. */
function durationToken(style: CSSStyleDeclaration, name: string): number {
  return Number.parseFloat(style.getPropertyValue(name)) || 0;
}

/**
 * Change settle (Rime & Ink "Motion"): what just changed re-settles, and nothing else moves.
 * Give it the value the element shows and put the returned ref on the element; when the value
 * changes, the element arrives again from slightly below (or, with `y: 0`, fades back in). It
 * never plays on mount, nor on an element that has only just appeared: a page that is opening
 * has nothing to explain.
 *
 * The timing is read from the motion tokens (`--dur-gentle`, `--ease-settle-curve`), so no
 * duration is written here. A script animation is out of reach of the global reduced-motion
 * rule in globals.css, so this checks the preference itself: the movement goes and a short fade
 * stays, since the change still happened. With no `Element.animate` (jsdom) it does nothing.
 *
 * Use `y: 0` on anything that holds a `position: fixed` child: a transform would re-anchor it
 * for the length of the animation.
 */
function useSettle<T extends HTMLElement>(value: unknown, { y = 6, fromOpacity = 0 }: SettleOptions = {}): React.RefObject<T | null> {
  const ref = React.useRef<T | null>(null);
  const previous = React.useRef(value);
  // The element as of the last render, so one that mounts along with the change is left alone.
  const present = React.useRef<T | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    const changed = !Object.is(previous.current, value);
    previous.current = value;
    if (!changed || !el || present.current !== el || typeof el.animate !== "function") return;

    // The tokens are set once, on :root.
    const style = getComputedStyle(document.documentElement);
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = durationToken(style, reduced ? "--dur-tap" : "--dur-gentle");
    if (duration === 0) return;

    const from: Keyframe = { opacity: fromOpacity };
    const to: Keyframe = { opacity: 1 };
    if (!reduced && y !== 0) {
      from.transform = `translateY(${y}px)`;
      to.transform = "translateY(0)";
    }
    el.animate([from, to], { duration, easing: style.getPropertyValue("--ease-settle-curve").trim() || "ease-out" });
  }, [value, y, fromOpacity]);

  React.useEffect(() => {
    present.current = ref.current;
  });

  return ref;
}

export { useSettle };
export type { SettleOptions };
