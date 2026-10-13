"use client";

import { ChevronLeftIcon, ChevronRightIcon, MapPinXIcon } from "lucide-react";
import { PermitopolisMap, type MapHighlight } from "@/components/map";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { StickyAside } from "@/components/ui/sticky-aside";
import { fmtDate } from "@/lib/format";
import { addDaysISO } from "@/lib/dates";
import type { Dept, EventCase, ISODate } from "@/lib/types";
import { RoleOverlaySidePanel } from "./RoleOverlay";

interface ActiveMapViewProps {
  highlights: MapHighlight[];
  /** The cases on show (the active permits, with held dates when that is on): what the side panel totals. */
  cases: EventCase[];
  today: ISODate;
  role: Dept;
  date: ISODate;
  onDateChange: (next: ISODate) => void;
  blackoutLabel: string | null;
  selectedId?: string;
  onSelectCase: (caseId: string) => void;
}

/** Map: the Permitopolis map for the chosen day, held and permitted bookings with overlaps. */
export function ActiveMapView({ highlights, cases, today, role, date, onDateChange, blackoutLabel, selectedId, onSelectCase }: ActiveMapViewProps) {
  function onSelect(id: string) {
    const [caseId] = id.split(":");
    onSelectCase(caseId);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_260px]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Previous day" onClick={() => onDateChange(addDaysISO(date, -1))}>
            <ChevronLeftIcon />
          </Button>
          {/* Polite: Previous day, Next day and the date field change it, and it says which day the map now shows. */}
          <p aria-live="polite" className="min-w-40 text-sm font-semibold text-fg">
            {fmtDate(date)}
          </p>
          <Button variant="ghost" size="icon-sm" aria-label="Next day" onClick={() => onDateChange(addDaysISO(date, 1))}>
            <ChevronRightIcon />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDateChange(today)}>
            Today
          </Button>
          {/* Any day in one step: Jul 11 is 69 presses of "Next day" from May 3. */}
          <Input
            type="date"
            aria-label="Go to a date"
            value={date}
            onChange={(event) => {
              if (event.target.value) onDateChange(event.target.value);
            }}
            className="ml-1 h-8 w-40 text-xs"
          />
        </div>

        {blackoutLabel && highlights.length > 0 ? <Banner variant="warning">{blackoutLabel}</Banner> : null}

        {highlights.length === 0 ? (
          <EmptyState icon={MapPinXIcon} title="Nothing booked or held" text={blackoutLabel ?? `No permits or holds on ${fmtDate(date)}.`} />
        ) : (
          <PermitopolisMap highlights={highlights} selectedId={selectedId} onSelect={onSelect} />
        )}
      </div>
      <StickyAside aria-label="This day for your role">
        <RoleOverlaySidePanel role={role} cases={cases} today={today} date={date} />
      </StickyAside>
    </div>
  );
}
