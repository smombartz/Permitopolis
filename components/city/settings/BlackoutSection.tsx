"use client";

/**
 * Settings, section 4: the blackout and impacted dates from lib/data/calendar.ts, read-only.
 * `MonthGrid` already shades a blackout or impacted day on its own (it reads the same
 * constants), so the month view needs no calendar items of its own; the list under it spells
 * out what, when and which places for a month that is easy to skim past on the grid alone.
 */
import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Section } from "@/components/ui/section";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { MonthGrid } from "@/components/calendar";
import { DateText } from "@/components/domain";
import { fmtTimeRange } from "@/lib/format";
import type { ISODate } from "@/lib/types";
import { blackoutRows, impactedRows, monthOffset } from "@/lib/view/settings";

interface BlackoutSectionProps {
  today: ISODate;
}

function BlackoutSection({ today }: BlackoutSectionProps) {
  const [month, setMonth] = React.useState(today);
  const blackouts = blackoutRows();
  const impacted = impactedRows();

  return (
    <Section title="Blackout calendar" description="Dates the city holds back from every booking, and dates a permitted event impacts without blocking one.">
      <InlineAlert variant="info">Read-only in the prototype.</InlineAlert>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => setMonth((m) => monthOffset(m, -1))}>
            <ChevronLeftIcon />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => setMonth((m) => monthOffset(m, 1))}>
            <ChevronRightIcon />
          </Button>
        </div>
      </div>

      <MonthGrid items={[]} today={today} month={month} className="max-w-xl" />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-fg">Blackout dates</h3>
          {blackouts.map((row) => (
            <div key={row.date} className="flex flex-wrap items-baseline gap-2 text-sm">
              <Chip variant="danger">
                <DateText date={row.date} />
              </Chip>
              <p className="text-fg-secondary">
                {row.label}
                {row.places ? ` — ${row.places}` : ""}
                {row.from ? ` (from ${row.from})` : ""}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-fg">Impacted dates</h3>
          {impacted.map((row) => (
            <div key={row.date} className="flex flex-wrap items-baseline gap-2 text-sm">
              <Chip variant="warning">
                <DateText date={row.date} />
              </Chip>
              <p className="text-fg-secondary">
                {row.reason}, {fmtTimeRange(row.from, row.to)} — {row.places}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

export { BlackoutSection };
