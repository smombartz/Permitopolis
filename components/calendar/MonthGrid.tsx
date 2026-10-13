"use client";

import { cn } from "@/lib/utils";
import { ItemMark, itemTitle, MEETING_ITEM_CLASS } from "./ItemMark";
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
            <div
              key={date}
              className={cn("min-h-24 rounded-control border border-line-subtle/60 p-1", !inMonth && "opacity-40")}
            >
              <button
                type="button"
                onClick={() => onSelectDay?.(date)}
                aria-current={isToday ? "date" : undefined}
                aria-pressed={selected === undefined ? undefined : date === selected}
                className={cn(
                  "mb-1 flex w-full items-center justify-between rounded px-1 text-xs text-fg-secondary",
                  FOCUS_RING,
                  isToday && "bg-pill font-semibold text-fg-pill",
                  date === selected && SELECTED_DAY,
                )}
              >
                <span>{dayOfMonth(date)}</span>
                {isToday && <span className="sr-only">Today</span>}
              </button>
              {blackout && (
                <p className="mb-1 truncate text-[10px] font-medium text-danger-fg" title={blackout.label}>
                  Blackout
                </p>
              )}
              {impacted.length > 0 && (
                <p
                  className="mb-1 truncate text-[10px] font-medium text-warning-fg"
                  title={impacted.map((i) => i.reason).join("; ")}
                >
                  Impacted
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
                        "flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] text-fg-secondary hover:bg-surface-hover",
                        item.kind === "meeting" && MEETING_ITEM_CLASS,
                        FOCUS_RING,
                      )}
                    >
                      <ItemMark item={item} />
                      <span className="truncate">{item.label}</span>
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
