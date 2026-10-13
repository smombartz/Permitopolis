"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { MonthGrid, WeekGrid, type CalendarItem } from "@/components/calendar";
import { TierLegend } from "@/components/domain";
import { monthLabel } from "@/components/calendar/utils";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StickyAside } from "@/components/ui/sticky-aside";
import { fmtDateShort } from "@/lib/format";
import type { Dept, EventCase, ISODate } from "@/lib/types";
import { monthAnchorOf, shiftMonth, shiftWeek, weekStartOf } from "@/lib/view/active";
import { RoleOverlaySidePanel } from "./RoleOverlay";

export type CalendarSubView = "month" | "week";

interface ActiveCalendarViewProps {
  items: CalendarItem[];
  /** The cases on show (the active permits, with held dates when that is on): what the side panel totals. */
  cases: EventCase[];
  today: ISODate;
  role: Dept;
  /** The day the calendar is centered on; moving it also moves the Map view (shared `date`). */
  date: ISODate;
  onDateChange: (next: ISODate) => void;
  subView: CalendarSubView;
  onSubViewChange: (next: CalendarSubView) => void;
  onSelectCase: (caseId: string) => void;
}

/** Calendar: month and week, every series session shown, tier-colored with a legend. */
export function ActiveCalendarView({ items, cases, today, role, date, onDateChange, subView, onSubViewChange, onSelectCase }: ActiveCalendarViewProps) {
  const monthAnchor = monthAnchorOf(date);
  const weekStart = weekStartOf(date);

  function goPrev() {
    onDateChange(subView === "month" ? shiftMonth(monthAnchor, -1) : shiftWeek(weekStart, -1));
  }
  function goNext() {
    onDateChange(subView === "month" ? shiftMonth(monthAnchor, 1) : shiftWeek(weekStart, 1));
  }

  function onSelectItem(id: string) {
    const [caseId] = id.split(":");
    onSelectCase(caseId);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_260px]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Previous" onClick={goPrev}>
              <ChevronLeftIcon />
            </Button>
            <p className="min-w-40 text-sm font-semibold text-fg">{subView === "month" ? monthLabel(monthAnchor) : `Week of ${fmtDateShort(weekStart)}`}</p>
            <Button variant="ghost" size="icon-sm" aria-label="Next" onClick={goNext}>
              <ChevronRightIcon />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDateChange(today)}>
              Today
            </Button>
          </div>
          <SegmentedControl
            aria-label="Calendar view"
            value={subView}
            onChange={onSubViewChange}
            options={[
              { value: "month", label: "Month" },
              { value: "week", label: "Week" },
            ]}
          />
        </div>
        <TierLegend aria-label="Calendar legend: tiers" />
        {subView === "month" ? (
          <MonthGrid items={items} today={today} month={monthAnchor} onSelectItem={onSelectItem} onSelectDay={onDateChange} selected={date} />
        ) : (
          <WeekGrid items={items} today={today} weekStart={weekStart} onSelectItem={onSelectItem} onSelectDay={onDateChange} selected={date} />
        )}
      </div>
      <StickyAside>
        <RoleOverlaySidePanel role={role} cases={cases} today={today} />
      </StickyAside>
    </div>
  );
}
