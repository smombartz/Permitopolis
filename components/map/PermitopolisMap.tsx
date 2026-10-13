"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { TIER_LABEL } from "@/lib/types";
import { TIER_ICON } from "@/components/domain/icons";
import { TierLegend } from "@/components/domain/TierLegend";
import { VIEWBOX } from "@/lib/data/mapGeometry";
import { CityBackground } from "./CityBackground";
import { lineMidpoint, occupiedIds, rectCenter, resolveLocationShapes } from "./geometry";
import type { MapHighlight } from "./types";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

export type { MapHighlight };

export interface PermitopolisMapProps {
  highlights: MapHighlight[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}

const STATUS_LABEL: Record<MapHighlight["status"], string> = {
  held: "Date held",
  permitted: "Permitted",
  pending: "Pending review",
};

/** Solid for a confirmed permit, dashed while pending; held is solid but thinner. */
const STATUS_LINE: Record<MapHighlight["status"], { dash?: string; width: number }> = {
  held: { width: 4 },
  permitted: { width: 5 },
  pending: { dash: "7 5", width: 4 },
};

const TIER_FILL: Record<MapHighlight["tier"], string> = {
  instant: "fill-tier-instant-surface",
  reviewed: "fill-tier-reviewed-surface",
  special: "fill-tier-special-surface",
};
const TIER_DOT: Record<MapHighlight["tier"], string> = {
  instant: "bg-tier-instant",
  reviewed: "bg-tier-reviewed",
  special: "bg-tier-special",
};
const TIER_STROKE: Record<MapHighlight["tier"], string> = {
  instant: "stroke-tier-instant",
  reviewed: "stroke-tier-reviewed",
  special: "stroke-tier-special",
};

/**
 * Display mode: draws booked spaces, closures and routes for a set of highlights,
 * colored by tier with status as line weight/dash, overlaps called out, every shape
 * labeled. No map library, no tiles.
 */
export function PermitopolisMap({ highlights, selectedId, onSelect, className }: PermitopolisMapProps) {
  const overlapCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const highlight of highlights) {
      for (const id of occupiedIds(highlight.location)) counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  }, [highlights]);

  const overlappingHighlightIds = React.useMemo(() => {
    const overlapping = new Set<string>();
    for (const highlight of highlights) {
      if (occupiedIds(highlight.location).some((id) => overlapCounts[id] > 1)) overlapping.add(highlight.id);
    }
    return overlapping;
  }, [highlights, overlapCounts]);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <TierLegend aria-label="Map legend: tiers" />
      <svg
        viewBox={`${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.width} ${VIEWBOX.height}`}
        role="img"
        aria-label="Map of Permitopolis with booked spaces, closures and routes"
        className="w-full rounded-panel border border-line-subtle bg-surface-1"
      >
        <CityBackground />
        {highlights.map((highlight) => {
          const shapes = resolveLocationShapes(highlight.location);
          const isSelected = highlight.id === selectedId;
          const isOverlapping = overlappingHighlightIds.has(highlight.id);
          const line = STATUS_LINE[highlight.status];
          return (
            <g key={highlight.id}>
              <title>
                {`${highlight.label} · ${TIER_LABEL[highlight.tier]} · ${STATUS_LABEL[highlight.status]}${
                  isOverlapping ? " · Overlaps another booking" : ""
                }`}
              </title>
              {shapes.map((shape) =>
                shape.kind === "rect" ? (
                  <rect
                    key={shape.id}
                    x={shape.rect.x}
                    y={shape.rect.y}
                    width={shape.rect.w}
                    height={shape.rect.h}
                    rx={4}
                    className={cn(
                      TIER_FILL[highlight.tier],
                      TIER_STROKE[highlight.tier],
                      "cursor-pointer",
                      isSelected && "stroke-indigo-650",
                      isOverlapping && "stroke-danger",
                    )}
                    strokeWidth={isSelected || isOverlapping ? line.width + 2 : line.width}
                    strokeDasharray={line.dash}
                    onClick={() => onSelect?.(highlight.id)}
                  />
                ) : (
                  <line
                    key={shape.id}
                    x1={shape.line.x1}
                    y1={shape.line.y1}
                    x2={shape.line.x2}
                    y2={shape.line.y2}
                    strokeLinecap="round"
                    className={cn(
                      TIER_STROKE[highlight.tier],
                      "cursor-pointer",
                      isSelected && "stroke-indigo-650",
                      isOverlapping && "stroke-danger",
                    )}
                    strokeWidth={isSelected || isOverlapping ? line.width + 2 : line.width}
                    strokeDasharray={line.dash}
                    onClick={() => onSelect?.(highlight.id)}
                  />
                ),
              )}
              {shapes[0] &&
                (() => {
                  const point = shapes[0].kind === "rect" ? rectCenter(shapes[0].rect) : lineMidpoint(shapes[0].line);
                  return (
                    <text
                      x={point.x}
                      y={point.y - 8}
                      textAnchor="middle"
                      className="fill-fg-label pointer-events-none text-[10px] font-medium"
                    >
                      {highlight.label}
                    </text>
                  );
                })()}
            </g>
          );
        })}
      </svg>

      <ul className="flex flex-col gap-1" aria-label="Highlighted bookings and closures">
        {highlights.map((highlight) => {
          const isOverlapping = overlappingHighlightIds.has(highlight.id);
          const TierIcon = TIER_ICON[highlight.tier];
          return (
            <li key={highlight.id}>
              <button
                type="button"
                onClick={() => onSelect?.(highlight.id)}
                aria-pressed={highlight.id === selectedId}
                className={cn(
                  "flex w-full items-center gap-2 rounded-control border border-line-subtle bg-surface-1 px-2 py-1.5 text-left text-sm text-fg-secondary hover:bg-surface-hover",
                  FOCUS_RING,
                  highlight.id === selectedId && "border-indigo-650",
                )}
              >
                <span aria-hidden className={cn("size-2 shrink-0 rounded-full", TIER_DOT[highlight.tier])} />
                <TierIcon aria-hidden className="size-3.5 shrink-0 text-fg-label" />
                <span className="flex-1 truncate">
                  <span className="text-xs text-fg-label">{TIER_LABEL[highlight.tier]}: </span>
                  {highlight.label}
                </span>
                <span className="text-xs text-fg-label">{STATUS_LABEL[highlight.status]}</span>
                {isOverlapping && <span className="text-xs font-semibold text-danger-fg">Overlap</span>}
              </button>
            </li>
          );
        })}
        {highlights.length === 0 && <li className="text-sm text-fg-secondary">Nothing booked or closed to show.</li>}
      </ul>
    </div>
  );
}
