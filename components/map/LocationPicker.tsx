"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { fmtMoney, fmtNumber } from "@/lib/format";
import { bookableSpaces, getSpace } from "@/lib/data/inventory";
import { SEGMENTS } from "@/lib/data/streets";
import { DRAWABLE_AREA_RECT, VIEWBOX, segmentPath, spaceShape, type Rect } from "@/lib/data/mapGeometry";
import {
  buildAreaLocation,
  buildInventoryLocation,
  buildRouteLocation,
  buildStreetsLocation,
  canAppendSegment,
  clampRectToArea,
  toggleInventorySelection,
  toggleStreetSelection,
} from "@/lib/view/map";
import { CityBackground } from "./CityBackground";
import type { Availability, EventType, Location } from "@/lib/types";

export type LocationPickerMode = "inventory" | "area" | "streets" | "route";
export type AreaId = "city-hall-plaza" | "great-lawn";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

export interface LocationPickerProps {
  value: Location | null;
  onChange: (location: Location | null) => void;
  eventType?: EventType | null;
  availabilityOf?: (location: Location) => Availability | undefined;
  className?: string;
}

const MODE_LABEL: Record<LocationPickerMode, string> = {
  inventory: "Bookable spaces",
  area: "Draw an area",
  streets: "Street segments",
  route: "Draw a route",
};

const STARTING_MODE: Partial<Record<EventType, LocationPickerMode>> = {
  race_parade: "route",
  block_party: "streets",
  picnic_party: "inventory",
  class_meetup: "inventory",
  performance_rally: "area",
  market_festival: "area",
};

function modeOfLocation(location: Location | null): LocationPickerMode | null {
  if (!location) return null;
  if (location.mode === "inventory") return "inventory";
  if (location.mode === "area") return "area";
  if (location.mode === "route") return "route";
  return "streets";
}

function defaultAreaRect(areaId: AreaId): Rect {
  const area = DRAWABLE_AREA_RECT[areaId];
  return { x: area.x, y: area.y, w: Math.round(area.w / 2), h: Math.round(area.h / 2) };
}

/** What is chosen on each of the four tabs. */
interface Selections {
  inventoryIds: string[];
  streetIds: string[];
  routeIds: string[];
  areaId: AreaId;
  areaRect: Rect;
}

const NOTHING_CHOSEN: Selections = {
  inventoryIds: [],
  streetIds: [],
  routeIds: [],
  areaId: "city-hall-plaza",
  areaRect: defaultAreaRect("city-hall-plaza"),
};

/** The part of the selections a location stands for: its own tab's. */
function selectionsOf(location: Location | null): Partial<Selections> {
  if (!location) return {};
  if (location.mode === "inventory") return { inventoryIds: location.inventoryIds };
  if (location.mode === "streets") return { streetIds: location.segmentIds };
  if (location.mode === "route") return { routeIds: location.segmentIds };
  const areaId = location.areaId ?? NOTHING_CHOSEN.areaId;
  return { areaId, areaRect: location.areaRect ?? defaultAreaRect(areaId) };
}

/** The location a tab stands for, or null when nothing is chosen on it. An area always has its rectangle. */
function locationFor(mode: LocationPickerMode, selections: Selections): Location | null {
  switch (mode) {
    case "inventory":
      return selections.inventoryIds.length > 0 ? buildInventoryLocation(selections.inventoryIds) : null;
    case "streets":
      return selections.streetIds.length > 0 ? buildStreetsLocation(selections.streetIds) : null;
    case "route":
      return selections.routeIds.length > 0 ? buildRouteLocation(selections.routeIds) : null;
    case "area":
      return buildAreaLocation(selections.areaId, selections.areaRect);
  }
}

const STATUS_TEXT: Record<Availability["status"], string> = {
  open: "Open",
  impacted: "Impacted",
  booked: "Booked",
  blackout: "Blackout",
};
const STATUS_CLASS: Record<Availability["status"], string> = {
  open: "text-success-fg",
  impacted: "text-warning-fg",
  booked: "text-danger-fg",
  blackout: "text-danger-fg",
};

