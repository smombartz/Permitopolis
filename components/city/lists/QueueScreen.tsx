"use client";

import * as React from "react";
import Link from "next/link";
import { InboxIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { CountBadge } from "@/components/ui/count-badge";
import { CaseId, DueDate, EventTitle, ReviewClock, StateChip, TierBadge, WaitingOnChips } from "@/components/domain";
import { KeyboardFooter } from "@/components/city/lists/KeyboardFooter";
import { useRovingListNav } from "@/components/city/lists/useRovingListNav";
import { reviewClock, taskDueDate, useDemo, type QueueItem } from "@/lib/state";
import { routes } from "@/lib/routes";
import { plural } from "@/lib/format";
import type { Dept, Party } from "@/lib/types";
import {
  QUEUE_GROUP_LABEL,
  applicantNameOf,
  emptyQueueMessage,
  orderedQueueGroups,
  queueBriefing,
  queueGroups,
  queueTotal,
  queueWaitingOnOthers,
  triggerLabels,
} from "@/lib/view/cityLists";

function isDept(role: Party): role is Dept {
  return role !== "applicant";
}

function QueueRow({ item, role, today, reviewer }: { item: QueueItem; role: Dept; today: string; reviewer: boolean }) {
  const { case: c, task, daysWaiting } = item;
  const clock = reviewer ? reviewClock(c, role, today) : null;
  const due = taskDueDate(task);
  return (
    <li>
      <Link
        data-row-nav=""
        href={routes.city.case(c.id, { task: task.id })}
        className="flex flex-col gap-2 rounded-panel border border-line-subtle bg-surface-1 p-3 outline-none transition-colors duration-[var(--dur-fast)] ease-frost hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <EventTitle name={c.name} applicantName={applicantNameOf(c)} className="min-w-0" />
            <CaseId id={c.id} />
          </div>
          <TierBadge tier={c.tier} />
        </div>
        <div className="flex min-w-0 flex-col gap-1 sm:w-64">
          <p className="truncate text-sm font-medium text-fg">{task.title}</p>
          {reviewer && c.triggers.length > 0 ? <p className="truncate text-xs text-fg-secondary">{triggerLabels(c).join(", ")}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {due ? <DueDate date={due} today={today} /> : <span className="text-xs text-fg-secondary">No due date</span>}
          <span className="text-xs text-fg-secondary">{plural(daysWaiting, "day")} waiting</span>
          {clock ? <ReviewClock dayCount={clock.day} allowedDays={clock.of} paused={clock.paused} pausedDays={clock.pausedDays} /> : null}
          <StateChip state={c.state} />
        </div>
      </Link>
    </li>
  );
}

/** /city/queue, the role's home: every task it can act on now, grouped and briefed. */
function QueueScreen() {
  const cases = useDemo((s) => s.cases);
  const today = useDemo((s) => s.demoToday);
  const role = useDemo((s) => s.role);
  const containerRef = React.useRef<HTMLDivElement>(null);
  useRovingListNav(containerRef, "[data-row-nav]");

  if (!isDept(role)) return null;

  const groups = queueGroups(cases, role, today);
  const total = queueTotal(groups);
  const others = queueWaitingOnOthers(cases, role, today);
  const reviewer = role !== "clerk";

  return (
    <div ref={containerRef} className="flex flex-col gap-6">
      <PageHeader eyebrow="My queue" title={total > 0 ? queueBriefing(groups) : "My queue"} />

      {total === 0 ? (
        <EmptyState icon={InboxIcon} title="Nothing is waiting on you" text={emptyQueueMessage(others)} />
      ) : (
        <div className="flex flex-col gap-6">
          {orderedQueueGroups().map((group) => {
            const items = groups[group];
            if (items.length === 0) return null;
            return (
              <section key={group} className="flex flex-col gap-2">
                <h2 className="flex items-center gap-2 text-sm font-bold text-fg-label uppercase tracking-[.08em]">
                  {QUEUE_GROUP_LABEL[group]}
                  <CountBadge count={items.length} variant={group === "overdue" ? "danger" : "neutral"} />
                </h2>
                <ul className="flex flex-col gap-2">
                  {items.map((item) => (
                    <QueueRow key={item.task.id} item={item} role={role} today={today} reviewer={reviewer} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {others.length > 0 ? (
        <details className="rounded-panel border border-line-subtle bg-surface-1 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-fg">Waiting on others ({others.length})</summary>
          <ul className="mt-3 flex flex-col gap-2">
            {others.map(({ case: c, parties }) => (
              <li key={c.id}>
                <Link
                  href={routes.city.case(c.id)}
                  className="flex flex-col gap-2 rounded-control border border-line-subtle bg-surface-2 p-3 outline-none transition-colors duration-[var(--dur-fast)] ease-frost hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <EventTitle name={c.name} applicantName={applicantNameOf(c)} className="min-w-0" />
                    <CaseId id={c.id} />
                  </div>
                  <WaitingOnChips items={parties.map((p) => ({ party: p.party, days: p.daysHolding }))} />
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <KeyboardFooter />
    </div>
  );
}

export { QueueScreen };
