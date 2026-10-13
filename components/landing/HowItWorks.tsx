"use client";

import * as React from "react";
import { cn } from "cn";
import { Chip } from "@/components/ui/chip";
import { TierBadge } from "@/components/domain";
import { Money } from "@/components/domain/Money";
import { AvailabilityBadge } from "@/components/domain/AvailabilityBadge";
import { DateText } from "@/components/domain/DateText";
import { DEFAULT_CONFIG } from "@/lib/rules";
import { fmtMoney } from "@/lib/format";
import type { EventCase } from "@/lib/types";
import { tierCards } from "@/lib/view/landing";
import { SectionHeading } from "./SectionHeading";
import { useReducedMotion } from "./hooks";

interface Step {
  title: string;
  body: string;
  mock: React.ReactNode;
}

function EventTypeMock() {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-hidden="true">
      <li>
        <Chip variant="pill">Picnic or party</Chip>
      </li>
      <li>
        <Chip variant="neutral">Performance or rally</Chip>
      </li>
      <li>
        <Chip variant="neutral">Block party</Chip>
      </li>
    </ul>
  );
}

function WhereMock() {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-hidden="true">
      <li>
        <AvailabilityBadge availability={{ status: "open" }} />
      </li>
      <li>
        <AvailabilityBadge availability={{ status: "booked" }} />
      </li>
    </ul>
  );
}

function WhenMock() {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
      <DateText date="2027-06-18" short />
      <AvailabilityBadge availability={{ status: "impacted", reason: "6 to 11:30 am" }} />
      <Chip variant="neutral">13 sessions</Chip>
    </div>
  );
}

function AddOnsMock() {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-hidden="true">
      <li>
        <Chip variant="pill">Amplified sound · {fmtMoney(DEFAULT_CONFIG.fees.amplifiedSoundPerDay)}/day</Chip>
      </li>
      <li>
        <Chip variant="neutral">Alcohol · {fmtMoney(DEFAULT_CONFIG.fees.alcoholLicensePerDay)}/day</Chip>
      </li>
    </ul>
  );
}

function PlanAtAGlanceMock({ seed }: { seed: EventCase[] }) {
  const reviewed = tierCards(seed).find((c) => c.tier === "reviewed")!;
  return (
    <div className="flex items-center gap-2.5" aria-hidden="true">
      <TierBadge tier="reviewed" />
      <Money amount={reviewed.typicalFee} className="text-sm font-bold text-fg" />
      <span className="text-xs text-fg-tertiary">estimated</span> {/* guard-allow-tertiary: decorative, aria-hidden mock */}
    </div>
  );
}

function buildSteps(seed: EventCase[]): Step[] {
  return [
    {
      title: "What are you planning?",
      body: "Pick an event type and give it a name — a picnic, a show, a market, a race, a block party or a class. That one choice quietly sets a few defaults, like opening the route map for a race.",
      mock: <EventTypeMock />,
    },
    {
      title: "Where?",
      body: "Click a shelter or field, draw an area on the plaza or the Great Lawn, or select the streets you need. Every place shows its own availability before you commit to it.",
      mock: <WhereMock />,
    },
    {
      title: "When?",
      body: "Set the date and times, and repeat it weekly or every two weeks for a series. A live check flags a date that's booked, blacked out, or only impacted by something else nearby.",
      mock: <WhenMock />,
    },
    {
      title: "How big and what's included?",
      body: "Tell us how many people are coming and flip on what you need — sound, alcohol, vendors, tents, city services. Each toggle shows its own fee and who reviews it.",
      mock: <AddOnsMock />,
    },
    {
      title: "Your plan at a glance",
      body: "See the tier, the permits it covers, the reviewers and the full fee estimate before you create your board. Everything here becomes the cards on your to-do board.",
      mock: <PlanAtAGlanceMock seed={seed} />,
    },
  ];
}

interface HowItWorksProps {
  seed: EventCase[];
}

/**
 * How it works (plan 7, row 3): the five wizard questions on the scroll thread. A vertical
 * indigo line draws itself down as the numbered markers scroll into view (IntersectionObserver,
 * threshold 0.5); under reduced motion, or with no IntersectionObserver at all (the render-test
 * harness), every marker is lit and the line is fully drawn from the first render.
 */
function HowItWorks({ seed }: HowItWorksProps) {
  const steps = React.useMemo(() => buildSteps(seed), [seed]);
  const reducedMotion = useReducedMotion();
  const noObserver = typeof IntersectionObserver === "undefined";
  const [observedLitCount, setObservedLitCount] = React.useState(0);
  const markerRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  // Reduced motion (and the render-test harness, which has no IntersectionObserver) skips the
  // subscription entirely and lights every marker from the first render instead of reaching
  // that same result by setting state inside the effect.
  const litCount = reducedMotion || noObserver ? steps.length : observedLitCount;

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
  }, [reducedMotion, noObserver, steps.length]);

  const progressPct = steps.length === 0 ? 0 : Math.round((litCount / steps.length) * 100);

  return (
    <section id="how-it-works" className="page-container flex flex-col gap-16 py-[var(--section-space)]">
      <SectionHeading
        eyebrow="How it works"
        title="Five questions. One clear permit."
        lead="One wizard, five short steps. The result panel updates with every answer, so you always know what you're getting into."
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
      <ol className="flex flex-col gap-14 sm:gap-16">
        {steps.map((step, index) => {
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
                  lit ? "border-indigo-650 bg-indigo-650 text-fg-on-accent shadow-step-lit" : "border-line-subtle bg-surface-2 text-fg-secondary",
                )}
              >
                {index + 1}
              </div>
              <div className="flex max-w-[560px] flex-col gap-2.5 pt-0.5">
                <h3 className="text-h4 font-bold text-fg">{step.title}</h3>
                <p className="text-sm text-fg-secondary">{step.body}</p>
                <div className="mt-1">{step.mock}</div>
              </div>
            </li>
          );
        })}
      </ol>
      </div>
    </section>
  );
}

export { HowItWorks };
