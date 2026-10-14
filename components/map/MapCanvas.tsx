import * as React from "react";
import { cn } from "@/lib/utils";
import { VIEWBOX, type Rect } from "@/lib/data/mapGeometry";
import { MAP_LAYER_IDS, MAP_LAYERS, type MapLayerId } from "./art/layers.generated";

/** Drawn last, over whatever a screen puts on the map, so a street keeps its name when it is highlighted. */
const NAME_LAYERS: MapLayerId[] = ["labels", "annotations"];
/** The dots where street segments meet: only useful while drawing a route. */
const NODE_LAYER: MapLayerId = "route-nodes";
/** Everything else, in the drawing's own order. A layer added to the drawing lands here. */
const BASE_LAYERS = MAP_LAYER_IDS.filter((id) => id !== NODE_LAYER && !NAME_LAYERS.includes(id));

export interface MapCanvasProps extends Omit<React.ComponentProps<"svg">, "viewBox"> {
  /** The part of the city to show, in viewBox units. The whole city when left out. */
  frame?: Rect;
  /** Street, place and district names. On unless turned off. */
  labels?: boolean;
  /** The dots where street segments meet. */
  nodes?: boolean;
  /** Drawn over the names: a booking's own label, which has to stay readable. */
  above?: React.ReactNode;
}

/**
 * The city, as one `<svg>`: the drawing underneath, the caller's shapes (`children`) in the
 * middle, the names on top. The art comes from `design/map/permitopolis-map.svg` by way of
 * `pnpm map:sync`; it is decoration here and never takes a click.
 */
export function MapCanvas({ frame, labels = true, nodes = false, above, className, children, ...props }: MapCanvasProps) {
  const box = frame ?? { x: VIEWBOX.x, y: VIEWBOX.y, w: VIEWBOX.width, h: VIEWBOX.height };
  return (
    <svg
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      className={cn("w-full rounded-panel border border-line-subtle bg-surface-1", className)}
      {...props}
    >
      <g aria-hidden="true" className="pointer-events-none">
        {BASE_LAYERS.map((id) => {
          const Layer = MAP_LAYERS[id];
          return <Layer key={id} />;
        })}
        {nodes ? React.createElement(MAP_LAYERS[NODE_LAYER]) : null}
      </g>
      {children}
      {labels ? (
        <g aria-hidden="true" className="pointer-events-none select-none">
          {NAME_LAYERS.map((id) => {
            const Layer = MAP_LAYERS[id];
            return <Layer key={id} />;
          })}
        </g>
      ) : null}
      {above}
    </svg>
  );
}
