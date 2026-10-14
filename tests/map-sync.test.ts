/**
 * The city map is drawn in design/map/permitopolis-map.svg and turned into code by
 * `pnpm map:sync`. These keep the three in step: the drawing, the generated code, and the
 * inventory and streets the rules work from.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SPACES } from "@/lib/data/inventory";
import { NODE_POINTS, SEGMENT_PATHS, SPACE_SHAPES, VIEWBOX } from "@/lib/data/mapGeometry";
import { SEGMENTS } from "@/lib/data/streets";

const ROOT = join(__dirname, "..");

describe("the map's generated code", () => {
  it("is what `pnpm map:sync` writes from the drawing today", () => {
    const result = spawnSync(process.execPath, ["scripts/sync-map.mjs", "--check"], { cwd: ROOT, encoding: "utf8" });
    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
  });
});

describe("the drawing agrees with the data", () => {
  it("draws every space the inventory has, and no other", () => {
    expect(Object.keys(SPACE_SHAPES).sort()).toEqual(SPACES.map((space) => space.id).sort());
  });

  it("draws every street segment, and no other", () => {
    expect(Object.keys(SEGMENT_PATHS).sort()).toEqual(SEGMENTS.map((segment) => segment.id).sort());
  });

  it("states the same capacity and square feet as the inventory", () => {
    for (const space of SPACES) {
      const drawn = SPACE_SHAPES[space.id];
      expect(drawn.capacity, `${space.id} capacity`).toBe(space.capacity);
      expect(drawn.squareFeet, `${space.id} square feet`).toBe(space.squareFeet);
    }
  });

  it("states the same nodes and households as the streets, and the same miles where it gives them", () => {
    for (const segment of SEGMENTS) {
      const drawn = SEGMENT_PATHS[segment.id];
      expect(drawn.nodes, `${segment.id} nodes`).toEqual(segment.nodes);
      expect(drawn.households, `${segment.id} households`).toBe(segment.households);
      if (drawn.miles !== undefined) expect(drawn.miles, `${segment.id} miles`).toBe(segment.miles);
    }
  });

  it("marks every node a segment ends at", () => {
    for (const segment of SEGMENTS) {
      for (const node of segment.nodes) expect(NODE_POINTS[node], `node ${node} of ${segment.id}`).toBeDefined();
    }
  });

  it("keeps every space and street inside the map", () => {
    const inside = (x: number, y: number) => x >= VIEWBOX.x && x <= VIEWBOX.x + VIEWBOX.width && y >= VIEWBOX.y && y <= VIEWBOX.y + VIEWBOX.height;
    for (const shape of [...Object.values(SPACE_SHAPES), ...Object.values(SEGMENT_PATHS).map((path) => ({ id: path.id, ...path.box }))]) {
      expect(inside(shape.x, shape.y) && inside(shape.x + shape.w, shape.y + shape.h), `${shape.id} is off the map`).toBe(true);
    }
  });
});
