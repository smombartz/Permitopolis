/**
 * Permitopolis drawn as SVG. One shape per `lib/data/inventory.ts` space id, one path
 * per `lib/data/streets.ts` segment id, all inside a single ~1200 x 800 viewBox.
 *
 * Scale is 1 SVG unit = 1 foot, chosen so the full City Hall Plaza rectangle is exactly
 * 20,000 sq ft and the full Great Lawn rectangle is exactly 40,000 sq ft (matching
 * `lib/data/inventory.ts`'s `squareFeet`). `lib/view/map.ts` reads `SCALE_FT_PER_UNIT`.
 *
 * Owned by workstream 2C. No map library, no tiles.
 */

export const VIEWBOX = { x: 0, y: 0, width: 1200, height: 800 } as const;

/** 1 SVG unit = 1 foot. `rectToSquareFeet` in `lib/view/map.ts` multiplies by this. */
export const SCALE_FT_PER_UNIT = 1;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SpaceShape extends Rect {
  id: string;
}

export interface SegmentPath {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ZoneOutline extends Rect {
  id: string;
  label: string;
}

/** Background zones, drawn under the shapes and paths for visual context only. */
export const ZONE_OUTLINES: ZoneOutline[] = [
  { id: "riverside-park", label: "Riverside Park", x: 420, y: 600, w: 380, h: 190 },
  { id: "downtown", label: "Downtown", x: 10, y: 240, w: 290, h: 170 },
];

/** One rectangle per bookable or drawable space id in `lib/data/inventory.ts`. */
export const SPACE_SHAPES: Record<string, SpaceShape> = {
  "shelter-1": { id: "shelter-1", x: 440, y: 630, w: 50, h: 50 },
  "shelter-2": { id: "shelter-2", x: 510, y: 630, w: 50, h: 50 },
  "shelter-3": { id: "shelter-3", x: 580, y: 630, w: 50, h: 50 },
  "shelter-4": { id: "shelter-4", x: 650, y: 630, w: 50, h: 50 },
  "field-1": { id: "field-1", x: 440, y: 710, w: 70, h: 50 },
  "field-2": { id: "field-2", x: 520, y: 710, w: 70, h: 50 },
  "field-3": { id: "field-3", x: 600, y: 710, w: 70, h: 50 },
  "field-4": { id: "field-4", x: 680, y: 710, w: 70, h: 50 },
  /**
   * The full drawable rectangles. "Draw an area" clips a smaller rect inside these
   * (see `DRAWABLE_AREA_RECT`); the full rectangle itself is the 20,000 / 40,000 sq ft.
   */
  "city-hall-plaza": { id: "city-hall-plaza", x: 50, y: 270, w: 200, h: 100 },
  "great-lawn": { id: "great-lawn", x: 850, y: 580, w: 200, h: 200 },
};

/** One line per street segment id in `lib/data/streets.ts`. */
export const SEGMENT_PATHS: Record<string, SegmentPath> = {
  // Main Street, 1st to 6th Avenue: five blocks, node m1..m6.
  "main-1-2": { id: "main-1-2", x1: 150, y1: 400, x2: 330, y2: 400 },
  "main-2-3": { id: "main-2-3", x1: 330, y1: 400, x2: 510, y2: 400 },
  "main-3-4": { id: "main-3-4", x1: 510, y1: 400, x2: 690, y2: 400 },
  "main-4-5": { id: "main-4-5", x1: 690, y1: 400, x2: 870, y2: 400 },
  "main-5-6": { id: "main-5-6", x1: 870, y1: 400, x2: 1050, y2: 400 },
  // River Road: four stretches that close the loop from m6 back to m1 (City Hall Plaza).
  "river-a": { id: "river-a", x1: 1050, y1: 400, x2: 1050, y2: 580 },
  "river-b": { id: "river-b", x1: 1050, y1: 580, x2: 750, y2: 610 },
  "river-c": { id: "river-c", x1: 750, y1: 610, x2: 450, y2: 610 },
  "river-d": { id: "river-d", x1: 450, y1: 610, x2: 150, y2: 400 },
  // Maple Street, 300-500 blocks: residential, node p3..p6.
  "maple-300": { id: "maple-300", x1: 600, y1: 60, x2: 600, y2: 113 },
  "maple-400": { id: "maple-400", x1: 600, y1: 113, x2: 600, y2: 167 },
  "maple-500": { id: "maple-500", x1: 600, y1: 167, x2: 600, y2: 220 },
  // Elm Street, beside City Hall Plaza: residential, node e1..e3.
  "elm-100": { id: "elm-100", x1: 300, y1: 180, x2: 300, y2: 235 },
  "elm-200": { id: "elm-200", x1: 300, y1: 235, x2: 300, y2: 290 },
  // Oak Avenue: residential, node o1..o3.
  "oak-100": { id: "oak-100", x1: 1000, y1: 60, x2: 1000, y2: 113 },
  "oak-200": { id: "oak-200", x1: 1000, y1: 113, x2: 1000, y2: 166 },
};

function rectOf({ x, y, w, h }: Rect): Rect {
  return { x, y, w, h };
}

/** The full extent of each area a plan can draw inside. Same rect as `SPACE_SHAPES`. */
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
