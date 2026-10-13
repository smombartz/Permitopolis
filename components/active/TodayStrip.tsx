"use client";

import { DayStrip, type CalendarItem } from "@/components/calendar";
import type { ISODate } from "@/lib/types";

interface TodayStripProps {
  /** "Mon, May 3: 1 event today" / "Mon, May 3: no events today" (lib/view/active's todayLine). */
  headline: string;
  /** Every held session, and the scheduled meetings while "Show meetings" is on: each in its own day. */
  items: CalendarItem[];
  today: ISODate;
  onSelectDay: (date: ISODate) => void;
  /** The day the views below are on, marked in the strip. */
  selected?: ISODate;
  onSelectCase: (caseId: string) => void;
}

/** Today in words, then the next 7 days, each with its own events and meetings (PRD "Active permits"). */
export function TodayStrip({ headline, items, today, onSelectDay, selected, onSelectCase }: TodayStripProps) {
  // An item's id starts with its case's id: a session is `<case>:<date>`, a meeting is its card's id.
  function onSelectItem(id: string) {
    const [caseId] = id.split(":");
    onSelectCase(caseId);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-fg">{headline}</p>
      <DayStrip items={items} today={today} onSelectDay={onSelectDay} selected={selected} onSelectItem={onSelectItem} />
    </div>
  );
}
