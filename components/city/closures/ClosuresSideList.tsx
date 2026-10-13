"use client";

import Link from "next/link";
import { MapPinXIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { EventTitle, TierBadge } from "@/components/domain";
import { applicantNameOf } from "@/lib/data/people";
import { routes } from "@/lib/routes";
import { CLOSURE_STATUS_LABEL, closureHoursLabel, formatOverlap, type ClosureItem, type ClosureOverlap, type ClosureStatus } from "@/lib/view/closures";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

const STATUS_CHIP_VARIANT: Record<ClosureStatus, "success" | "neutral" | "warning"> = {
  permitted: "success",
  held: "neutral",
  pending: "warning",
};

interface ClosuresSideListProps {
  items: ClosureItem[];
  overlaps: ClosureOverlap[];
  here: string;
}

/**
 * What is on the map: overlaps named first, with both events, the shared segments or space and
 * each one's hours, then every closure, route and occupied space, with its place, hours
 * (setup through teardown) and status, each a link to its case. An overlapping case is flagged
 * in the main list too.
 */
function ClosuresSideList({ items, overlaps, here }: ClosuresSideListProps) {
  const overlappingIds = new Set(overlaps.flatMap((o) => [o.a.case.id, o.b.case.id]));

  if (items.length === 0) {
    return <EmptyState icon={MapPinXIcon} title="Nothing on the map" text="No closure, route or occupied space falls in this range." />;
  }

  return (
    <div className="flex flex-col gap-4">
      {overlaps.length > 0 ? (
        <section aria-label="Overlaps" className="flex flex-col gap-2">
          <h2 className="text-eyebrow font-bold tracking-[.12em] text-danger-fg uppercase">Overlaps</h2>
          <ul className="flex flex-col gap-2">
            {overlaps.map((overlap, index) => (
              <li
                key={`${overlap.date}-${overlap.sharedLabel}-${index}`}
                className="rounded-panel border border-danger-border bg-danger-surface p-3 text-sm text-danger-fg"
              >
                {formatOverlap(overlap)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ul className="flex flex-col gap-2" aria-label="What is on the map">
        {items.map((item) => {
          const overlapping = overlappingIds.has(item.case.id);
          return (
            <li key={item.case.id}>
              <Link
                href={routes.city.case(item.case.id, { from: here })}
                className={cn(
                  "flex flex-col gap-2 rounded-panel border bg-surface-1 p-3 outline-none transition-colors duration-[var(--dur-fast)] ease-frost hover:bg-surface-2",
                  FOCUS_RING,
                  overlapping ? "border-danger-border" : "border-line-subtle",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <EventTitle name={item.case.name} applicantName={applicantNameOf(item.case)} className="min-w-0" />
                  {overlapping ? <span className="shrink-0 text-xs font-semibold text-danger-fg">Overlap</span> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <TierBadge tier={item.case.tier} />
                  <Chip variant={STATUS_CHIP_VARIANT[item.status]}>{CLOSURE_STATUS_LABEL[item.status]}</Chip>
                </div>
                <p className="text-sm text-fg-secondary">{item.case.location?.label}</p>
                <p className="text-xs text-fg-label">{closureHoursLabel(item.case)}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export { ClosuresSideList };