function AvailabilityNote({
  location,
  availabilityOf,
}: {
  location: Location;
  availabilityOf?: (location: Location) => Availability | undefined;
}) {
  const availability = availabilityOf?.(location);
  if (!availability) return null;
  return (
    <p className={cn("text-xs font-medium", STATUS_CLASS[availability.status])}>
      {availability.reason ? `${STATUS_TEXT[availability.status]}: ${availability.reason}` : STATUS_TEXT[availability.status]}
    </p>
  );
}

/**
 * Four ways to describe where an event happens. Every selection is available from the
 * keyboard-operable list beside the map; clicking the map shapes does the same thing.
 * The map itself is decorative (`aria-hidden`): the list is the accessible path.
 *
 * Controlled: what is pressed, drawn or numbered is read from `value`, so a Draft that arrives
 * after the first render, or changes from outside, is what the picker shows. Switching tabs
 * hands over that tab's own selection through `onChange` (null when it has none), so the tab in
 * view and the value never disagree. Each tab remembers what was last chosen on it.
 */
export function LocationPicker({ value, onChange, eventType, availabilityOf, className }: LocationPickerProps) {
  // Unique per picker: two on one page (the dev page shows several) must not share field ids.
  const fieldId = React.useId();
  // The tab in view while nothing is chosen. With a value, the tab is the value's own.
  const [emptyMode, setEmptyMode] = React.useState<LocationPickerMode>(
    () => (eventType ? STARTING_MODE[eventType] : undefined) ?? "inventory",
  );
  const mode = modeOfLocation(value) ?? emptyMode;

  // What the other tabs held when the applicant left them, with the value's own tab on top.
  const [remembered, setRemembered] = React.useState<Selections>(NOTHING_CHOSEN);
  const selections: Selections = { ...remembered, ...selectionsOf(value) };

  const inventoryIds = value?.mode === "inventory" ? value.inventoryIds : NOTHING_CHOSEN.inventoryIds;
  const streetIds = value?.mode === "streets" ? value.segmentIds : NOTHING_CHOSEN.streetIds;
  const routeIds = value?.mode === "route" ? value.segmentIds : NOTHING_CHOSEN.routeIds;
  const { areaId, areaRect } = selections;

  const [dragStart, setDragStart] = React.useState<{ x: number; y: number } | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const area = DRAWABLE_AREA_RECT[areaId];

  /** Every change goes out the same way: remember it, stay on its tab, and emit that tab's location. */
  function choose(nextMode: LocationPickerMode, change: Partial<Selections> = {}) {
    const next = { ...selections, ...change };
    setRemembered(next);
    setEmptyMode(nextMode);
    onChange(locationFor(nextMode, next));
  }

  function selectInventory(id: string) {
    choose("inventory", { inventoryIds: toggleInventorySelection(inventoryIds, id) });
  }

  function selectStreet(id: string) {
    choose("streets", { streetIds: toggleStreetSelection(streetIds, id) });
  }

  function selectRouteSegment(id: string) {
    if (!canAppendSegment(routeIds, id)) return;
    choose("route", { routeIds: [...routeIds, id] });
  }

  function undoLastSegment() {
    choose("route", { routeIds: routeIds.slice(0, -1) });
  }

  function setAreaRect(nextRect: Rect, forArea: AreaId = areaId) {
    choose("area", { areaId: forArea, areaRect: clampRectToArea(nextRect, DRAWABLE_AREA_RECT[forArea]) });
  }

  function handleAreaIdChange(next: AreaId) {
    setAreaRect(defaultAreaRect(next), next);
  }

  function pointToSvg(clientX: number, clientY: number): { x: number; y: number } {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) / rect.width) * VIEWBOX.width,
      y: ((clientY - rect.top) / rect.height) * VIEWBOX.height,
    };
  }

  // Pointer capture keeps the drag live even when the pointer leaves the rectangle
  // mid-drag, and pointerup/pointercancel both end it, so releasing outside the
  // shape (or an interrupted gesture) never leaves the drag stuck on.
  function handleAreaPointerDown(event: React.PointerEvent<SVGRectElement>) {
    // Optional chaining: jsdom (render tests) and some older browsers don't implement
    // pointer capture, so the drag still works there, just without the capture guarantee.
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragStart(pointToSvg(event.clientX, event.clientY));
  }
  function handleAreaPointerMove(event: React.PointerEvent<SVGRectElement>) {
    if (!dragStart) return;
    const point = pointToSvg(event.clientX, event.clientY);
    setAreaRect({ x: dragStart.x, y: dragStart.y, w: point.x - dragStart.x, h: point.y - dragStart.y });
  }
  function handleAreaPointerEnd(event: React.PointerEvent<SVGRectElement>) {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    setDragStart(null);
  }

  const currentAreaLocation = buildAreaLocation(areaId, areaRect);
  // A picker that opens on this tab with no value shows a starting rectangle. It is only a
  // suggestion until the applicant drags or sizes it, and it is drawn and described as one.
  const areaChosen = value?.mode === "area";
  const routeLocation = buildRouteLocation(routeIds);

  return (
    <Tabs value={mode} onValueChange={(next) => choose(next as LocationPickerMode)} className={cn("w-full", className)}>
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
        {(Object.keys(MODE_LABEL) as LocationPickerMode[]).map((key) => (
          // The list wraps (h-auto), so a tab's height is its own: 36px, and 44px on a touch screen.
          <TabsTrigger key={key} value={key} className="min-h-9 pointer-coarse:min-h-11">
            {MODE_LABEL[key]}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* ---------- Bookable spaces ---------- */}
      <TabsContent value="inventory" className="mt-3">
        <div className="flex flex-col gap-4 md:flex-row">
          <svg
            viewBox={`${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.width} ${VIEWBOX.height}`}
            aria-hidden="true"
            className="w-full flex-1 rounded-panel border border-line-subtle bg-surface-1 md:w-2/3"
          >
            <CityBackground />
            {bookableSpaces().map((space) => {
              const shape = spaceShape(space.id);
              if (!shape) return null;
              const selected = inventoryIds.includes(space.id);
              return (
                <rect
                  key={space.id}
                  x={shape.x}
                  y={shape.y}
                  width={shape.w}
                  height={shape.h}
                  rx={4}
                  className={cn("cursor-pointer stroke-line-subtle", selected ? "fill-pill stroke-indigo-650" : "fill-surface-2")}
                  strokeWidth={selected ? 3 : 1}
                  onClick={() => selectInventory(space.id)}
                />
              );
            })}
          </svg>
          <ul className="flex flex-1 flex-col gap-2 md:w-1/3" aria-label="Bookable spaces">
            {bookableSpaces().map((space) => {
              const selected = inventoryIds.includes(space.id);
              return (
                <li key={space.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => selectInventory(space.id)}
                    className={cn(
                      "w-full rounded-panel border border-line-subtle bg-surface-1 p-2 text-left text-sm hover:bg-surface-hover",
                      FOCUS_RING,
                      selected && "border-indigo-650 bg-pill",
                    )}
                  >
                    <p className="flex items-start justify-between gap-2 font-medium text-fg">
                      {space.name}
                      {/* The choice is a mark as well as a tint. */}
                      {selected ? <CheckIcon className="mt-0.5 size-4 shrink-0 text-fg-accent" aria-hidden="true" /> : null}
                    </p>
                    <p className="text-xs text-fg-secondary">{`${fmtNumber(space.capacity ?? 0)} people · ${fmtMoney(space.rate.amount)}/${space.rate.per}`}</p>
                    <p className="text-xs text-fg-secondary">{space.amenities.join(", ")}</p>
                    <AvailabilityNote location={buildInventoryLocation([space.id])} availabilityOf={availabilityOf} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </TabsContent>

      {/* ---------- Draw an area ---------- */}
      <TabsContent value="area" className="mt-3">
        <div className="flex flex-col gap-4 md:flex-row">
          <svg
            ref={svgRef}
            viewBox={`${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.width} ${VIEWBOX.height}`}
            aria-hidden="true"
            className="w-full flex-1 touch-none rounded-panel border border-line-subtle bg-surface-1 md:w-2/3"
          >
            <CityBackground />
            {(["city-hall-plaza", "great-lawn"] as AreaId[]).map((id) => {
              const shape = DRAWABLE_AREA_RECT[id];
              const isActive = id === areaId;
              return (
                <rect
                  key={id}
                  data-testid={isActive ? "area-active-rect" : undefined}
                  x={shape.x}
                  y={shape.y}
                  width={shape.w}
                  height={shape.h}
                  rx={4}
                  className={cn("cursor-pointer stroke-line-subtle", isActive ? "fill-surface-2" : "fill-surface-soft")}
                  strokeWidth={isActive ? 2 : 1}
                  onPointerDown={isActive ? handleAreaPointerDown : () => handleAreaIdChange(id)}
                  onPointerMove={isActive ? handleAreaPointerMove : undefined}
                  onPointerUp={isActive ? handleAreaPointerEnd : undefined}
                  onPointerCancel={isActive ? handleAreaPointerEnd : undefined}
                />
              );
            })}
            <rect
              x={areaRect.x}
              y={areaRect.y}
              width={areaRect.w}
              height={areaRect.h}
              className={cn("pointer-events-none stroke-indigo-650", areaChosen ? "fill-pill" : "fill-none")}
              strokeWidth={2}
              strokeDasharray={areaChosen ? undefined : "8 6"}
            />
          </svg>
          <div className="flex flex-1 flex-col gap-3 md:w-1/3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-area`}>Area</Label>
              <Select value={areaId} onValueChange={(next) => handleAreaIdChange(next as AreaId)}>
                <SelectTrigger id={`${fieldId}-area`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="city-hall-plaza">{getSpace("city-hall-plaza")?.name ?? "City Hall Plaza"}</SelectItem>
                  <SelectItem value="great-lawn">{getSpace("great-lawn")?.name ?? "Great Lawn"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor={`${fieldId}-width`}>Width (ft)</Label>
                <Input
                  id={`${fieldId}-width`}
                  type="number"
                  min={1}
                  max={area.w}
                  value={areaRect.w}
                  onChange={(event) => setAreaRect({ ...areaRect, w: Number(event.target.value) || 0 })}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor={`${fieldId}-length`}>Length (ft)</Label>
                <Input
                  id={`${fieldId}-length`}
                  type="number"
                  min={1}
                  max={area.h}
                  value={areaRect.h}
                  onChange={(event) => setAreaRect({ ...areaRect, h: Number(event.target.value) || 0 })}
                />
              </div>
            </div>
            {areaChosen ? (
              <p className="text-sm text-fg-secondary">{`${fmtNumber(currentAreaLocation.squareFeet ?? 0)} sq ft · up to ${fmtNumber(currentAreaLocation.capacity ?? 0)} people at 10 sq ft a person`}</p>
            ) : (
              <p className="text-sm text-fg-secondary">No area chosen yet. Drag on the map, or set a width and length.</p>
            )}
            <AvailabilityNote location={currentAreaLocation} availabilityOf={availabilityOf} />
          </div>
        </div>
      </TabsContent>

      {/* ---------- Street segments ---------- */}
      <TabsContent value="streets" className="mt-3">
        <div className="flex flex-col gap-4 md:flex-row">
          <svg
            viewBox={`${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.width} ${VIEWBOX.height}`}
            aria-hidden="true"
            className="w-full flex-1 rounded-panel border border-line-subtle bg-surface-1 md:w-2/3"
          >
            <CityBackground />
            {SEGMENTS.map((segment) => {
              const path = segmentPath(segment.id);
              if (!path) return null;
              const selected = streetIds.includes(segment.id);
              return (
                <line
                  key={segment.id}
                  x1={path.x1}
                  y1={path.y1}
                  x2={path.x2}
                  y2={path.y2}
                  strokeLinecap="round"
                  className={cn("cursor-pointer", selected ? "stroke-indigo-650" : "stroke-line-magnetic")}
                  strokeWidth={selected ? 12 : 10}
                  onClick={() => selectStreet(segment.id)}
                />
              );
            })}
          </svg>
          <ul className="flex flex-1 flex-col gap-1.5 md:w-1/3" aria-label="Street segments">
            {SEGMENTS.map((segment) => {
              const selected = streetIds.includes(segment.id);
              return (
                <li key={segment.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => selectStreet(segment.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-control border border-line-subtle bg-surface-1 px-2 py-1.5 text-left text-sm hover:bg-surface-hover pointer-coarse:min-h-11",
                      FOCUS_RING,
                      selected && "border-indigo-650 bg-pill",
                    )}
                  >
                    {/* The whole name, on as many lines as it takes: the column is a third of the row. */}
                    <span className="min-w-0 break-words text-fg-secondary">{segment.label}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {segment.kind === "residential" && <Badge variant="outline">Residential</Badge>}
                      {selected ? <CheckIcon className="size-4 text-fg-accent" aria-hidden="true" /> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </TabsContent>

      {/* ---------- Draw a route ---------- */}
      <TabsContent value="route" className="mt-3">
        <div className="flex flex-col gap-4 md:flex-row">
          <svg
            viewBox={`${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.width} ${VIEWBOX.height}`}
            aria-hidden="true"
            className="w-full flex-1 rounded-panel border border-line-subtle bg-surface-1 md:w-2/3"
          >
            <CityBackground />
            {SEGMENTS.map((segment) => {
              const path = segmentPath(segment.id);
              if (!path) return null;
              const included = routeIds.includes(segment.id);
              const appendable = !included && canAppendSegment(routeIds, segment.id);
              return (
                <line
                  key={segment.id}
                  x1={path.x1}
                  y1={path.y1}
                  x2={path.x2}
                  y2={path.y2}
                  strokeLinecap="round"
                  className={cn(
                    included
                      ? "cursor-pointer stroke-indigo-650"
                      : appendable
                        ? "cursor-pointer stroke-line-magnetic"
                        : "stroke-line-subtle",
                  )}
                  strokeWidth={included ? 12 : 10}
                  onClick={() => (!included && appendable ? selectRouteSegment(segment.id) : undefined)}
                />
              );
            })}
          </svg>
          <div className="flex flex-1 flex-col gap-2 md:w-1/3">
            <ul aria-label="Route segments, in order" className="flex flex-col gap-1.5">
              {SEGMENTS.map((segment) => {
                const order = routeIds.indexOf(segment.id);
                const included = order >= 0;
                const canSelect = included || canAppendSegment(routeIds, segment.id);
                return (
                  <li key={segment.id}>
                    <button
                      type="button"
                      aria-pressed={included}
                      disabled={!canSelect}
                      onClick={() => (included ? undefined : selectRouteSegment(segment.id))}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-control border border-line-subtle bg-surface-1 px-2 py-1.5 text-left text-sm hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:min-h-11",
                        FOCUS_RING,
                        included && "border-indigo-650 bg-pill",
                      )}
                    >
                      {included && (
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-650 text-xs font-semibold text-fg-on-accent">
                          <span className="sr-only">Number </span>
                          {order + 1}
                          <span className="sr-only"> on the route: </span>
                        </span>
                      )}
                      <span className="min-w-0 break-words text-fg-secondary">{segment.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-fg-secondary">{fmtNumber(routeLocation.miles ?? 0)} miles</p>
              <Button type="button" variant="secondary" size="sm" onClick={undoLastSegment} disabled={routeIds.length === 0}>
                Undo last segment
              </Button>
            </div>
            {routeIds.length > 0 && <AvailabilityNote location={routeLocation} availabilityOf={availabilityOf} />}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
