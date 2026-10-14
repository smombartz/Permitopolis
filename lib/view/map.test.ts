import { describe, expect, it } from "vitest";
import { DRAWABLE_AREA_RECT, SEGMENT_PATHS, SPACE_SHAPES, VIEWBOX } from "@/lib/data/mapGeometry";
import { SPACES } from "@/lib/data/inventory";
import { RIVERFRONT_5K_ROUTE, SEGMENTS } from "@/lib/data/streets";
import {
  buildAreaLocation,
  buildInventoryLocation,
  buildRouteLocation,
  buildStreetsLocation,
  canAppendSegment,
  capacityForArea,
  clampRectToArea,
  isConnectedRoute,
  mergeStreetLabel,
  rectToSquareFeet,
  thumbnailFrame,
  routeMiles,
  toggleInventorySelection,
  toggleStreetSelection,
} from "./map";

describe("mapGeometry completeness", () => {
  it("has one shape for every inventory space", () => {
    for (const space of SPACES) {
      expect(SPACE_SHAPES[space.id], `missing shape for ${space.id}`).toBeDefined();
    }
  });

  it("has one path for every street segment", () => {
    for (const segment of SEGMENTS) {
      expect(SEGMENT_PATHS[segment.id], `missing path for ${segment.id}`).toBeDefined();
    }
  });
});

describe("rectToSquareFeet", () => {
  it("the full City Hall Plaza rectangle is 20,000 sq ft", () => {
    expect(rectToSquareFeet(DRAWABLE_AREA_RECT["city-hall-plaza"])).toBe(20000);
  });

  it("the full Great Lawn rectangle is 40,000 sq ft", () => {
    expect(rectToSquareFeet(DRAWABLE_AREA_RECT["great-lawn"])).toBe(40000);
  });

  it("scales by the given feet-per-unit", () => {
    expect(rectToSquareFeet({ w: 10, h: 10 }, 2)).toBe(400);
  });
});

describe("capacityForArea", () => {
  it("divides square feet by sq ft per person", () => {
    expect(capacityForArea(1000, 10)).toBe(100);
  });

  it("caps at maxPeople", () => {
    expect(capacityForArea(1000, 1, 50)).toBe(50);
  });

  it("the full Plaza at 10 sq ft/person equals its maxPeople exactly", () => {
    const plaza = DRAWABLE_AREA_RECT["city-hall-plaza"];
    expect(capacityForArea(rectToSquareFeet(plaza), 10, 2000)).toBe(2000);
  });

  it("never goes negative", () => {
    expect(capacityForArea(0, 10)).toBe(0);
  });
});

describe("clampRectToArea", () => {
  const area = { x: 100, y: 100, w: 50, h: 40 };

  it("keeps a rect that already fits", () => {
    expect(clampRectToArea({ x: 110, y: 110, w: 20, h: 10 }, area)).toEqual({ x: 110, y: 110, w: 20, h: 10 });
  });

  it("clamps a rect that overflows the area's edges", () => {
    expect(clampRectToArea({ x: 90, y: 90, w: 1000, h: 1000 }, area)).toEqual(area);
  });

  it("normalizes a negative width and height (dragged backwards)", () => {
    expect(clampRectToArea({ x: 140, y: 120, w: -20, h: -10 }, area)).toEqual({ x: 120, y: 110, w: 20, h: 10 });
  });

  it("never returns a rect larger than the area", () => {
    const clamped = clampRectToArea({ x: 0, y: 0, w: 9999, h: 9999 }, area);
    expect(clamped.w).toBeLessThanOrEqual(area.w);
    expect(clamped.h).toBeLessThanOrEqual(area.h);
  });
});

