"use client";

import * as React from "react";
import { DRAWABLE_AREA_RECT } from "@/lib/data/mapGeometry";
import { RIVERFRONT_5K_ROUTE } from "@/lib/data/streets";
import { buildAreaLocation, buildInventoryLocation, buildRouteLocation, buildStreetsLocation } from "@/lib/view/map";
import type { EventType, Location } from "@/lib/types";
import { LocationPicker } from "./LocationPicker";
import { PermitopolisMap } from "./PermitopolisMap";
import { MapThumbnail } from "./MapThumbnail";
import type { MapHighlight } from "./types";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { WeekGrid } from "@/components/calendar/WeekGrid";
import { DayStrip } from "@/components/calendar/DayStrip";
import type { CalendarItem } from "@/components/calendar/types";

/** The fixed demo date, as a plain string: this screen never reads the real clock. */
const TODAY = "2027-05-03";

const SAMPLE_HIGHLIGHTS: MapHighlight[] = [
  {
    id: "h-s1",
    location: buildInventoryLocation(["shelter-3"]),
    status: "permitted",
    tier: "instant",
    label: "Maya Chen's birthday picnic",
  },
  {
    id: "h-overlap",
    location: buildInventoryLocation(["shelter-3"]),
    status: "pending",
    tier: "reviewed",
    label: "A second request for Shelter 3 (overlap)",
  },
  {
    id: "h-s5",
    location: buildRouteLocation(RIVERFRONT_5K_ROUTE),
    status: "held",
    tier: "special",
    label: "Riverfront Summer 5K",
  },
  {
    id: "h-s4",
    location: buildStreetsLocation(["maple-400"]),
    status: "permitted",
    tier: "reviewed",
    label: "Maple Street block party",
  },
  {
    id: "h-s3",
    location: buildAreaLocation("city-hall-plaza", DRAWABLE_AREA_RECT["city-hall-plaza"]),
    status: "pending",
    tier: "special",
    label: "Downtown Arts Collective performance",
  },
];

const SAMPLE_CALENDAR_ITEMS: CalendarItem[] = [
  { id: "c-tai-chi", date: "2027-05-03", label: "Monday Tai Chi, Field 3", tier: "instant", status: "Event day" },
  { id: "c-picnic", date: "2027-05-22", start: "11:00", end: "16:00", label: "Maya Chen's birthday picnic", tier: "instant" },
  { id: "c-performance", date: "2027-06-18", start: "18:00", end: "21:00", label: "Downtown Arts Collective performance", tier: "reviewed" },
  { id: "c-block-party", date: "2027-06-21", start: "14:00", end: "20:00", label: "Maple Street block party", tier: "reviewed" },
  { id: "c-coordination", date: "2027-06-21", start: "09:00", end: "10:00", label: "5K coordination meeting", tier: "special" },
  { id: "c-5k", date: "2027-07-11", start: "07:00", end: "11:00", label: "Riverfront Summer 5K", tier: "special" },
];

const MODE_DEMOS: { key: string; title: string; eventType: EventType }[] = [
  { key: "inventory", title: "Bookable spaces", eventType: "picnic_party" },
  { key: "area", title: "Draw an area", eventType: "performance_rally" },
  { key: "streets", title: "Street segments", eventType: "block_party" },
  { key: "route", title: "Draw a route", eventType: "race_parade" },
];

function LocationDemo({ title, eventType }: { title: string; eventType: EventType }) {
  const [location, setLocation] = React.useState<Location | null>(null);
  return (
    <section className="flex flex-col gap-2 rounded-panel border border-line-subtle bg-surface-1 p-4">
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      <LocationPicker value={location} onChange={setLocation} eventType={eventType} />
      <p className="font-mono text-xs text-fg-secondary" data-testid={`location-result-${title}`}>
        {location ? JSON.stringify(location) : "No location selected yet."}
      </p>
    </section>
  );
}

/** Visual checkpoint for workstream 2C, rendered at /dev/map. Not linked from the app shell. */
export function MapDevScreen() {
  const [selectedHighlightId, setSelectedHighlightId] = React.useState<string | undefined>(undefined);
  // A day can be chosen on each calendar here, so the checkpoint shows the day buttons and the chosen day's ring.
  const [selectedDay, setSelectedDay] = React.useState<string>(TODAY);

  return (
    <main className="mx-auto flex max-w-(--container-page) flex-col gap-10 px-5 py-10">
      <header>
        <h1 className="text-h4 font-bold text-fg">Map and calendar dev checkpoint</h1>
        <p className="text-sm text-fg-secondary">
          LocationPicker in all four modes, PermitopolisMap with sample highlights (including an overlap),
          MapThumbnail, and the three calendar views. Not linked from the app shell.
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-fg">LocationPicker</h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {MODE_DEMOS.map((demo) => (
            <LocationDemo key={demo.key} title={demo.title} eventType={demo.eventType} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-fg">PermitopolisMap</h2>
        <PermitopolisMap highlights={SAMPLE_HIGHLIGHTS} selectedId={selectedHighlightId} onSelect={setSelectedHighlightId} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-fg">MapThumbnail</h2>
        <MapThumbnail highlight={SAMPLE_HIGHLIGHTS[0]} />
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-lg font-semibold text-fg">Calendar</h2>
        <MonthGrid items={SAMPLE_CALENDAR_ITEMS} today={TODAY} month={TODAY} onSelectDay={setSelectedDay} selected={selectedDay} />
        <WeekGrid items={SAMPLE_CALENDAR_ITEMS} today={TODAY} weekStart="2027-06-20" onSelectDay={setSelectedDay} selected={selectedDay} />
        <DayStrip items={SAMPLE_CALENDAR_ITEMS} today={TODAY} onSelectDay={setSelectedDay} selected={selectedDay} />
      </section>
    </main>
  );
}
