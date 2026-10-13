"use client";

import { DayPicker } from "react-day-picker";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toDate, toISO } from "@/lib/dates";
import type { ISODate } from "@/lib/types";

const QUICK_JUMPS: { date: ISODate; label: string }[] = [
  { date: "2027-05-03", label: "Mon, May 3 (start)" },
  { date: "2027-06-18", label: "Fri, Jun 18 (Jazz in the Plaza)" },
  { date: "2027-07-11", label: "Sun, Jul 11 (Riverfront Summer 5K)" },
];

const DAY_PICKER_CLASS_NAMES = {
  months: "flex flex-col gap-2",
  month_caption: "flex items-center justify-center pb-2 text-sm font-semibold text-fg",
  nav: "flex items-center justify-between",
  weekdays: "flex",
  weekday: "size-8 text-center text-[11px] font-bold text-fg-label uppercase",
  week: "flex",
  day: "size-8 p-0 text-center text-sm",
  day_button:
    "size-8 rounded-control text-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
  selected: "[&>button]:bg-indigo-650 [&>button]:text-fg-on-accent [&>button]:hover:bg-indigo-500",
  today: "[&>button]:font-bold",
  outside: "text-fg-tertiary", // guard-allow-tertiary: days outside the month are decoration, not content to read
  disabled: "opacity-40",
};

interface DemoDatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  demoToday: ISODate;
  onSelect: (date: ISODate) => void;
}

/** "Set demo date": react-day-picker inside a popover, plus the PRD's three quick jumps. */
function DemoDatePicker({ open, onOpenChange, demoToday, onSelect }: DemoDatePickerProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <span aria-hidden="true" className="pointer-events-none absolute inset-0" />
      </PopoverAnchor>
      <PopoverContent align="end" className="w-auto">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className="mb-1 text-[11px] font-bold tracking-[.12em] text-fg-label uppercase">Quick jumps</p>
            {QUICK_JUMPS.map((jump) => (
              <Button
                key={jump.date}
                variant={jump.date === demoToday ? "secondary" : "ghost"}
                size="sm"
                className="justify-start"
                onClick={() => onSelect(jump.date)}
              >
                {jump.label}
              </Button>
            ))}
          </div>
          <DayPicker
            mode="single"
            selected={toDate(demoToday)}
            defaultMonth={toDate(demoToday)}
            onSelect={(date) => {
              if (date) onSelect(toISO(date));
            }}
            classNames={DAY_PICKER_CLASS_NAMES}
          />
          <p className="text-xs text-fg-secondary">
            Moving the date back doesn&apos;t undo anything; Reset demo data does.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { DemoDatePicker };