describe("isConnectedRoute / canAppendSegment", () => {
  it("the Riverfront 5K loop is one connected route", () => {
    expect(isConnectedRoute(RIVERFRONT_5K_ROUTE)).toBe(true);
  });

  it("an empty or single-segment list is trivially connected", () => {
    expect(isConnectedRoute([])).toBe(true);
    expect(isConnectedRoute(["main-1-2"])).toBe(true);
  });

  it("rejects segments that do not share a node", () => {
    expect(isConnectedRoute(["main-1-2", "oak-100"])).toBe(false);
  });

  it("canAppendSegment accepts a connecting block and rejects a disconnected one", () => {
    expect(canAppendSegment(["main-1-2"], "main-2-3")).toBe(true);
    expect(canAppendSegment(["main-1-2"], "oak-100")).toBe(false);
  });

  it("canAppendSegment accepts anything as the first segment", () => {
    expect(canAppendSegment([], "oak-100")).toBe(true);
  });

  it("canAppendSegment refuses a repeat", () => {
    expect(canAppendSegment(["main-1-2", "main-2-3"], "main-1-2")).toBe(false);
  });
});

describe("routeMiles", () => {
  it("the 5K loop is exactly 3.1 miles", () => {
    expect(routeMiles(RIVERFRONT_5K_ROUTE)).toBe(3.1);
  });

  it("an empty route is 0 miles", () => {
    expect(routeMiles([])).toBe(0);
  });
});

describe("mergeStreetLabel", () => {
  it("merges three contiguous Main Street blocks", () => {
    expect(mergeStreetLabel(["main-1-2", "main-2-3", "main-3-4"])).toBe("Main Street, 1st to 4th Avenue");
  });

  it("a single residential block keeps its own label", () => {
    expect(mergeStreetLabel(["maple-400"])).toBe("400 block of Maple Street");
  });

  it("a single arterial block keeps its own label", () => {
    expect(mergeStreetLabel(["main-2-3"])).toBe("Main Street, 2nd to 3rd Avenue");
  });

  it("joins unrelated blocks with a comma", () => {
    expect(mergeStreetLabel(["maple-400", "oak-100"])).toBe("400 block of Maple Street, 100 block of Oak Avenue");
  });

  it("an empty list is blank", () => {
    expect(mergeStreetLabel([])).toBe("");
  });
});

describe("buildInventoryLocation", () => {
  it("a single shelter", () => {
    const loc = buildInventoryLocation(["shelter-3"]);
    expect(loc.mode).toBe("inventory");
    expect(loc.capacity).toBe(60);
    expect(loc.label).toBe("Shelter 3, Riverside Park");
  });

  it("two fields of the same kind sum capacity and join the label", () => {
    const loc = buildInventoryLocation(["field-1", "field-2"]);
    expect(loc.capacity).toBe(300);
    expect(loc.label).toBe("Fields 1 and 2, Riverside Park");
  });

  it("nothing selected has no capacity and a blank label", () => {
    const loc = buildInventoryLocation([]);
    expect(loc.capacity).toBeUndefined();
    expect(loc.label).toBe("");
  });
});

describe("buildAreaLocation", () => {
  it("the full Plaza rectangle is 20,000 sq ft and 2,000 people at 10 sq ft/person", () => {
    const loc = buildAreaLocation("city-hall-plaza", DRAWABLE_AREA_RECT["city-hall-plaza"]);
    expect(loc.squareFeet).toBe(20000);
    expect(loc.capacity).toBe(2000);
    expect(loc.label).toBe("20,000 sq ft in City Hall Plaza");
  });

  it("clamps a rect drawn outside the Great Lawn", () => {
    const outside = { x: 0, y: 0, w: 9999, h: 9999 };
    const loc = buildAreaLocation("great-lawn", outside);
    expect(loc.areaRect).toEqual(DRAWABLE_AREA_RECT["great-lawn"]);
    expect(loc.squareFeet).toBe(40000);
  });
});

describe("buildStreetsLocation", () => {
  it("one residential block", () => {
    const loc = buildStreetsLocation(["maple-400"]);
    expect(loc.mode).toBe("streets");
    expect(loc.miles).toBeCloseTo(0.08);
    expect(loc.label).toBe("400 block of Maple Street");
  });
});

