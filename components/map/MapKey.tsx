import * as React from "react";
import { cn } from "@/lib/utils";

const BOX = "h-3.5 w-6 shrink-0 rounded-[2px] border";
const CENTERED = "flex w-6 shrink-0 justify-center";
const LETTER = "flex h-4 w-6 shrink-0 items-center justify-center rounded-[2px] border font-bold leading-none text-map-ink-muted";

/** What each color and mark on the city map stands for. The swatch is decoration; the name is the entry. */
const GROUPS: { title: string; entries: { name: string; swatch: React.ReactNode }[] }[] = [
  {
    title: "Land use",
    entries: [
      { name: "Residential", swatch: <span className={cn(BOX, "border-map-house-line bg-map-residential")} /> },
      { name: "Downtown", swatch: <span className={cn(BOX, "border-map-ink-downtown/40 bg-map-downtown")} /> },
      { name: "Civic and public services", swatch: <span className={cn(BOX, "border-map-landmark-line bg-map-civic")} /> },
      { name: "Parks and open space", swatch: <span className={cn(BOX, "border-map-field-line bg-map-park")} /> },
      { name: "Public works, parking", swatch: <span className={cn(BOX, "border-map-works-line bg-map-public-works")} /> },
      { name: "Water", swatch: <span className={cn(BOX, "border-map-ink-water/40 bg-map-water")} /> },
    ],
  },
  {
    title: "Places you can book or close",
    entries: [
      { name: "Shelter", swatch: <span className={cn(BOX, "border-map-shelter-line bg-map-shelter")} /> },
      { name: "Field", swatch: <span className={cn(BOX, "border-map-field-line bg-map-field")} /> },
      { name: "Plaza: draw an area", swatch: <span className={cn(BOX, "border-map-plaza-line bg-map-plaza")} /> },
      { name: "Lawn: draw an area", swatch: <span className={cn(BOX, "border-map-field-line bg-map-lawn")} /> },
      { name: "Main street", swatch: <span className="h-2 w-6 shrink-0 rounded-full bg-map-arterial" /> },
      { name: "Residential block", swatch: <span className="h-1.5 w-6 shrink-0 bg-map-block" /> },
      {
        name: "Household on the block",
        swatch: (
          <span className={CENTERED}>
            <span className="h-2 w-3 border border-map-house-line bg-map-house" />
          </span>
        ),
      },
    ],
  },
  {
    title: "Amenities",
    entries: [
      { name: "Public parking", swatch: <span className={cn(LETTER, "border-map-parking-line bg-map-parking text-[11px]")}>P</span> },
      { name: "Restrooms", swatch: <span className={cn(LETTER, "border-map-restroom-line bg-map-white text-[9px]")}>WC</span> },
      {
        name: "Power",
        swatch: (
          <span className={CENTERED}>
            <span className="size-2 rotate-45 border border-map-power-line bg-map-power" />
          </span>
        ),
      },
      {
        name: "Water tap",
        swatch: (
          <span className={CENTERED}>
            <span className="size-2 rounded-full bg-map-tap" />
          </span>
        ),
      },
      { name: "Trail or park path", swatch: <span className="h-0 w-6 shrink-0 border-t-2 border-dashed border-map-trail" /> },
      { name: "Stage", swatch: <span className={cn(BOX, "border-map-plaza-line bg-map-stage")} /> },
    ],
  },
];

/** The key to the city map, closed until asked for. Sits under a large map; a thumbnail has none. */
export function MapKey({ className }: { className?: string }) {
  return (
    <details data-slot="map-key" className={cn("rounded-panel border border-line-subtle bg-surface-1 p-3", className)}>
      <summary className="cursor-pointer text-sm font-semibold text-fg">Map key</summary>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {GROUPS.map((group) => (
          <div key={group.title} className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-fg-label">{group.title}</p>
            <ul aria-label={group.title} className="flex flex-col gap-1.5">
              {group.entries.map((entry) => (
                <li key={entry.name} className="flex items-center gap-2 text-xs text-fg-secondary">
                  <span aria-hidden="true" className="flex shrink-0 items-center">
                    {entry.swatch}
                  </span>
                  {entry.name}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
