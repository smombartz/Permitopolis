"use client";

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { routes } from "@/lib/routes";
import { useDoors } from "./hooks";
import { SECTION_ID } from "./sections";

const HEADING_ID = "quick-tasks-heading";

/** The in-page tasks, after "Plan an event". Each one names what a visitor came to do and jumps to the section that answers it. */
const ANCHOR_TASKS = [
  { href: `#${SECTION_ID.fees}`, label: "See what it costs", detail: "The fee schedule, and what comes back if you cancel." },
  { href: `#${SECTION_ID.permitTiers}`, label: "Check how much notice to give", detail: "The notice each of the three permit tiers needs." },
  { href: `#${SECTION_ID.whatDecides}`, label: "See what decides the tier", detail: "The details of an event that move it up a tier." },
  { href: `#${SECTION_ID.questions}`, label: "Read common questions", detail: "Insurance, block parties, weekly classes and changing your plans." },
];

// The link is the task's name; its `::after` covers the whole row, so the row is one target.
const TASK_LINK =
  "w-fit rounded-kbd text-base font-semibold text-fg outline-none after:absolute after:inset-0 after:rounded-row focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

/** A list row (Rime & Ink "Lists and rows"): surface-2 at rest; on hover it nudges 2px right, the fill strengthens and the rim turns indigo. */
function TaskRow({ link, detail }: { link: React.ReactNode; detail: string }) {
  return (
    <li className="group relative flex items-center justify-between gap-4 rounded-row border border-line-subtle bg-surface-2 px-4 py-3 transition-all duration-[var(--dur-fast)] ease-frost hover:translate-x-0.5 hover:border-indigo-650/40 hover:bg-surface-strong">
      <div className="flex min-w-0 flex-col gap-0.5">
        {link}
        <p className="text-sm text-fg-secondary">{detail}</p>
      </div>
      <ArrowRightIcon className="size-4 shrink-0 stroke-[2px] text-fg-accent" aria-hidden="true" />
    </li>
  );
}

/**
 * "I want to…": the page's tasks as a list of rows on a frosted panel, the way a city site opens
 * a service page. The first is the way into the application (a door, like the header's); the
 * rest jump to the section of this page that answers them.
 */
function QuickTasks() {
  const doors = useDoors();

  return (
    <Panel variant="frosted" className="flex flex-col gap-5 self-start p-5 sm:p-6">
      <h2 id={HEADING_ID} className="text-card font-bold text-fg">
        I want to…
      </h2>
      <ul aria-labelledby={HEADING_ID} className="flex flex-col gap-2">
        <TaskRow
          link={
            <Link href={routes.apply()} onClick={doors.planAnEvent} className={TASK_LINK}>
              Plan an event
            </Link>
          }
          detail="Start an application: five questions about your event."
        />
        {ANCHOR_TASKS.map((task) => (
          <TaskRow
            key={task.href}
            link={
              <a href={task.href} className={TASK_LINK}>
                {task.label}
              </a>
            }
            detail={task.detail}
          />
        ))}
      </ul>
    </Panel>
  );
}

export { QuickTasks };
