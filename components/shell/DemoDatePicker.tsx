"use client";

import type * as React from "react";

import { DayPicker } from "react-day-picker";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { DEMO_DATE_JUMPS } from "@/lib/data/demoScript";
import { toDate, toISO } from "@/lib/dates";
import { fmtDate } from "@/lib/format";
import type { ISODate } from "@/lib/types";

const DAY_PICKER_CLASS_NAMES = {
  months: "flex flex-col gap-2",
  month_caption: "flex items-center justify-center pb-2 text-sm font-semibold text-fg",
  nav: "flex items-center justify-between",
  weekdays: "flex",
  weekday: "size-8 pointer-coarse:w-11 text-center text-[11px] font-bold text-fg-label uppercase",
  week: "flex",
  day: "size-8 pointer-coarse:size-11 p-0 text-center text-sm",
  day_button:
    "size-8 pointer-coarse:size-11 rounded-control text-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
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
  /**
   * Where focus goes when the picker closes. A popover hands focus back to its trigger, and
   * this one has none (it opens from a menu item, anchored to the Demo menu's button), so Esc
   * left a keyboard at the top of the page.
   */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

/** "Set demo date": react-day-picker inside a popover, plus the demo script's date jumps (lib/data/demoScript.ts). */
function DemoDatePicker({ open, onOpenChange, demoToday, onSelect, returnFocusRef }: DemoDatePickerProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <span aria-hidden="true" className="pointer-events-none absolute inset-0" />
      </PopoverAnchor>
      <PopoverContent
        align="end"
        className="w-auto"
        aria-label="Set demo date"
        onCloseAutoFocus={(event) => {
          if (!returnFocusRef?.current) return;
          event.preventDefault();
          returnFocusRef.current.focus();
        }}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className="mb-1 text-[11px] font-bold tracking-[.12em] text-fg-label uppercase">Quick jumps</p>
            {DEMO_DATE_JUMPS.map((jump) => (
              <Button
                key={jump.date}
                variant={jump.date === demoToday ? "secondary" : "ghost"}
                size="sm"
                className="justify-start"
                aria-pressed={jump.date === demoToday}
                onClick={() => onSelect(jump.date)}
              >
                <span className="font-mono">{fmtDate(jump.date)}</span>
                <span className="font-normal text-fg-secondary">{jump.note}</span>
              </Button>
            ))}
          </div>
          <DayPicker
            mode="single"
            selected={toDate(demoToday)}
            defaultMonth={toDate(demoToday)}
            // Without this the picker marks the real today, which the demo never shows.
            today={toDate(demoToday)}
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
