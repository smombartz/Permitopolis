import { cn } from "@/lib/utils";
import { TIER_LABEL } from "@/lib/types";
import { TIER_ICON } from "@/components/domain/icons";
import { VIEWBOX } from "@/lib/data/mapGeometry";
import { CityBackground } from "./CityBackground";
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
 * A small, non-interactive map with one location highlighted, for the permit page and
 * the case overview. No onSelect, no legend list: the caption below is the label.
 */
export function MapThumbnail({ highlight, className }: MapThumbnailProps) {
  const shapes = resolveLocationShapes(highlight.location);
  const TierIcon = TIER_ICON[highlight.tier];

  return (
    <figure className={cn("w-full max-w-64", className)}>
      <svg
        viewBox={`${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.width} ${VIEWBOX.height}`}
        role="img"
        aria-label={`Map showing ${highlight.label}`}
        className="w-full rounded-panel border border-line-subtle bg-surface-1"
      >
        <CityBackground />
        {shapes.map((shape) =>
          shape.kind === "rect" ? (
            <rect
              key={shape.id}
              x={shape.rect.x}
              y={shape.rect.y}
              width={shape.rect.w}
              height={shape.rect.h}
              rx={4}
              className={cn(TIER_FILL[highlight.tier], TIER_STROKE[highlight.tier])}
              strokeWidth={4}
            />
          ) : (
            <line
              key={shape.id}
              x1={shape.line.x1}
              y1={shape.line.y1}
              x2={shape.line.x2}
              y2={shape.line.y2}
              strokeLinecap="round"
              className={TIER_STROKE[highlight.tier]}
              strokeWidth={6}
            />
          ),
        )}
      </svg>
      <figcaption className="mt-1 flex items-center gap-1.5 text-xs text-fg-secondary">
        <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", TIER_DOT[highlight.tier])} />
        <TierIcon aria-hidden className="size-3 shrink-0" />
        <span className="text-fg-label">{TIER_LABEL[highlight.tier]}: </span>
        <span className="truncate">{highlight.label}</span>
      </figcaption>
    </figure>
  );
}
