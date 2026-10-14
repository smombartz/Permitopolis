/**
 * Resolves a `Location` to the concrete shapes `lib/data/mapGeometry.ts` has for it, so
 * `PermitopolisMap`, `MapThumbnail` and `LocationPicker` all draw the same way.
 */
import { segmentPath, spaceShape, type Point, type Rect, type SegmentPath } from "@/lib/data/mapGeometry";
import type { Location } from "@/lib/types";

export type ResolvedShape = { id: string; kind: "rect"; rect: Rect } | { id: string; kind: "path"; path: SegmentPath };

/** The rect(s) or street path(s) a Location draws on the map. Unknown ids are skipped. */
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
    .filter((path): path is SegmentPath => path !== undefined)
    .map((path) => ({ id: path.id, kind: "path" as const, path }));
}

/** The `id`s a Location occupies, used to find overlaps between several highlights. */
export function occupiedIds(location: Location): string[] {
  if (location.mode === "inventory") return location.inventoryIds;
  if (location.mode === "area") return location.areaId ? [location.areaId] : [];
  return location.segmentIds;
}

/** Where a shape's label sits: just above a rectangle, or above the middle of a street. */
export function labelAnchor(shape: ResolvedShape): Point {
  return shape.kind === "rect"
    ? { x: shape.rect.x + shape.rect.w / 2, y: shape.rect.y - 10 }
    : { x: shape.path.mid.x, y: shape.path.mid.y - 18 };
}
