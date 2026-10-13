"use client";

import { cn } from "@/lib/utils";
import { fmtDateShort } from "@/lib/format";
import { ItemMark, dayName, eventCount, itemTitle, MEETING_ITEM_CLASS } from "./ItemMark";
import { blackoutOn, dayOfMonth, groupItemsByDate, impactedOn, weekDays, weekdayShortLabel } from "./utils";
import { SELECTED_DAY } from "./tierStyles";
import type { CalendarItem } from "./types";
import type { ISODate } from "@/lib/types";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

export interface WeekGridProps {
  items: CalendarItem[];
  today: ISODate;
  weekStart: ISODate;
  onSelectItem?: (id: string) => void;
  onSelectDay?: (date: ISODate) => void;
  /** The chosen day, marked with a ring and `aria-pressed`. Leave it out where a day cannot be chosen. */
  selected?: ISODate;
  className?: string;
}

/** One week, one column per day, each session shown with its time. */
export function WeekGrid({ items, today, weekStart, onSelectItem, onSelectDay, selected, className }: WeekGridProps) {
  const days = weekDays(weekStart);
  const byDate = groupItemsByDate(items);

  return (
    <div className={cn("grid grid-cols-7 gap-2", className)}>
      {days.map((date) => {
        const dayItems = byDate[date] ?? [];
        const blackout = blackoutOn(date);
        const impacted = impactedOn(date);
        const isToday = date === today;
        return (
          <div key={date} className="min-h-32 rounded-panel border border-line-subtle bg-surface-1 p-2">
            {onSelectDay ? (
              <button
                type="button"
                onClick={() => onSelectDay(date)}
                aria-label={dayName(date, isToday, eventCount(dayItems))}
                aria-current={isToday ? "date" : undefined}
                aria-pressed={selected === undefined ? undefined : date === selected}
                className={cn(
                  "mb-1 flex min-h-6 w-full items-center rounded px-1 py-0.5 text-left text-xs font-semibold text-fg-label",
                  FOCUS_RING,
                  isToday && "bg-pill text-fg-pill",
                  date === selected && SELECTED_DAY,
                )}
              >
                {weekdayShortLabel(date)} {dayOfMonth(date)}
              </button>
            ) : (
              // Nothing to choose: the day is a label, not a button that does nothing.
              <p aria-current={isToday ? "date" : undefined} className={cn("mb-1 flex min-h-6 items-center rounded px-1 py-0.5 text-xs font-semibold text-fg-label", isToday && "bg-pill text-fg-pill")}>
                <span aria-hidden="true">
                  {weekdayShortLabel(date)} {dayOfMonth(date)}
                </span>
                <span className="sr-only">{dayName(date, isToday, eventCount(dayItems))}</span>
              </p>
            )}
            {blackout && (
              <p className="mb-1 text-[10px] font-medium text-danger-fg" title={blackout.label}>
                Blackout
                <span className="sr-only">: {blackout.label}</span>
              </p>
            )}
            {impacted.length > 0 && (
              <p className="mb-1 text-[10px] font-medium text-warning-fg" title={impacted.map((i) => i.reason).join("; ")}>
                Impacted
                <span className="sr-only">: {impacted.map((i) => i.reason).join("; ")}</span>
              </p>
            )}
            <ul className="space-y-1">
              {dayItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelectItem?.(item.id)}
                    title={itemTitle(item)}
                    data-kind={item.kind ?? "event"}
                    className={cn(
                      "flex w-full flex-col gap-0.5 truncate rounded px-1.5 py-1 text-left text-[11px] text-fg-secondary hover:bg-surface-hover",
                      item.kind === "meeting" && MEETING_ITEM_CLASS,
                      FOCUS_RING,
                    )}
                  >
                    <span className="flex items-center gap-1">
                      <ItemMark item={item} />
                      <span className="truncate font-medium text-fg">{item.label}</span>
                      {/* A series is on many days: the name says which one. */}
                      <span className="sr-only">, {fmtDateShort(date)}</span>
                    </span>
                    {(item.start || item.end) && (
                      <span className="pl-2.5 text-fg-secondary">
                        {item.start}
                        {item.end ? `–${item.end}` : ""}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
