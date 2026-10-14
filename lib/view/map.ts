/**
 * Pure view-model for the Permitopolis map. No React, no store, no rules engine:
 * only `lib/types.ts`, `lib/data/{inventory,streets}.ts` and the geometry in
 * `lib/data/mapGeometry.ts`. Covered by `lib/view/map.test.ts`.
 *
 * Owned by workstream 2C (`components/map`, `components/calendar`).
 */
import { DRAWABLE_AREA_RECT, SCALE_FT_PER_UNIT, VIEWBOX, segmentPath, spaceShape, type Rect } from "@/lib/data/mapGeometry";
import { getSpace, type Space } from "@/lib/data/inventory";
import { areConnected, getSegment, milesOf, type StreetSegment } from "@/lib/data/streets";
import { DEFAULT_CONFIG } from "@/lib/rules/config";
import { fmtMiles, fmtNumber } from "@/lib/format";
import type { Location } from "@/lib/types";

export type { Rect };

/* ---------- area geometry ---------- */

/** Square feet of a rectangle given in SVG viewBox units. */
export function rectToSquareFeet(rect: { w: number; h: number }, scaleFtPerUnit: number = SCALE_FT_PER_UNIT): number {
  const widthFt = rect.w * scaleFtPerUnit;
  const heightFt = rect.h * scaleFtPerUnit;
  return Math.round(widthFt * heightFt);
}

/** Square feet divided by sqFtPerPerson, capped at the space's maxPeople when given. */
export function capacityForArea(squareFeet: number, sqFtPerPerson: number, maxPeople?: number): number {
  const raw = Math.max(0, Math.floor(squareFeet / sqFtPerPerson));
  return maxPeople === undefined ? raw : Math.min(raw, maxPeople);
}

/**
 * Clamps a dragged (or typed) rectangle so it stays fully inside `area`, normalizing a
 * negative width or height from dragging in any direction and never exceeding the area's
 * own size.
 */
export function clampRectToArea(rect: Rect, area: Rect): Rect {
  const x0 = Math.min(rect.x, rect.x + rect.w);
  const y0 = Math.min(rect.y, rect.y + rect.h);
  const w = Math.min(Math.abs(rect.w), area.w);
  const h = Math.min(Math.abs(rect.h), area.h);
  const x = Math.min(Math.max(x0, area.x), area.x + area.w - w);
  const y = Math.min(Math.max(y0, area.y), area.y + area.h - h);
  return { x, y, w, h };
}

/* ---------- thumbnail framing ---------- */

/** Room left around the place, in viewBox units, so its neighbours show. */
const FRAME_PADDING = 40;
/** The closest a thumbnail zooms: about one block across. */
const FRAME_MIN_WIDTH = 320;
/** Past this width a thumbnail's street and place names are too small to read, so they are left off. */
const FRAME_MAX_WIDTH_WITH_LABELS = 480;

export interface MapFrame {
  /** The part of the city to show, in viewBox units, always in the map's own proportions. */
  box: Rect;
  showLabels: boolean;
}

const WHOLE_CITY: Rect = { x: VIEWBOX.x, y: VIEWBOX.y, w: VIEWBOX.width, h: VIEWBOX.height };

