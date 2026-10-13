"use client";

import { DayStrip, type CalendarItem } from "@/components/calendar";
import type { ISODate } from "@/lib/types";

interface TodayStripProps {
  /** "Mon, May 3: 1 event today" / "Mon, May 3: no events today" (lib/view/active's todayLine). */
  headline: string;
  items: CalendarItem[];
  today: ISODate;
  onSelectDay: (date: ISODate) => void;
  onSelectCase: (caseId: string) => void;
}

/** Today in words, then the next 7 days, each with its own events (PRD "Active permits"). */
export function TodayStrip({ headline, items, today, onSelectDay, onSelectCase }: TodayStripProps) {
  function onSelectItem(id: string) {
    const [caseId] = id.split(":");
    onSelectCase(caseId);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-fg">{headline}</p>
      <DayStrip items={items} today={today} onSelectDay={onSelectDay} onSelectItem={onSelectItem} />
    </div>
  );
}
