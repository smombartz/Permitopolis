"use client";

import * as React from "react";
import { cn } from "cn";
import { Panel } from "@/components/ui/panel";
import { useReducedMotion } from "./hooks";
import { SECTION, SECTION_ID } from "./sections";
import { SectionHeading } from "./SectionHeading";

const HEADING_ID = "how-to-apply-heading";

/** The wizard's five questions, under the names the wizard gives them. */
const STEPS = [
  {
    title: "What are you planning?",
    body: "Choose the type of event and give it a name: a picnic, a performance, a market, a race, a block party or a class. The type sets a few defaults, such as a route map for a race.",
  },
  {
    title: "Where?",
    body: "Choose a shelter or a field, mark an area on the plaza or the Great Lawn, or select the streets you need. Each place shows whether it is available before you choose it.",
  },
  {
    title: "When?",
    body: "Set the date and times. An event can repeat weekly or every two weeks. The date is checked as you enter it: you are told if it is booked, blacked out or affected by another event nearby.",
  },
  {
    title: "How big and what's included?",
    body: "Say how many people are coming and what you need: amplified sound, alcohol, vendors, tents or city services. Each one shows its fee and which department reviews it.",
  },
  {
    title: "Your plan at a glance",
    body: "Review the tier, the permits it covers, who reviews it and the full fee estimate before you create your application.",
  },
];

/**
 * How to apply: the five wizard questions on Rime & Ink's scroll thread, then what happens after.
 * A vertical indigo line draws itself down as the numbered markers scroll into view
 * (IntersectionObserver, threshold 0.5); under reduced motion, or with no IntersectionObserver at
 * all (the render-test harness), every marker is lit and the thread is not drawn.
 */
function HowToApply() {
  const reducedMotion = useReducedMotion();
  const noObserver = typeof IntersectionObserver === "undefined";
  const [observedLitCount, setObservedLitCount] = React.useState(0);
  const markerRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  // Reduced motion (and the render-test harness, which has no IntersectionObserver) skips the
  // subscription entirely and lights every marker from the first render instead of reaching
  // that same result by setting state inside the effect.
  const litCount = reducedMotion || noObserver ? STEPS.length : observedLitCount;

  React.useEffect(() => {
    if (reducedMotion || noObserver) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.stepIndex);
          setObservedLitCount((prev) => Math.max(prev, index + 1));
        }
      },
      { threshold: 0.5 },
    );
    for (const el of markerRefs.current) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion, noObserver]);

  const progressPct = Math.round((litCount / STEPS.length) * 100);

  return (
    <section id={SECTION_ID.howToApply} aria-labelledby={HEADING_ID} className={cn(SECTION, "gap-14")}>
      <SectionHeading
        id={HEADING_ID}
        eyebrow="The application"
        title="How to apply"
        lead="The application is five questions. The tier, the permits and the fee estimate update with each answer, so you know what the event needs before you commit to it."
      />
      {/* The scroll thread sits beside the list, not in it: an <ol> holds list items only. */}
      <div className="relative">
        {!reducedMotion ? (
          <div className="absolute top-2 bottom-2 left-5 w-px bg-line-subtle" aria-hidden="true">
            <div
              className="w-full origin-top bg-gradient-to-b from-indigo-500 to-indigo-650 transition-[height] duration-500 ease-frost"
              style={{ height: `${progressPct}%`, boxShadow: "0 0 10px 1px color-mix(in srgb, var(--indigo-500) 30%, transparent)" }}
            />
          </div>
        ) : null}
        <ol className="flex flex-col gap-12">
          {STEPS.map((step, index) => {
            const lit = index < litCount;
            return (
              <li key={step.title} className="flex gap-6">
                <div
                  ref={(el) => {
                    markerRefs.current[index] = el;
                  }}
                  data-step-index={index}
                  aria-hidden="true"
                  className={cn(
                    "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border font-mono text-sm font-bold transition-colors duration-[var(--dur-gentle)] ease-frost",
                    lit ? "border-indigo-650 bg-indigo-650 text-fg-on-accent shadow-step-lit" : "border-line-subtle bg-frost-050 text-fg-secondary",
                  )}
                >
                  {index + 1}
                </div>
                <div className="flex max-w-[600px] flex-col gap-2 pt-1">
                  <h3 className="text-h4 font-bold text-fg">
                    <span className="sr-only">Step {index + 1}: </span>
                    {step.title}
                  </h3>
                  <p className="text-base text-pretty text-fg-secondary">{step.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      <Panel variant="plain" className="flex max-w-[680px] flex-col gap-1.5 p-5 sm:p-6">
        <h3 className="text-h4 font-bold text-fg">After you apply</h3>
        <p className="text-base text-pretty text-fg-secondary">
          Your event gets a to-do board. Every document to upload and every action to take is a card on it, with
          the reason it is needed and the date it is due.
        </p>
      </Panel>
    </section>
  );
}

export { HowToApply };
