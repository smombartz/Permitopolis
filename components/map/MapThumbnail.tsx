import { cn } from "@/lib/utils";
import { TIER_LABEL } from "@/lib/types";
import { TIER_ICON } from "@/components/domain/icons";
import { thumbnailFrame } from "@/lib/view/map";
import { MapCanvas } from "./MapCanvas";
import { resolveLocationShapes } from "./geometry";
import type { MapHighlight } from "./types";

export interface MapThumbnailProps {
  highlight: MapHighlight;
  className?: string;
}

const TIER_FILL: Record<MapHighlight["tier"], string> = {
  instant: "fill-tier-instant-surface",
  reviewed: "fill-tier-reviewed-surface",
  special: "fill-tier-special-surface",
};
const TIER_STROKE: Record<MapHighlight["tier"], string> = {
  instant: "stroke-tier-instant",
  reviewed: "stroke-tier-reviewed",
  special: "stroke-tier-special",
};
const TIER_DOT: Record<MapHighlight["tier"], string> = {
  instant: "bg-tier-instant",
  reviewed: "bg-tier-reviewed",
  special: "bg-tier-special",
};

/**
 * A small, non-interactive map zoomed to one location, for the permit page and the case
 * overview. No onSelect, no legend list: the caption below is the label.
 *
 * Line widths are in screen pixels (`non-scaling-stroke`), so the place reads the same whether
 * the frame holds one shelter or the whole 5K loop.
 */
export function MapThumbnail({ highlight, className }: MapThumbnailProps) {
  const shapes = resolveLocationShapes(highlight.location);
  const frame = thumbnailFrame(highlight.location);
  const TierIcon = TIER_ICON[highlight.tier];

  return (
    <figure className={cn("w-full max-w-64", className)}>
      <MapCanvas frame={frame.box} labels={frame.showLabels} role="img" aria-label={`Map showing ${highlight.label}`}>
        {/* A light casing first, so the tier color reads on a park, a street or a rooftop alike. */}
        {shapes.map((shape, index) =>
          shape.kind === "path" ? (
            <path
              key={`casing-${shape.id}-${index}`}
              d={shape.path.d}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              className="fill-none stroke-surface-solid"
              strokeWidth={7}
            />
          ) : null,
        )}
        {/* A route may run one segment several times (laps), so a shape's id alone is not a key. */}
        {shapes.map((shape, index) =>
          shape.kind === "rect" ? (
            <rect
              key={`${shape.id}-${index}`}
              data-shape={shape.id}
              x={shape.rect.x}
              y={shape.rect.y}
              width={shape.rect.w}
              height={shape.rect.h}
              rx={2}
              vectorEffect="non-scaling-stroke"
              className={cn(TIER_FILL[highlight.tier], TIER_STROKE[highlight.tier])}
              fillOpacity={0.8}
              strokeWidth={2.5}
            />
          ) : (
            <path
              key={`${shape.id}-${index}`}
              data-shape={shape.id}
              d={shape.path.d}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              className={cn("fill-none", TIER_STROKE[highlight.tier])}
              strokeWidth={4}
            />
          ),
        )}
      </MapCanvas>
      <figcaption className="mt-1 flex items-center gap-1.5 text-xs text-fg-secondary">
        <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", TIER_DOT[highlight.tier])} />
        <TierIcon aria-hidden className="size-3 shrink-0" />
        <span className="text-fg-label">{TIER_LABEL[highlight.tier]}: </span>
        <span className="truncate">{highlight.label}</span>
      </figcaption>
    </figure>
  );
}