describe("buildRouteLocation", () => {
  it("the Riverfront 5K route reads its distance and streets", () => {
    const loc = buildRouteLocation(RIVERFRONT_5K_ROUTE);
    expect(loc.mode).toBe("route");
    expect(loc.miles).toBe(3.1);
    expect(loc.label).toBe("3.1 miles route via Main Street and River Road");
  });

  it("an empty route has a blank label", () => {
    expect(buildRouteLocation([]).label).toBe("");
  });
});

describe("toggleInventorySelection", () => {
  it("adds a space of the same kind", () => {
    expect(toggleInventorySelection(["field-1"], "field-2")).toEqual(["field-1", "field-2"]);
  });

  it("replaces the selection with a space of a different kind", () => {
    expect(toggleInventorySelection(["field-1"], "shelter-1")).toEqual(["shelter-1"]);
  });

  it("removes an already-selected space", () => {
    expect(toggleInventorySelection(["field-1", "field-2"], "field-1")).toEqual(["field-2"]);
  });
});

describe("toggleStreetSelection", () => {
  it("adds and removes a segment", () => {
    expect(toggleStreetSelection([], "maple-400")).toEqual(["maple-400"]);
    expect(toggleStreetSelection(["maple-400"], "maple-400")).toEqual([]);
  });
});

describe("thumbnailFrame", () => {
  const ASPECT = VIEWBOX.width / VIEWBOX.height;
  const contains = (outer: { x: number; y: number; w: number; h: number }, inner: { x: number; y: number; w: number; h: number }) =>
    inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
  const insideMap = (box: { x: number; y: number; w: number; h: number }) =>
    contains({ x: VIEWBOX.x, y: VIEWBOX.y, w: VIEWBOX.width, h: VIEWBOX.height }, box);

  it("zooms to one shelter, no closer than about a block, with its neighbours' names", () => {
    const frame = thumbnailFrame(buildInventoryLocation(["shelter-3"]));
    expect(frame.box.w).toBe(320);
    expect(frame.box.h).toBe(200);
    expect(contains(frame.box, SPACE_SHAPES["shelter-3"])).toBe(true);
    expect(frame.showLabels).toBe(true);
  });

  it("frames one block of a street with room on both sides", () => {
    const frame = thumbnailFrame(buildStreetsLocation(["maple-400"]));
    expect(contains(frame.box, SEGMENT_PATHS["maple-400"].box)).toBe(true);
    expect(frame.box.w / frame.box.h).toBeCloseTo(ASPECT, 2);
    expect(frame.showLabels).toBe(true);
  });

  it("frames a drawn area by its own rectangle, not the whole Plaza", () => {
    const plaza = DRAWABLE_AREA_RECT["city-hall-plaza"];
    const drawn = buildAreaLocation("city-hall-plaza", { x: plaza.x + 10, y: plaza.y + 10, w: 50, h: 30 });
    const frame = thumbnailFrame(drawn);
    expect(contains(frame.box, drawn.areaRect!)).toBe(true);
    expect(frame.box.w).toBe(320);
  });

  it("pulls back for the 5K loop, keeps the map's proportions and drops the names", () => {
    const frame = thumbnailFrame(buildRouteLocation(RIVERFRONT_5K_ROUTE));
    for (const id of RIVERFRONT_5K_ROUTE) expect(contains(frame.box, SEGMENT_PATHS[id].box), id).toBe(true);
    expect(frame.box.w / frame.box.h).toBeCloseTo(ASPECT, 2);
    expect(insideMap(frame.box)).toBe(true);
    expect(frame.showLabels).toBe(false);
  });

  it("stays on the map for a place at its edge", () => {
    const frame = thumbnailFrame(buildStreetsLocation(["oak-200"]));
    expect(insideMap(frame.box)).toBe(true);
    expect(contains(frame.box, SEGMENT_PATHS["oak-200"].box)).toBe(true);
  });

  it("shows the whole city for a location it cannot place", () => {
    const frame = thumbnailFrame({ mode: "streets", inventoryIds: [], segmentIds: ["no-such-street"], label: "Nowhere" });
    expect(frame.box).toEqual({ x: VIEWBOX.x, y: VIEWBOX.y, w: VIEWBOX.width, h: VIEWBOX.height });
    expect(frame.showLabels).toBe(false);
  });
});
