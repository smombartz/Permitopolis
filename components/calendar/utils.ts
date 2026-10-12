/**
 * Pure date-grid helpers for MonthGrid, WeekGrid and DayStrip. Thin wrappers over
 * date-fns and `lib/dates.ts`; nothing here reads the real clock.
 */
import { eachDayOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { addDaysISO, toDate, toISO } from "@/lib/dates";
import { BLACKOUTS, IMPACTED, type Blackout, type ImpactedDate } from "@/lib/data/calendar";
import type { ISODate } from "@/lib/types";
import type { CalendarItem } from "./types";

/** Every day shown in a month's grid, including the leading/trailing days of its weeks. */
export function monthGridDays(monthAnchor: ISODate): ISODate[] {
  const anchor = toDate(monthAnchor);
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 0 });
  return eachDayOfInterval({ start, end }).map((d) => toISO(d));
}

/** The 7 days of the week starting on `weekStart`. */
export function weekDays(weekStart: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));
}

/** `today` plus the following `count - 1` days. */
export function nextDays(today: ISODate, count: number): ISODate[] {
  return Array.from({ length: count }, (_, i) => addDaysISO(today, i));
}

export function monthLabel(monthAnchor: ISODate): string {
  return format(toDate(monthAnchor), "MMMM yyyy");
}

export function weekdayShortLabel(date: ISODate): string {
  return format(toDate(date), "EEE");
}

export function dayOfMonth(date: ISODate): number {
  return Number(format(toDate(date), "d"));
}

export function isSameMonth(date: ISODate, monthAnchor: ISODate): boolean {
  return date.slice(0, 7) === monthAnchor.slice(0, 7);
}

export function groupItemsByDate(items: CalendarItem[]): Record<ISODate, CalendarItem[]> {
  const grouped: Record<ISODate, CalendarItem[]> = {};
  for (const item of items) {
    (grouped[item.date] ??= []).push(item);
  }
  return grouped;
}

export function blackoutOn(date: ISODate): Blackout | undefined {
  return BLACKOUTS.find((b) => b.date === date);
}

export function impactedOn(date: ISODate): ImpactedDate[] {
  return IMPACTED.filter((i) => i.date === date);
}