/** The box around everything a Location occupies on the map, or undefined when it occupies nothing known. */
function locationBox(location: Location): Rect | undefined {
  const boxes: (Rect | undefined)[] =
    location.mode === "inventory"
      ? location.inventoryIds.map((id) => spaceShape(id))
      : location.mode === "area"
        ? [location.areaRect ?? (location.areaId ? spaceShape(location.areaId) : undefined)]
        : location.segmentIds.map((id) => segmentPath(id)?.box);
  const known = boxes.filter((box): box is Rect => box !== undefined);
  if (known.length === 0) return undefined;
  const left = Math.min(...known.map((box) => box.x));
  const top = Math.min(...known.map((box) => box.y));
  const right = Math.max(...known.map((box) => box.x + box.w));
  const bottom = Math.max(...known.map((box) => box.y + box.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/**
 * The part of the map a thumbnail shows for a Location: the place with some room around it,
 * never closer than about a block, in the map's proportions, and never past the map's edge.
 * A place that fills most of the city gets the whole city.
 */
export function thumbnailFrame(location: Location): MapFrame {
  const place = locationBox(location);
  if (!place) return { box: WHOLE_CITY, showLabels: false };

  const aspect = VIEWBOX.width / VIEWBOX.height;
  let w = Math.max(place.w + 2 * FRAME_PADDING, FRAME_MIN_WIDTH);
  let h = Math.max(place.h + 2 * FRAME_PADDING, FRAME_MIN_WIDTH / aspect);
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  if (w >= VIEWBOX.width) return { box: WHOLE_CITY, showLabels: false };

  const centerX = place.x + place.w / 2;
  const centerY = place.y + place.h / 2;
  const x = Math.min(Math.max(centerX - w / 2, VIEWBOX.x), VIEWBOX.x + VIEWBOX.width - w);
  const y = Math.min(Math.max(centerY - h / 2, VIEWBOX.y), VIEWBOX.y + VIEWBOX.height - h);
  const round = (value: number) => Math.round(value * 10) / 10;
  return { box: { x: round(x), y: round(y), w: round(w), h: round(h) }, showLabels: w <= FRAME_MAX_WIDTH_WITH_LABELS };
}

/* ---------- routes ---------- */

/** True when every consecutive pair of segments shares a node (or there are 0 or 1). */
export function isConnectedRoute(segmentIds: string[]): boolean {
  for (let i = 1; i < segmentIds.length; i++) {
    if (!areConnected(segmentIds[i - 1], segmentIds[i])) return false;
  }
  return true;
}

/**
 * Can `candidateId` be appended to an in-progress route? No repeats, and it must connect
 * to the last segment already on the route (any segment may start a route).
 */
export function canAppendSegment(routeSegmentIds: string[], candidateId: string): boolean {
  if (routeSegmentIds.includes(candidateId)) return false;
  if (routeSegmentIds.length === 0) return true;
  return areConnected(routeSegmentIds[routeSegmentIds.length - 1], candidateId);
}

/** Total miles of a set of segments, rounded to hundredths. Alias of `milesOf`. */
export function routeMiles(segmentIds: string[]): number {
  return milesOf(segmentIds);
}

/**
 * Plain-language label for a set of street segments.
 * `["main-1-2","main-2-3","main-3-4"]` reads "Main Street, 1st to 4th Avenue"; a single
 * residential block reads "400 block of Maple Street" (its own label, unchanged).
 */
export function mergeStreetLabel(segmentIds: string[]): string {
  const segments = segmentIds.map((id) => getSegment(id)).filter((s): s is StreetSegment => s !== undefined);
  if (segments.length === 0) return "";

  const groups: StreetSegment[][] = [];
  for (const segment of segments) {
    const group = groups[groups.length - 1];
    const previous = group?.[group.length - 1];
    if (previous && previous.street === segment.street && previous.kind === "arterial" && areConnected(previous.id, segment.id)) {
      group.push(segment);
    } else {
      groups.push([segment]);
    }
  }
  return groups.map(mergeContiguousGroup).join(", ");
}

function mergeContiguousGroup(segments: StreetSegment[]): string {
  if (segments.length === 1) return segments[0].label;
  const first = segments[0];
  const last = segments[segments.length - 1];
  const from = first.label.match(/, (.+?) to /)?.[1] ?? first.label;
  const to = last.label.match(/ to (.+)$/)?.[1] ?? last.label;
  return `${first.street}, ${from} to ${to}`;
}

function uniqueStreetNames(segmentIds: string[]): string[] {
  const names: string[] = [];
  for (const id of segmentIds) {
    const segment = getSegment(id);
    if (segment && !names.includes(segment.street)) names.push(segment.street);
  }
  return names;
}

function joinWithAnd(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/* ---------- Location builders, one per mode ---------- */

function inventoryLabel(spaces: Space[]): string {
  if (spaces.length === 0) return "";
  if (spaces.length === 1) return spaces[0].label;
  const kindWord = spaces[0].kind === "shelter" ? "Shelters" : spaces[0].kind === "field" ? "Fields" : "Spaces";
  const numbers = spaces.map((s) => s.name.replace(/^\D+/, ""));
  const zone = spaces[0].label.split(", ").slice(1).join(", ");
  const joined = joinWithAnd(numbers);
  return zone ? `${kindWord} ${joined}, ${zone}` : `${kindWord} ${joined}`;
}

/** The "Bookable spaces" mode: one or more shelters, or one or more fields. */
export function buildInventoryLocation(inventoryIds: string[]): Location {
  const spaces = inventoryIds.map((id) => getSpace(id)).filter((s): s is Space => s !== undefined);
  const capacity = spaces.length > 0 ? spaces.reduce((sum, s) => sum + (s.capacity ?? 0), 0) : undefined;
  return {
    mode: "inventory",
    inventoryIds,
    segmentIds: [],
    capacity,
    label: inventoryLabel(spaces),
  };
}

/** The "Draw an area" mode: a rectangle clamped inside City Hall Plaza or the Great Lawn. */
export function buildAreaLocation(
  areaId: "city-hall-plaza" | "great-lawn",
  rect: Rect,
  sqFtPerPerson: number = DEFAULT_CONFIG.thresholds.sqFtPerPerson,
): Location {
  const area = DRAWABLE_AREA_RECT[areaId];
  const areaRect = clampRectToArea(rect, area);
  const squareFeet = rectToSquareFeet(areaRect);
  const space = getSpace(areaId);
  const capacity = capacityForArea(squareFeet, sqFtPerPerson, space?.maxPeople);
  const label = `${fmtNumber(squareFeet)} sq ft in ${space?.name ?? areaId}`;
  return {
    mode: "area",
    inventoryIds: [],
    areaId,
    areaRect,
    segmentIds: [],
    capacity,
    squareFeet,
    label,
  };
}

/** The "Street segments" mode: any set of blocks, not necessarily connected or ordered. */
export function buildStreetsLocation(segmentIds: string[]): Location {
  return {
    mode: "streets",
    inventoryIds: [],
    segmentIds,
    miles: segmentIds.length > 0 ? routeMiles(segmentIds) : undefined,
    label: mergeStreetLabel(segmentIds),
  };
}

/** The "Draw a route" mode: an ordered, connected chain of segments. */
export function buildRouteLocation(segmentIds: string[]): Location {
  const miles = segmentIds.length > 0 ? routeMiles(segmentIds) : undefined;
  const streets = uniqueStreetNames(segmentIds);
  const label = segmentIds.length === 0 ? "" : `${fmtMiles(miles ?? 0)} route via ${joinWithAnd(streets)}`;
  return {
    mode: "route",
    inventoryIds: [],
    segmentIds,
    miles,
    label,
  };
}

/* ---------- small helpers surfaces use ---------- */

export function toggleInventorySelection(current: string[], id: string): string[] {
  if (current.includes(id)) return current.filter((x) => x !== id);
  if (current.length === 0) return [id];
  const currentKind = getSpace(current[0])?.kind;
  const nextKind = getSpace(id)?.kind;
  return currentKind === nextKind ? [...current, id] : [id];
}

export function toggleStreetSelection(current: string[], id: string): string[] {
  return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
}
