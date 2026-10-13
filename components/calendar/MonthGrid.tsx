"use client";

import { cn } from "@/lib/utils";
import { fmtDateShort } from "@/lib/format";
import { ItemMark, dayName, eventCount, itemTitle, MEETING_ITEM_CLASS } from "./ItemMark";
import { blackoutOn, dayOfMonth, groupItemsByDate, impactedOn, isSameMonth, monthGridDays, monthLabel } from "./utils";
import { SELECTED_DAY } from "./tierStyles";
import type { CalendarItem } from "./types";
import type { ISODate } from "@/lib/types";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

export interface MonthGridProps {
  items: CalendarItem[];
  today: ISODate;
  month: ISODate;
  onSelectItem?: (id: string) => void;
  onSelectDay?: (date: ISODate) => void;
  /** The chosen day, marked with a ring and `aria-pressed`. Leave it out where a day cannot be chosen. */
  selected?: ISODate;
  className?: string;
}

const WEEKDAY_HEADS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A month of days, each cell listing the items that land on it: events by tier, meetings outlined. */
export function MonthGrid({ items, today, month, onSelectItem, onSelectDay, selected, className }: MonthGridProps) {
  const days = monthGridDays(month);
  const byDate = groupItemsByDate(items);

  return (
    <div className={cn("rounded-panel border border-line-subtle bg-surface-1 p-3", className)}>
      <p className="mb-3 text-sm font-semibold text-fg">{monthLabel(month)}</p>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_HEADS.map((head) => (
          <div key={head} className="px-1 py-1 text-center text-xs font-medium text-fg-label">
            {head}
          </div>
        ))}
        {days.map((date) => {
          const dayItems = byDate[date] ?? [];
          const blackout = blackoutOn(date);
          const impacted = impactedOn(date);
          const isToday = date === today;
          const inMonth = isSameMonth(date, month);
          return (
            // A day of the month before or after is set apart by a dashed, flat cell, not by fading
            // it: its events are still text someone reads (at 40% they were under 2:1).
            <div
              key={date}
              data-outside={inMonth ? undefined : ""}
              className={cn("min-h-24 rounded-control border border-line-subtle/60 p-1", !inMonth && "border-dashed bg-surface-soft")}
            >
              {onSelectDay ? (
                // 24px tall, like the items under it: stacked this close, anything shorter fails WCAG 2.5.8.
                <button
                  type="button"
                  onClick={() => onSelectDay(date)}
                  aria-label={dayName(date, isToday, eventCount(dayItems))}
                  aria-current={isToday ? "date" : undefined}
                  aria-pressed={selected === undefined ? undefined : date === selected}
                  className={cn(
                    "mb-1 flex min-h-6 w-full items-center justify-between rounded px-1 text-xs text-fg-secondary",
                    FOCUS_RING,
                    isToday && "bg-pill font-semibold text-fg-pill",
                    date === selected && SELECTED_DAY,
                  )}
                >
                  {dayOfMonth(date)}
                </button>
              ) : (
                // Nothing to choose (Settings' blackout calendar): the day is a label, not a button that does nothing.
                <p aria-current={isToday ? "date" : undefined} className={cn("mb-1 flex min-h-6 items-center rounded px-1 text-xs text-fg-secondary", isToday && "bg-pill font-semibold text-fg-pill")}>
                  <span aria-hidden="true">{dayOfMonth(date)}</span>
                  <span className="sr-only">{dayName(date, isToday, eventCount(dayItems))}</span>
                </p>
              )}
              {blackout && (
                <p className="mb-1 truncate text-[10px] font-medium text-danger-fg" title={blackout.label}>
                  Blackout
                  <span className="sr-only">: {blackout.label}</span>
                </p>
              )}
              {impacted.length > 0 && (
                <p
                  className="mb-1 truncate text-[10px] font-medium text-warning-fg"
                  title={impacted.map((i) => i.reason).join("; ")}
                >
                  Impacted
                  <span className="sr-only">: {impacted.map((i) => i.reason).join("; ")}</span>
                </p>
              )}
              <ul className="space-y-0.5">
                {dayItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelectItem?.(item.id)}
                      title={itemTitle(item)}
                      data-kind={item.kind ?? "event"}
                      className={cn(
                        "flex min-h-6 w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] text-fg-secondary hover:bg-surface-hover",
                        item.kind === "meeting" && MEETING_ITEM_CLASS,
                        FOCUS_RING,
                      )}
                    >
                      <ItemMark item={item} />
                      <span className="truncate">{item.label}</span>
                      {/* A series is on many days: the name says which one. */}
                      <span className="sr-only">, {fmtDateShort(date)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
