/**
 * Where everything is on the Permitopolis map: one rectangle per `lib/data/inventory.ts` space id
 * and one path per `lib/data/streets.ts` segment id, inside a single 1600 x 1000 viewBox.
 *
 * The numbers are not written here. They are read from the drawing,
 * `design/map/permitopolis-map.svg`, by `pnpm map:sync` into `mapGeometry.generated.ts`; this
 * file gives them their types and the lookups the app uses.
 *
 * Scale is 1 SVG unit = 1 foot, chosen so the full City Hall Plaza rectangle is exactly
 * 20,000 sq ft and the full Great Lawn rectangle is exactly 40,000 sq ft (matching
 * `lib/data/inventory.ts`'s `squareFeet`). `lib/view/map.ts` reads `SCALE_FT_PER_UNIT`.
 *
 * No map library, no tiles.
 */
import { GENERATED_NODES, GENERATED_SEGMENTS, GENERATED_SPACES, GENERATED_VIEWBOX } from "./mapGeometry.generated";

export const VIEWBOX: { x: number; y: number; width: number; height: number } = GENERATED_VIEWBOX;

/** 1 SVG unit = 1 foot. `rectToSquareFeet` in `lib/view/map.ts` multiplies by this. */
export const SCALE_FT_PER_UNIT = 1;

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SpaceShape extends Rect {
  id: string;
  /** What the drawing says the space holds, checked against `lib/data/inventory.ts` by a test. */
  capacity?: number;
  squareFeet?: number;
}

export interface SegmentPath {
  id: string;
  /** The SVG path as drawn, curves included. */
  d: string;
  /** The point halfway along the path: where a label goes. */
  mid: Point;
  /** The box around the path. A straight street has no height or no width. */
  box: Rect;
  /** What the drawing says about the segment, checked against `lib/data/streets.ts` by a test. */
  nodes: string[];
  miles?: number;
  households?: number;
}

/** One rectangle per bookable or drawable space id in `lib/data/inventory.ts`. */
export const SPACE_SHAPES: Record<string, SpaceShape> = GENERATED_SPACES;

/** One path per street segment id in `lib/data/streets.ts`. */
export const SEGMENT_PATHS: Record<string, SegmentPath> = GENERATED_SEGMENTS;

/** Where segments meet, by the node names in `lib/data/streets.ts`. */
export const NODE_POINTS: Record<string, Point> = GENERATED_NODES;

function rectOf({ x, y, w, h }: Rect): Rect {
  return { x, y, w, h };
}

/**
 * The full extent of each area a plan can draw inside. "Draw an area" clips a smaller rect
 * inside these; the full rectangle itself is the 20,000 / 40,000 sq ft.
 */
export const DRAWABLE_AREA_RECT: Record<"city-hall-plaza" | "great-lawn", Rect> = {
  "city-hall-plaza": rectOf(SPACE_SHAPES["city-hall-plaza"]),
  "great-lawn": rectOf(SPACE_SHAPES["great-lawn"]),
};

export function spaceShape(id: string): SpaceShape | undefined {
  return SPACE_SHAPES[id];
}

export function segmentPath(id: string): SegmentPath | undefined {
  return SEGMENT_PATHS[id];
}
