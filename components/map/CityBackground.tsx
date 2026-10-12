import { SEGMENT_PATHS, SPACE_SHAPES, ZONE_OUTLINES } from "@/lib/data/mapGeometry";

/**
 * The static Permitopolis geometry: zones, every bookable/drawable space and every
 * street segment, with no highlighting. Rendered as `<svg>` children by its caller.
 * No map library, no tiles: every shape is `lib/data/mapGeometry.ts`.
 */
export function CityBackground() {
  return (
    <g aria-hidden="true">
      {ZONE_OUTLINES.map((zone) => (
        <rect key={zone.id} x={zone.x} y={zone.y} width={zone.w} height={zone.h} rx={14} className="fill-frost-050" />
      ))}
      {Object.values(SEGMENT_PATHS).map((seg) => (
        <line
          key={seg.id}
          x1={seg.x1}
          y1={seg.y1}
          x2={seg.x2}
          y2={seg.y2}
          className="stroke-line-magnetic"
          strokeWidth={10}
          strokeLinecap="round"
        />
      ))}
      {Object.values(SPACE_SHAPES).map((shape) => (
        <rect
          key={shape.id}
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={shape.h}
          rx={4}
          className="fill-surface-2 stroke-line-subtle"
          strokeWidth={1}
        />
      ))}
    </g>
  );
}
