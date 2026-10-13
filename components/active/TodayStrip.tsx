"use client";

import { DayStrip, type CalendarItem } from "@/components/calendar";
import type { ISODate } from "@/lib/types";
import type { MeetingItem } from "@/lib/view/active";
import { MeetingsList } from "./MeetingsList";

interface TodayStripProps {
  /** "Mon, May 3: 1 event today" / "Mon, May 3: no events today" (lib/view/active's todayLine). */
  headline: string;
  items: CalendarItem[];
  today: ISODate;
  onSelectDay: (date: ISODate) => void;
  /** The day the views below are on, marked in the strip. */
  selected?: ISODate;
  onSelectCase: (caseId: string) => void;
  /** Every scheduled meeting and walkthrough in the strip's own 8 days, "Show meetings" permitting. */
  meetings: MeetingItem[];
  showMeetings: boolean;
}

/** Today in words, then the next 7 days, each with its own events (PRD "Active permits"). */
export function TodayStrip({ headline, items, today, onSelectDay, selected, onSelectCase, meetings, showMeetings }: TodayStripProps) {
  function onSelectItem(id: string) {
    const [caseId] = id.split(":");
    onSelectCase(caseId);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-fg">{headline}</p>
      <DayStrip items={items} today={today} onSelectDay={onSelectDay} selected={selected} onSelectItem={onSelectItem} />
      {showMeetings ? <MeetingsList meetings={meetings} onSelectCase={onSelectCase} heading="Meetings this week" /> : null}
    </div>
  );
}
