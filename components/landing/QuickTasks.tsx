"use client";

import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { routes } from "@/lib/routes";
import { useDoors } from "./hooks";
import { SECTION_ID } from "./sections";
import { SectionHeading } from "./SectionHeading";

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
  "text-body-l font-semibold text-fg-accent underline underline-offset-4 outline-none after:absolute after:inset-0 group-hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

function TaskRow({ link, detail }: { link: React.ReactNode; detail: string }) {
  return (
    <li className="group relative flex items-center justify-between gap-4 border-b border-line-subtle py-3.5">
      <div className="flex min-w-0 flex-col">
        {link}
        <p className="text-sm text-fg-secondary">{detail}</p>
      </div>
      <ChevronRightIcon
        className="size-5 shrink-0 text-fg-label transition-transform duration-150 ease-nav group-hover:translate-x-1"
        aria-hidden="true"
      />
    </li>
  );
}

/**
 * "I want to…": the page's tasks as a plain list of links, the way a city site opens a service
 * page. The first is the way into the application (a door, like the header's); the rest jump to
 * the section of this page that answers them.
 */
function QuickTasks() {
  const doors = useDoors();

  return (
    <section aria-labelledby={HEADING_ID} className="flex flex-col gap-4">
      <SectionHeading id={HEADING_ID} title="I want to…" />
      <ul aria-labelledby={HEADING_ID} className="flex flex-col">
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
    </section>
  );
}

export { QuickTasks };
