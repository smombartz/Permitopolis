"use client";

import Link from "next/link";
import { CalendarClockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CaseId, EventTitle, TierBadge } from "@/components/domain";
import { applicantNameOf } from "@/lib/data/people";
import { fmtDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { checkCompleteCityTask } from "@/lib/state";
import type { Dept, ISODate } from "@/lib/types";
import { MEETING_KIND_LABEL, type MeetingRow } from "@/lib/view/workOrders";

interface MeetingsTabProps {
  rows: MeetingRow[];
  role: Dept;
  today: ISODate;
  here: string;
}

/** Every site walkthrough and coordination meeting: Schedule (or Reschedule) and Mark held. */
function MeetingsTab({ rows, role, today, here }: MeetingsTabProps) {
  if (rows.length === 0) {
    return <EmptyState icon={CalendarClockIcon} title="No walkthroughs or meetings" text="A Special event's coordination meeting and site walkthrough show up here once its application is in." />;
  }

  return (
    <ul className="flex flex-col gap-2" aria-label="Walkthroughs and meetings">
      {rows.map((row) => {
        const canHold = row.scheduledFor && !row.held ? checkCompleteCityTask(row.case, row.task.id, role, today) : null;
        return (
          <li key={row.task.id} className="flex flex-col gap-2 rounded-panel border border-line-subtle bg-surface-1 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <EventTitle name={row.case.name} applicantName={applicantNameOf(row.case)} className="min-w-0" />
                <CaseId id={row.case.id} />
                <TierBadge tier={row.case.tier} />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button asChild size="sm" variant="secondary">
                  <Link
                    href={routes.city.case(row.case.id, { task: `schedule_meeting:${row.task.id}`, from: here })}
                    aria-label={`${row.scheduledFor ? "Reschedule" : "Schedule"}: ${MEETING_KIND_LABEL[row.kind]}, ${row.case.name}`}
                  >
                    {row.scheduledFor ? "Reschedule" : "Schedule"}
                  </Link>
                </Button>
                {row.held || !canHold ? null : canHold.ok ? (
                  <Button asChild size="sm">
                    <Link
                      href={routes.city.case(row.case.id, { task: `complete_city_task:${row.task.id}`, from: here })}
                      aria-label={`Mark held: ${MEETING_KIND_LABEL[row.kind]}, ${row.case.name}`}
                    >
                      Mark held
                    </Link>
                  </Button>
                ) : (
                  <Button size="sm" disabled aria-label={`Mark held: ${MEETING_KIND_LABEL[row.kind]}, ${row.case.name}`} aria-describedby={`meeting-reason-${row.task.id}`}>
                    Mark held
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-fg-label">
              {MEETING_KIND_LABEL[row.kind]} ·{" "}
              {row.held ? "Held" : row.scheduledFor ? `Scheduled for ${fmtDate(row.scheduledFor)}` : "Not yet scheduled"}
            </p>
            {canHold && !canHold.ok ? (
              <p id={`meeting-reason-${row.task.id}`} className="text-xs text-fg-secondary">
                {canHold.reason}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export { MeetingsTab };
