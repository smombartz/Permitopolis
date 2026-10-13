"use client";

import { cn } from "@/lib/utils";
import { TIER_LABEL } from "@/lib/types";
import { TIER_ICON } from "@/components/domain/icons";
import { blackoutOn, dayOfMonth, groupItemsByDate, impactedOn, weekDays, weekdayShortLabel } from "./utils";
import { TIER_DOT_CLASS } from "./tierStyles";
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
  className?: string;
}

/** One week, one column per day, each session shown with its time. */
export function WeekGrid({ items, today, weekStart, onSelectItem, onSelectDay, className }: WeekGridProps) {
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
            <button
              type="button"
              onClick={() => onSelectDay?.(date)}
              aria-current={isToday ? "date" : undefined}
              className={cn(
                "mb-1 block w-full rounded px-1 py-0.5 text-left text-xs font-semibold text-fg-label",
                FOCUS_RING,
                isToday && "bg-pill text-fg-pill",
              )}
            >
              {weekdayShortLabel(date)} {dayOfMonth(date)}
            </button>
            {blackout && (
              <p className="mb-1 text-[10px] font-medium text-danger-fg" title={blackout.label}>
                Blackout
              </p>
            )}
            {impacted.length > 0 && (
              <p className="mb-1 text-[10px] font-medium text-warning-fg" title={impacted.map((i) => i.reason).join("; ")}>
                Impacted
              </p>
            )}
            <ul className="space-y-1">
              {dayItems.map((item) => {
                const TierIcon = TIER_ICON[item.tier];
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelectItem?.(item.id)}
                      title={`${TIER_LABEL[item.tier]}: ${item.label}`}
                      className={cn(
                        "flex w-full flex-col gap-0.5 truncate rounded px-1.5 py-1 text-left text-[11px] text-fg-secondary hover:bg-surface-hover",
                        FOCUS_RING,
                      )}
                    >
                      <span className="flex items-center gap-1">
                        <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", TIER_DOT_CLASS[item.tier])} />
                        <TierIcon aria-hidden className="size-2.5 shrink-0" />
                        <span className="sr-only">{TIER_LABEL[item.tier]}: </span>
                        <span className="truncate font-medium text-fg">{item.label}</span>
                      </span>
                      {(item.start || item.end) && (
                        <span className="pl-2.5 text-fg-secondary">
                          {item.start}
                          {item.end ? `–${item.end}` : ""}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
