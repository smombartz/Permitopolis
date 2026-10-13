"use client";

import Link from "next/link";
import { ClipboardListIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Chip } from "@/components/ui/chip";
import { CaseId, DueDate, EventTitle, TierBadge } from "@/components/domain";
import { applicantNameOf } from "@/lib/data/people";
import { routes } from "@/lib/routes";
import { WORK_ORDER_KIND_LABEL, groupWorkOrdersByEvent, type WorkOrderRow } from "@/lib/view/workOrders";
import type { ISODate } from "@/lib/types";

interface WorkOrdersListProps {
  rows: WorkOrderRow[];
  today: ISODate;
  here: string;
  /** Whether a filter is narrowing the list: an empty list then says so, and the bar above offers "Clear filters". */
  filtered?: boolean;
}

/** Every work order, grouped by event and sorted by event date; each row links to its case. */
function WorkOrdersList({ rows, today, here, filtered = false }: WorkOrdersListProps) {
  if (rows.length === 0) {
    return filtered ? (
      <EmptyState icon={ClipboardListIcon} title="No work orders match these filters" text="Try another status, kind or due date, or clear the filters." />
    ) : (
      <EmptyState icon={ClipboardListIcon} title="No work orders yet" text="A work order is created for each city service when a case's permit is issued." />
    );
  }

  const groups = groupWorkOrdersByEvent(rows);

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <section key={group.case.id} className="flex flex-col gap-2">
          <div className="flex items-center gap-3 border-b border-line-subtle pb-2">
            <EventTitle name={group.case.name} applicantName={applicantNameOf(group.case)} className="min-w-0" />
            <CaseId id={group.case.id} />
            <TierBadge tier={group.case.tier} />
          </div>
          <ul className="flex flex-col gap-2" aria-label={`${group.case.name}'s work orders`}>
            {group.rows.map((row) => (
              <li
                key={row.task.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line-subtle bg-surface-1 p-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-sm font-semibold text-fg">{row.what}</p>
                  <p className="text-xs text-fg-secondary">
                    {WORK_ORDER_KIND_LABEL[row.kind]}
                    {row.quantity ? ` · ${row.quantity}` : ""} · {row.where}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  {row.due ? <DueDate date={row.due} today={today} /> : <span className="text-xs text-fg-secondary">No due date</span>}
                  <Chip variant={row.overdue ? "danger" : row.status === "done" ? "success" : "neutral"}>
                    {row.status === "done" ? "Done" : row.overdue ? "Overdue" : "Scheduled"}
                  </Chip>
                  {row.status === "done" ? null : (
                    <Button asChild size="sm" variant="secondary">
                      <Link href={routes.city.case(row.case.id, { task: row.task.id, from: here })} aria-label={`Mark done: ${row.what}, ${row.case.name}`}>
                        Mark done
                      </Link>
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export { WorkOrdersList };
