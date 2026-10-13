import { CalendarClockIcon } from "lucide-react";
import { TIER_ICON } from "@/components/domain/icons";
import { fmtDate, plural } from "@/lib/format";
import { TIER_LABEL, type ISODate } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TIER_DOT_CLASS } from "./tierStyles";
import type { CalendarItem } from "./types";

/**
 * What goes before an item's label in every calendar view: the tier's dot and icon for an
 * event, a meeting icon for a meeting, each with its meaning in words for a screen reader.
 */
export function ItemMark({ item }: { item: CalendarItem }) {
  if (item.kind === "meeting") {
    return (
      <>
        <CalendarClockIcon aria-hidden className="size-2.5 shrink-0 text-fg-label" />
        <span className="sr-only">Meeting: </span>
      </>
    );
  }
  const TierIcon = TIER_ICON[item.tier];
  return (
    <>
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", TIER_DOT_CLASS[item.tier])} />
      <TierIcon aria-hidden className="size-2.5 shrink-0" />
      <span className="sr-only">{TIER_LABEL[item.tier]}: </span>
    </>
  );
}

/** The tooltip of an item's button: its kind and name, or the fuller `detail` when the item gives one. */
export function itemTitle(item: CalendarItem): string {
  if (item.detail) return item.detail;
  return item.kind === "meeting" ? `Meeting: ${item.label}` : `${TIER_LABEL[item.tier]}: ${item.label}`;
}

/**
 * A day's accessible name in the month and week grids: the whole date (a cell shows only "25" or
 * "Mon 3"), whether it is today, and how many events are on it.
 */
export function dayName(date: ISODate, isToday: boolean, events: number): string {
  return `${fmtDate(date)}${isToday ? ", today" : ""}${events > 0 ? `, ${plural(events, "event")}` : ""}`;
}

/** A meeting's own outline, so it reads apart from the events around it without a color of its own. */
export const MEETING_ITEM_CLASS = "border border-dashed border-line-magnetic";

/** The events among a day's items: what "2 events" counts. A meeting is not an event. */
export function eventCount(items: CalendarItem[]): number {
  return items.filter((item) => item.kind !== "meeting").length;
}
