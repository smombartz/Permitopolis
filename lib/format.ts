/**
 * All user-facing dates, times and money go through these, so copy reads the
 * same everywhere: "Sat, Jun 26, 2027", "6 to 9 pm", "$1,240".
 */
import { format } from "date-fns";
import { daysBetween, toDate } from "@/lib/dates";
import type { HHmm, ISODate, ISODateTime } from "@/lib/types";

/** "Sat, Jun 26, 2027" */
export function fmtDate(iso: ISODate | ISODateTime): string {
  return format(toDate(iso), "EEE, MMM d, yyyy");
}

/** "Sat, Jun 26" */
export function fmtDateShort(iso: ISODate | ISODateTime): string {
  return format(toDate(iso), "EEE, MMM d");
}

/** "Jun 26" */
export function fmtMonthDay(iso: ISODate | ISODateTime): string {
  return format(toDate(iso), "MMM d");
}

/** "6 pm", "11:30 am", "noon", "midnight" */
export function fmtTime(time: HHmm): string {
  const [hours, minutes] = time.split(":").map(Number);
  if (hours === 12 && minutes === 0) return "noon";
  if (hours === 0 && minutes === 0) return "midnight";
  const meridiem = hours >= 12 ? "pm" : "am";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === 0 ? `${hour12} ${meridiem}` : `${hour12}:${String(minutes).padStart(2, "0")} ${meridiem}`;
}

/** "6 to 9 pm", "11 am to 4 pm", "noon to 9 pm", "6 to 11:30 am" */
export function fmtTimeRange(start: HHmm, end: HHmm): string {
  const from = fmtTime(start);
  const to = fmtTime(end);
  const fromMeridiem = from.endsWith(" am") ? " am" : from.endsWith(" pm") ? " pm" : "";
  if (fromMeridiem && to.endsWith(fromMeridiem)) return `${from.slice(0, -3)} to ${to}`;
  return `${from} to ${to}`;
}

/** "Fri, Apr 30, 2027, 2:10 pm" */
export function fmtDateTime(at: ISODateTime): string {
  return `${fmtDate(at)}, ${fmtTime(at.slice(11, 16))}`;
}

/** "$1,240"; cents only when there are some: "$62.50" */
export function fmtMoney(amount: number): string {
  const negative = amount < 0;
  const value = Math.abs(amount);
  const whole = Number.isInteger(Math.round(value * 100) / 100);
  const text = value.toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });
  return `${negative ? "-" : ""}$${text}`;
}

/** "1,200" */
export function fmtNumber(value: number): string {
  return value.toLocaleString("en-US");
}

/** plural(3, 'day') is "3 days"; plural(1, 'day') is "1 day" */
export function plural(count: number, noun: string, pluralNoun?: string): string {
  return `${fmtNumber(count)} ${count === 1 ? noun : (pluralNoun ?? `${noun}s`)}`;
}

/** "46 days to go", "Tomorrow", "Today", "9 days ago" */
export function fmtDaysToGo(eventDate: ISODate, today: ISODate): string {
  const days = daysBetween(today, eventDate);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0 ? `${plural(days, "day")} to go` : `${plural(-days, "day")} ago`;
}

/** "Due in 6 days", "Due tomorrow", "Due today", "Overdue by 2 days" */
export function fmtDue(dueDate: ISODate, today: ISODate): string {
  const days = daysBetween(today, dueDate);
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days > 1) return `Due in ${plural(days, "day")}`;
  return `Overdue by ${plural(-days, "day")}`;
}

/** "Due in 6 days · Sat, May 8" */
export function fmtDueFull(dueDate: ISODate, today: ISODate): string {
  return `${fmtDue(dueDate, today)} · ${fmtDateShort(dueDate)}`;
}

export function isOverdue(dueDate: ISODate | null, today: ISODate): boolean {
  return dueDate !== null && dueDate < today;
}

/** "3.1 miles", "1 mile" */
export function fmtMiles(miles: number): string {
  return `${miles} ${miles === 1 ? "mile" : "miles"}`;
}

/** File size for the upload list: "248 KB", "1.2 MB" */
export function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
