"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MapPinXIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Toolbar } from "@/components/ui/toolbar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Input } from "@/components/ui/input";
import { FilterBar, FilterChip } from "@/components/ui/filter-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { StickyAside } from "@/components/ui/sticky-aside";
import { PermitopolisMap } from "@/components/map";
import { useDemo } from "@/lib/state";
import {
  CLOSURE_STATUS_LABEL,
  closureCalendarDays,
  closureHighlights,
  closureOverlaps,
  closuresInRange,
  closuresQueryString,
  parseClosuresFilters,
  type ClosureStatus,
  type ClosuresRangeMode,
} from "@/lib/view/closures";
import { ClosuresCalendarStrip } from "./ClosuresCalendarStrip";
import { ClosuresSideList } from "./ClosuresSideList";

const MODE_OPTIONS: { value: ClosuresRangeMode; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "range", label: "Custom range" },
];

const STATUS_OPTIONS: ClosureStatus[] = ["permitted", "held", "pending"];

/**
 * /city/map, Public Works & Safety's tool (5C): the Permitopolis map for a chosen date range,
 * every closure, route and occupied space by status, overlaps named first, a calendar strip of
 * the days in range, and a side list of what is on the map. State lives in the URL.
 */
function ClosuresMapScreen() {
  const cases = useDemo((s) => s.cases);
  const today = useDemo((s) => s.demoToday);
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const filters = parseClosuresFilters(search, today);
  const range = { from: filters.from, to: filters.to };
  const query = closuresQueryString(filters);
  const here = query ? `${pathname}?${query}` : pathname;

  function go(next: Partial<typeof filters>) {
    const merged = { ...filters, ...next };
    const nextQuery = closuresQueryString(merged);
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }

  const itemsUnfiltered = closuresInRange(cases, range, { streetsOnly: filters.streetsOnly });
  const items = closuresInRange(cases, range, { streetsOnly: filters.streetsOnly, status: filters.status });
  const overlaps = closureOverlaps(items);
  const highlights = closureHighlights(items);
  const days = closureCalendarDays(range, itemsUnfiltered);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Public Works & Safety"
        title="Closures and routes"
        description="Every street closure, route and occupied space, for a day, a week or a custom range."
      />

      <Toolbar aria-label="Date range">
        <SegmentedControl
          aria-label="Date range mode"
          value={filters.mode}
          onChange={(mode) => go({ mode })}
          options={MODE_OPTIONS}
        />
        <Input
          type="date"
          aria-label={filters.mode === "week" ? "Week starting" : filters.mode === "range" ? "From" : "Date"}
          value={filters.from}
          onChange={(event) => event.target.value && go({ from: event.target.value })}
          className="h-8 w-40 text-xs"
        />
        {filters.mode === "range" ? (
          <Input
            type="date"
            aria-label="To"
            value={filters.to}
            onChange={(event) => event.target.value && go({ to: event.target.value })}
            className="h-8 w-40 text-xs"
          />
        ) : null}
      </Toolbar>

      <ClosuresCalendarStrip
        days={days}
        selected={filters.mode === "day" ? filters.from : undefined}
        onSelectDay={(date) => go({ mode: "day", from: date, to: date })}
      />

      <FilterBar
        resultCount={items.length}
        resultNoun="on the map"
        onClear={filters.status || filters.streetsOnly ? () => go({ status: undefined, streetsOnly: false }) : undefined}
      >
        {STATUS_OPTIONS.map((status) => (
          <FilterChip key={status} active={filters.status === status} onClick={() => go({ status: filters.status === status ? undefined : status })}>
            {CLOSURE_STATUS_LABEL[status]}
          </FilterChip>
        ))}
        <FilterChip active={filters.streetsOnly} onClick={() => go({ streetsOnly: !filters.streetsOnly })}>
          Street closures only
        </FilterChip>
      </FilterBar>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          {highlights.length === 0 ? (
            <EmptyState icon={MapPinXIcon} title="Nothing in this range" text="No closure, route or occupied space falls in this range." />
          ) : (
            <PermitopolisMap highlights={highlights} />
          )}
        </div>
        <StickyAside aria-label="What is on the map">
          <ClosuresSideList items={items} overlaps={overlaps} here={here} />
        </StickyAside>
      </div>
    </div>
  );
}

export { ClosuresMapScreen };
