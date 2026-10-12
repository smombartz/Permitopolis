"use client";

import * as React from "react";
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
 */
export function LocationPicker({ value, onChange, eventType, availabilityOf, className }: LocationPickerProps) {
  const [mode, setMode] = React.useState<LocationPickerMode>(
    () => modeOfLocation(value) ?? (eventType ? STARTING_MODE[eventType] : undefined) ?? "inventory",
  );

  const [inventoryIds, setInventoryIds] = React.useState<string[]>(value?.mode === "inventory" ? value.inventoryIds : []);
  const [streetIds, setStreetIds] = React.useState<string[]>(value?.mode === "streets" ? value.segmentIds : []);
  const [routeIds, setRouteIds] = React.useState<string[]>(value?.mode === "route" ? value.segmentIds : []);

  const [areaId, setAreaId] = React.useState<AreaId>(
    value?.mode === "area" && value.areaId ? value.areaId : "city-hall-plaza",
  );
  const [areaRect, setAreaRectState] = React.useState<Rect>(() =>
    value?.mode === "area" && value.areaRect ? value.areaRect : defaultAreaRect(areaId),
  );
  const [dragStart, setDragStart] = React.useState<{ x: number; y: number } | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const area = DRAWABLE_AREA_RECT[areaId];

  function selectInventory(id: string) {
    const next = toggleInventorySelection(inventoryIds, id);
    setInventoryIds(next);
    onChange(next.length > 0 ? buildInventoryLocation(next) : null);
  }

  function selectStreet(id: string) {
    const next = toggleStreetSelection(streetIds, id);
    setStreetIds(next);
    onChange(next.length > 0 ? buildStreetsLocation(next) : null);
  }

  function selectRouteSegment(id: string) {
    if (!canAppendSegment(routeIds, id)) return;
    const next = [...routeIds, id];
    setRouteIds(next);
    onChange(buildRouteLocation(next));
  }

  function undoLastSegment() {
    const next = routeIds.slice(0, -1);
    setRouteIds(next);
    onChange(next.length > 0 ? buildRouteLocation(next) : null);
  }

  function setAreaRect(nextRect: Rect, forArea: AreaId = areaId) {
    const clamped = clampRectToArea(nextRect, DRAWABLE_AREA_RECT[forArea]);
    setAreaRectState(clamped);
    onChange(buildAreaLocation(forArea, clamped));
  }

  function handleAreaIdChange(next: AreaId) {
    setAreaId(next);
    const rect = defaultAreaRect(next);
    setAreaRect(rect, next);
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

  function handleAreaPointerDown(event: React.PointerEvent<SVGRectElement>) {
    setDragStart(pointToSvg(event.clientX, event.clientY));
  }
  function handleAreaPointerMove(event: React.PointerEvent<SVGRectElement>) {
    if (!dragStart) return;
    const point = pointToSvg(event.clientX, event.clientY);
    setAreaRect({ x: dragStart.x, y: dragStart.y, w: point.x - dragStart.x, h: point.y - dragStart.y });
  }
  function handleAreaPointerUp() {
    setDragStart(null);
  }

  const currentAreaLocation = buildAreaLocation(areaId, areaRect);
  const routeLocation = buildRouteLocation(routeIds);

  return (
    <Tabs value={mode} onValueChange={(next) => setMode(next as LocationPickerMode)} className={cn("w-full", className)}>
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
        {(Object.keys(MODE_LABEL) as LocationPickerMode[]).map((key) => (
          <TabsTrigger key={key} value={key}>
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
                      selected && "border-indigo-650 bg-pill",
                    )}
                  >
                    <p className="font-medium text-fg">{space.name}</p>
                    <p className="text-xs text-fg-secondary">{`${fmtNumber(space.capacity ?? 0)} people · ${fmtMoney(space.rate.amount)}/${space.rate.per}`}</p>
                    <p className="text-xs text-fg-tertiary">{space.amenities.join(", ")}</p>
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
                  x={shape.x}
                  y={shape.y}
                  width={shape.w}
                  height={shape.h}
                  rx={4}
                  className={cn("cursor-pointer stroke-line-subtle", isActive ? "fill-surface-2" : "fill-surface-soft")}
                  strokeWidth={isActive ? 2 : 1}
                  onPointerDown={isActive ? handleAreaPointerDown : () => handleAreaIdChange(id)}
                  onPointerMove={isActive ? handleAreaPointerMove : undefined}
                  onPointerUp={isActive ? handleAreaPointerUp : undefined}
                />
              );
            })}
            <rect
              x={areaRect.x}
              y={areaRect.y}
              width={areaRect.w}
              height={areaRect.h}
              className="pointer-events-none fill-pill stroke-indigo-650"
              strokeWidth={2}
            />
          </svg>
          <div className="flex flex-1 flex-col gap-3 md:w-1/3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="location-picker-area">Area</Label>
              <Select value={areaId} onValueChange={(next) => handleAreaIdChange(next as AreaId)}>
                <SelectTrigger id="location-picker-area" className="w-full">
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
                <Label htmlFor="location-picker-width">Width (ft)</Label>
                <Input
                  id="location-picker-width"
                  type="number"
                  min={1}
                  max={area.w}
                  value={areaRect.w}
                  onChange={(event) => setAreaRect({ ...areaRect, w: Number(event.target.value) || 0 })}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="location-picker-length">Length (ft)</Label>
                <Input
                  id="location-picker-length"
                  type="number"
                  min={1}
                  max={area.h}
                  value={areaRect.h}
                  onChange={(event) => setAreaRect({ ...areaRect, h: Number(event.target.value) || 0 })}
                />
              </div>
            </div>
            <p className="text-sm text-fg-secondary">{`${fmtNumber(currentAreaLocation.squareFeet ?? 0)} sq ft · up to ${fmtNumber(currentAreaLocation.capacity ?? 0)} people at 10 sq ft a person`}</p>
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
                      "flex w-full items-center justify-between gap-2 rounded-control border border-line-subtle bg-surface-1 px-2 py-1.5 text-left text-sm hover:bg-surface-hover",
                      selected && "border-indigo-650 bg-pill",
                    )}
                  >
                    <span className="truncate text-fg-secondary">{segment.label}</span>
                    {segment.kind === "residential" && (
                      <Badge variant="outline" className="shrink-0">
                        Residential
                      </Badge>
                    )}
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
                        "flex w-full items-center gap-2 rounded-control border border-line-subtle bg-surface-1 px-2 py-1.5 text-left text-sm hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40",
                        included && "border-indigo-650 bg-pill",
                      )}
                    >
                      {included && (
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-650 text-xs font-semibold text-fg-on-accent">
                          {order + 1}
                        </span>
                      )}
                      <span className="truncate text-fg-secondary">{segment.label}</span>
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
