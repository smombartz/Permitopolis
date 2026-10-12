"use client";

import { cn } from "@/lib/utils";
import { fmtDateShort, plural } from "@/lib/format";
import { TIER_LABEL } from "@/lib/types";
import { groupItemsByDate, nextDays } from "./utils";
import { TIER_DOT_CLASS } from "./tierStyles";
import type { CalendarItem } from "./types";
import type { ISODate } from "@/lib/types";

export interface DayStripProps {
  items: CalendarItem[];
  today: ISODate;
  onSelectItem?: (id: string) => void;
  onSelectDay?: (date: ISODate) => void;
  className?: string;
}

function summary(count: number, isToday: boolean): string {
  if (count === 0) return isToday ? "no events today" : "no events";
  return plural(count, "event");
}

/** Today, then the next 7 days. "Mon, May 3: no events today". */
export function DayStrip({ items, today, onSelectItem, onSelectDay, className }: DayStripProps) {
  const days = nextDays(today, 8);
  const byDate = groupItemsByDate(items);

  return (
    <div className={cn("flex gap-2 overflow-x-auto", className)} role="list" aria-label="Today and the next 7 days">
      {days.map((date) => {
        const dayItems = byDate[date] ?? [];
        const isToday = date === today;
        return (
          <div
            key={date}
            role="listitem"
            className={cn(
              "w-44 shrink-0 rounded-panel border border-line-subtle bg-surface-1 p-2",
              isToday && "border-indigo-650",
            )}
          >
            <button
              type="button"
              onClick={() => onSelectDay?.(date)}
              aria-current={isToday ? "date" : undefined}
              className="block w-full rounded px-1 text-left text-xs font-medium text-fg-label"
            >
              {fmtDateShort(date)}: {summary(dayItems.length, isToday)}
            </button>
            {dayItems.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {dayItems.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelectItem?.(item.id)}
                      className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] text-fg-secondary hover:bg-surface-hover"
                    >
                      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", TIER_DOT_CLASS[item.tier])} />
                      <span className="sr-only">{TIER_LABEL[item.tier]}: </span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                ))}
                {dayItems.length > 3 && (
                  <li className="px-1 text-[11px] text-fg-secondary">+{dayItems.length - 3} more</li>
                )}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
