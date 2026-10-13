"use client";

import Link from "next/link";
import { CalendarDaysIcon, ListChecksIcon, SearchCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { useDoors } from "./hooks";
import { fmtMonthDay, fmtTime } from "@/lib/format";
import type { EventCase } from "@/lib/types";
import { SectionHeading } from "./SectionHeading";

const RIVERFRONT_5K_ID = "PMT-27-0097";

const STAFF_FEATURES = [
  {
    icon: ListChecksIcon,
    title: "My queue",
    body: "What's waiting on you, oldest due first — never a list sorted by someone else's priorities.",
  },
  {
    icon: SearchCheckIcon,
    title: "A case, at a glance",
    body: "Who's up right now, on both sides: the applicant and every department with an open task.",
  },
  {
    icon: CalendarDaysIcon,
    title: "Active permits",
    body: "Every live permit on a list, a calendar and a map — day-of and closeout tasks included.",
  },
];

interface StaffInterludeProps {
  seed: EventCase[];
}

/**
 * For city staff (plan 7, row 8): the one dark interlude, night tokens. A mock activity log
 * (built locally — no shared component renders this mono, terminal-style treatment yet; see
 * notesForIntegrator) shows the Riverfront Summer 5K's own real activity entries, newest first.
 */
function StaffInterlude({ seed }: StaffInterludeProps) {
  const doors = useDoors();
  const fiveK = seed.find((c) => c.id === RIVERFRONT_5K_ID);
  const logLines = fiveK ? [...fiveK.activity].slice(-5).reverse() : [];

  return (
    <section data-tone="night" className="relative isolate overflow-hidden bg-night py-[var(--section-space)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(640px 420px at 88% 8%, color-mix(in srgb, var(--teal-500) 24%, transparent), transparent 60%), radial-gradient(640px 460px at 6% 96%, color-mix(in srgb, var(--indigo-500) 18%, transparent), transparent 60%)",
        }}
      />
      <div className="page-container flex flex-col gap-12 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
        <div className="flex max-w-[480px] flex-col gap-6">
          <SectionHeading
            tone="night"
            eyebrow="For city staff"
            title="One workspace, three roles"
            lead="The City Clerk, Public Works & Safety and Health & Legal each see the same case the way their job needs it."
          />
          <ul className="flex flex-col gap-4">
            {STAFF_FEATURES.map((feature) => (
              <li key={feature.title} className="flex gap-3.5">
                <feature.icon className="mt-0.5 size-5 shrink-0 text-night-accent" aria-hidden="true" />
                <div className="flex flex-col gap-0.5">
                  <p className="font-semibold text-night-fg">{feature.title}</p>
                  <p className="text-sm text-night-fg-secondary">{feature.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <Button asChild variant="dark" size="lg" className="w-fit">
            <Link href={routes.city.queue()} onClick={doors.cityStaff}>
              Open the staff workspace
            </Link>
          </Button>
        </div>

        <div
          className="w-full max-w-[460px] rounded-panel border border-night-line bg-night-glass p-5 shadow-glass-dark backdrop-blur-hud"
          aria-hidden="true"
        >
          <div className="flex items-center gap-2 border-b border-night-divider pb-3">
            <span className="relative flex size-2.5 shrink-0 items-center justify-center">
              <span className="landing-live-pulse absolute inset-0 rounded-full bg-night-accent" />
              <span className="relative size-1.5 rounded-full bg-night-accent" />
            </span>
            <span className="font-mono text-[11px] font-bold tracking-[.12em] text-night-fg-secondary uppercase">Live activity</span>
          </div>
          <ul className="flex flex-col gap-2.5 pt-3 font-mono text-[12px] text-night-fg-secondary">
            {logLines.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="flex gap-2.5">
                <span className="shrink-0 text-night-accent tabular-nums">
                  {fmtMonthDay(entry.at)} &middot; {fmtTime(entry.at.slice(11, 16))}
                </span>
                <span className="truncate">{entry.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="sr-only">
        City staff workspace: My queue, a case view showing whose move it is, and Active permits on a list, calendar
        and map.
      </p>
      <style>{`
        @keyframes landing-live-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .3; transform: scale(2.2); }
        }
        .landing-live-pulse { animation: landing-live-pulse 2.4s ease-in-out infinite; }
      `}</style>
    </section>
  );
}

export { StaffInterlude };
