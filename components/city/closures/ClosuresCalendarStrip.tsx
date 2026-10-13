"use client";

import { cn } from "@/lib/utils";
import { fmtDateShort } from "@/lib/format";
import { SELECTED_DAY } from "@/components/calendar/tierStyles";
import { closureDayLabel, type ClosureDay } from "@/lib/view/closures";
import type { ISODate } from "@/lib/types";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

interface ClosuresCalendarStripProps {
  days: ClosureDay[];
  selected?: ISODate;
  onSelectDay: (date: ISODate) => void;
}

/** The days in the chosen range, each with what is on the map that day (closures and bookings apart) and any blackout or impacted mark. */
function ClosuresCalendarStrip({ days, selected, onSelectDay }: ClosuresCalendarStripProps) {
  return (
    <div className="flex gap-2 overflow-x-auto" role="list" aria-label="Days in range">
      {days.map((day) => (
        <div key={day.date} role="listitem" className="w-36 shrink-0">
          <button
            type="button"
            onClick={() => onSelectDay(day.date)}
            aria-pressed={selected === day.date}
            className={cn(
              "w-full rounded-panel border border-line-subtle bg-surface-1 p-2 text-left",
              FOCUS_RING,
              selected === day.date && SELECTED_DAY,
            )}
          >
            <p className="text-xs font-semibold text-fg-label">{fmtDateShort(day.date)}</p>
            <p className="text-sm text-fg">{closureDayLabel(day)}</p>
            {day.blackoutLabel ? (
              <p className="mt-0.5 truncate text-[11px] font-medium text-danger-fg" title={day.blackoutLabel}>
                Blackout
                <span className="sr-only">: {day.blackoutLabel}</span>
              </p>
            ) : null}
            {day.impactedReason ? (
              <p className="mt-0.5 truncate text-[11px] font-medium text-warning-fg" title={day.impactedReason}>
                Impacted
                <span className="sr-only">: {day.impactedReason}</span>
              </p>
            ) : null}
          </button>
        </div>
      ))}
    </div>
  );
}

export { ClosuresCalendarStrip };
