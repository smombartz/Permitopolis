"use client";

import { CalendarClockIcon } from "lucide-react";
import { fmtDateShort } from "@/lib/format";
import { PARTY_LABEL } from "@/lib/types";
import type { MeetingItem } from "@/lib/view/active";

interface MeetingsListProps {
  meetings: MeetingItem[];
  onSelectCase: (caseId: string) => void;
  heading: string;
}

/**
 * Meetings and walkthroughs, shown apart from the tier-colored calendar grid (`MonthGrid`,
 * `WeekGrid` and `DayStrip` have no item kind of their own to draw a meeting as, see
 * engineRequests): one outline row per meeting, with a meeting icon and label, never color
 * alone, naming who attends. Clicking one opens its case. Shared by the Today strip and the
 * Calendar view, for all three city roles (PRD "Consultation": "appears on all three calendars").
 */
export function MeetingsList({ meetings, onSelectCase, heading }: MeetingsListProps) {
  if (meetings.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">{heading}</p>
      <ul className="flex flex-col gap-1.5">
        {meetings.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => onSelectCase(m.caseId)}
              className="flex w-full items-start gap-2 rounded-control border border-dashed border-line-subtle bg-surface-1 px-2.5 py-1.5 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring hover:bg-surface-hover"
            >
              <CalendarClockIcon className="mt-0.5 size-3.5 shrink-0 text-fg-label" aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs font-medium text-fg">
                  {fmtDateShort(m.date)}: {m.label}
                  {m.held ? " (held)" : ""}
                </span>
                <span className="truncate text-xs text-fg-secondary">
                  {m.eventName} · {m.attendees.map((p) => PARTY_LABEL[p]).join(", ")}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
