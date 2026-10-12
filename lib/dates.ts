/**
 * Date helpers for ISO date strings ('2027-05-03'). Always go through these:
 * `new Date('2027-05-03')` parses as UTC and shifts by a day in most time zones.
 * Nothing here reads the real clock; the demo runs on demoToday().
 */
import { addDays, differenceInCalendarDays, format, getDay, parseISO } from "date-fns";
import type { HHmm, ISODate, ISODateTime } from "@/lib/types";

export function toDate(iso: ISODate | ISODateTime): Date {
  return parseISO(iso);
}

export function toISO(date: Date): ISODate {
  return format(date, "yyyy-MM-dd");
}

export function dateOf(at: ISODateTime | ISODate): ISODate {
  return at.slice(0, 10);
}

export function addDaysISO(iso: ISODate, days: number): ISODate {
  return toISO(addDays(parseISO(iso), days));
}

/** Calendar days from `from` to `to`. Positive when `to` is later. */
export function daysBetween(from: ISODate, to: ISODate): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from));
}

/** 0 is Sunday. */
export function weekdayOf(iso: ISODate): number {
  return getDay(parseISO(iso));
}

export function isWeekend(iso: ISODate): boolean {
  const day = weekdayOf(iso);
  return day === 0 || day === 6;
}

/** A date on a weekend moves to the Friday before; any other date is unchanged. */
export function rollBackToFriday(iso: ISODate): ISODate {
  const day = weekdayOf(iso);
  if (day === 6) return addDaysISO(iso, -1);
  if (day === 0) return addDaysISO(iso, -2);
  return iso;
}

export function isBefore(a: ISODate, b: ISODate): boolean {
  return a < b;
}

export function isAfter(a: ISODate, b: ISODate): boolean {
  return a > b;
}

export function minutesOf(time: HHmm): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Hours between two times on the same day, e.g. ('11:00', '16:00') is 5. */
export function hoursBetween(start: HHmm, end: HHmm): number {
  return (minutesOf(end) - minutesOf(start)) / 60;
}

/** True when [aStart, aEnd) and [bStart, bEnd) overlap. */
export function timesOverlap(aStart: HHmm, aEnd: HHmm, bStart: HHmm, bEnd: HHmm): boolean {
  return minutesOf(aStart) < minutesOf(bEnd) && minutesOf(bStart) < minutesOf(aEnd);
}

/** Every date from `first` to `until` inclusive, `stepDays` apart. */
export function datesEvery(first: ISODate, until: ISODate, stepDays: number): ISODate[] {
  const dates: ISODate[] = [];
  for (let date = first; date <= until; date = addDaysISO(date, stepDays)) dates.push(date);
  return dates;
}

/** `${date}T${time}`. */
export function at(date: ISODate, time: HHmm = "09:00"): ISODateTime {
  return `${date}T${time}`;
}
