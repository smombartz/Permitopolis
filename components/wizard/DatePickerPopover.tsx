"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fmtDate } from "@/lib/format";
import { toDate, toISO } from "@/lib/dates";
import type { ISODate } from "@/lib/types";

/**
 * A single-date popover built on react-day-picker, restyled with Rime & Ink tokens (no
 * dependency on the library's own stylesheet). `today` and `fromDate` both come from the demo
 * clock, never the real one: the calendar opens on the demo's month and nothing before the
 * demo's today is pickable.
 *
 * Inside a `Field` the button is named by the field's label and its own text together ("Date,
 * Fri, Jun 18, 2027"): a `<label>` alone would replace the button's text as its name, and the
 * chosen date would never be read out. A button cannot carry `aria-required`, so a required
 * field says so in words a screen reader gets.
 */
export interface DatePickerPopoverProps {
  value: ISODate | null;
  onChange: (date: ISODate) => void;
  today: ISODate;
  /** The earliest pickable date. Defaults to `today`. */
  minDate?: ISODate;
  placeholder?: string;
  /** Set by `Field`. With it, the field's label (`<id>-label`) and the button's text make the name. */
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  /** Set by `Field` for a required field. Said in words, not passed on: `aria-required` is not valid on a button. */
  "aria-required"?: boolean | "true" | "false";
  disabled?: boolean;
  className?: string;
}

const DAY_CLASS_NAMES = {
  root: "p-3 text-sm",
  months: "flex flex-col gap-2",
  month: "flex flex-col gap-2",
  month_caption: "flex items-center justify-center pb-1 text-sm font-semibold text-fg",
  caption_label: "text-sm font-semibold text-fg",
  nav: "flex items-center justify-between",
  button_previous:
    "inline-flex size-8 pointer-coarse:size-11 items-center justify-center rounded-control text-fg-secondary outline-none hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:pointer-events-none disabled:opacity-40",
  button_next:
    "inline-flex size-8 pointer-coarse:size-11 items-center justify-center rounded-control text-fg-secondary outline-none hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:pointer-events-none disabled:opacity-40",
  chevron: "size-4 fill-current",
  month_grid: "border-collapse",
  weekdays: "",
  weekday: "h-8 w-9 pointer-coarse:w-11 text-center text-[11px] font-bold tracking-[.08em] text-fg-label uppercase",
  weeks: "",
  week: "",
  day: "p-0 text-center",
  day_button:
    "inline-flex size-9 pointer-coarse:size-11 items-center justify-center rounded-control text-sm text-fg outline-none transition-colors duration-[var(--dur-fast)] ease-frost hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
  today: "[&_button]:border [&_button]:border-indigo-650 [&_button]:font-semibold",
  selected: "[&_button]:bg-indigo-650 [&_button]:text-fg-on-accent [&_button]:hover:bg-indigo-500",
  outside: "text-fg-tertiary", // guard-allow-tertiary: days outside the month are decorative only
  disabled: "text-fg-tertiary opacity-50", // guard-allow-tertiary: a disabled day is decorative only
};

/**
 * `DayPicker` fires `onSelect` with `undefined` when the clicked day is already selected (a
 * toggle, for multi/range modes); in single mode re-clicking the same day should just keep it.
 */
function DatePickerPopover({
  value,
  onChange,
  today,
  minDate,
  placeholder = "Pick a date",
  disabled,
  className,
  id,
  "aria-required": ariaRequired,
  ...props
}: DatePickerPopoverProps) {
  const required = ariaRequired === true || ariaRequired === "true";
  const named = props["aria-label"] !== undefined || props["aria-labelledby"] !== undefined;
  const [open, setOpen] = React.useState(false);
  const todayDate = toDate(today);
  const earliest = toDate(minDate ?? today);
  const selected = value ? toDate(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          className={cn("w-full justify-start font-normal", !value && "text-fg-tertiary", className)} // guard-allow-tertiary: placeholder copy, not a value
          id={id}
          aria-labelledby={id && !named ? `${id}-label ${id}` : undefined}
          {...props}
        >
          <CalendarIcon data-icon="inline-start" aria-hidden="true" />
          {value ? fmtDate(value) : placeholder}
          {required ? <span className="sr-only">, required</span> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <DayPicker
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (!date) return;
            onChange(toISO(date));
            setOpen(false);
          }}
          today={todayDate}
          defaultMonth={selected ?? earliest}
          disabled={{ before: earliest }}
          classNames={DAY_CLASS_NAMES}
        />
      </PopoverContent>
    </Popover>
  );
}

export { DatePickerPopover };
