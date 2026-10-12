/**
 * Resolves a `Location` to the concrete shapes `lib/data/mapGeometry.ts` has for it, so
 * `PermitopolisMap`, `MapThumbnail` and `LocationPicker` all draw the same way.
 */
import { segmentPath, spaceShape, type Rect, type SegmentPath } from "@/lib/data/mapGeometry";
import type { Location } from "@/lib/types";

export type ResolvedShape = { id: string; kind: "rect"; rect: Rect } | { id: string; kind: "line"; line: SegmentPath };

/** The rect(s) or line(s) a Location draws on the map. Unknown ids are skipped. */
export function resolveLocationShapes(location: Location): ResolvedShape[] {
  if (location.mode === "inventory") {
    return location.inventoryIds
      .map((id) => spaceShape(id))
      .filter((rect): rect is Rect & { id: string } => rect !== undefined)
      .map((rect) => ({ id: rect.id, kind: "rect" as const, rect }));
  }
  if (location.mode === "area") {
    const rect = location.areaRect ?? (location.areaId ? spaceShape(location.areaId) : undefined);
    return rect ? [{ id: location.areaId ?? "area", kind: "rect" as const, rect }] : [];
  }
  // 'streets' and 'route'
  return location.segmentIds
    .map((id) => segmentPath(id))
    .filter((line): line is SegmentPath => line !== undefined)
    .map((line) => ({ id: line.id, kind: "line" as const, line }));
}

/** The `id`s a Location occupies, used to find overlaps between several highlights. */
export function occupiedIds(location: Location): string[] {
  if (location.mode === "inventory") return location.inventoryIds;
  if (location.mode === "area") return location.areaId ? [location.areaId] : [];
  return location.segmentIds;
}

export function rectCenter(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

export function lineMidpoint(line: SegmentPath): { x: number; y: number } {
  return { x: (line.x1 + line.x2) / 2, y: (line.y1 + line.y2) / 2 };
}
