"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGridIcon, TableIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { FilterBar, FilterChip } from "@/components/ui/filter-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { PipelineBoard } from "@/components/city/lists/PipelineBoard";
import { PipelineTable } from "@/components/city/lists/PipelineTable";
import { KeyboardFooter } from "@/components/city/lists/KeyboardFooter";
import { useDemo } from "@/lib/state";
import { TIER_LABEL, STATE_LABEL, PARTY_LABEL, type CaseState, type Party, type Tier } from "@/lib/types";
import {
  activeFilterChips,
  casesQueryString,
  defaultInvolvesMe,
  filteredCases,
  parseCasesFilters,
  pipelineBoardColumns,
  pipelineTableRows,
  sortTableRows,
  type CasesListFilters,
  type SortField,
} from "@/lib/view/cityLists";

const SELECT_CLASS = "h-8 shrink-0 rounded-control border border-line-subtle bg-surface-strong px-2.5 text-xs text-fg outline-none focus-visible:border-focus-ring focus-visible:shadow-focus-halo";

const TIER_OPTIONS: Tier[] = ["instant", "reviewed", "special"];
const STATE_OPTIONS: CaseState[] = ["submitted", "in_review", "needs_info", "quote_sent", "permitted", "event_day", "closeout", "closed"];
const WAITING_OPTIONS: ("me" | Party)[] = ["me", "applicant", "clerk", "pws", "hl"];

/** /city/cases: Board and Table views of the same filtered cases, all state in the URL. */
function CasesScreen() {
  const cases = useDemo((s) => s.cases);
  const today = useDemo((s) => s.demoToday);
  const cfg = useDemo((s) => s.cfg);
  const role = useDemo((s) => s.role);
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const containerRef = React.useRef<HTMLDivElement>(null);

  const filters = parseCasesFilters(search, role);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const input = containerRef.current?.querySelector<HTMLInputElement>('input[aria-label="Search cases"]');
      if (input) {
        event.preventDefault();
        input.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function update(patch: Partial<CasesListFilters>) {
    const qs = casesQueryString({ ...filters, ...patch }, role);
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function handleSort(field: SortField) {
    if (field === filters.sort) update({ dir: filters.dir === "asc" ? "desc" : "asc" });
    else update({ sort: field, dir: "asc" });
  }

  function removeChip(key: "tier" | "state" | "waiting" | "dates" | "q") {
    if (key === "tier") update({ tier: undefined });
    else if (key === "state") update({ state: undefined });
    else if (key === "waiting") update({ waiting: undefined });
    else if (key === "dates") update({ from: undefined, to: undefined });
    else update({ q: "" });
  }

  function clearFilters() {
    update({ tier: undefined, state: undefined, waiting: undefined, from: undefined, to: undefined, q: "", involvesMe: defaultInvolvesMe(role), closedAndEnded: false });
  }

  const visible = filteredCases(cases, role, filters, today);
  const universe = filteredCases(cases, role, { ...filters, tier: undefined, state: undefined, waiting: undefined, from: undefined, to: undefined, q: "", involvesMe: false }, today);
  const chips = activeFilterChips(filters);
  const rows = sortTableRows(pipelineTableRows(visible, today, cfg), filters.sort, filters.dir, today);
  const columns = pipelineBoardColumns(visible, today);

  return (
    <div ref={containerRef} className="flex flex-col gap-5">
      <PageHeader eyebrow="City" title="Cases pipeline" description="Every case the city is tracking, as a board or a table." />

      <p className="text-sm text-fg-secondary" aria-live="polite">
        {visible.length} of {universe.length} cases
      </p>

      <FilterBar searchValue={filters.q} onSearchChange={(value) => update({ q: value })} searchPlaceholder="Search cases" searchShortcut="/" onClear={clearFilters}>
        <FilterChip active={filters.involvesMe} onClick={() => update({ involvesMe: !filters.involvesMe })}>
          Involves me
        </FilterChip>
        <FilterChip active={filters.closedAndEnded} onClick={() => update({ closedAndEnded: !filters.closedAndEnded })}>
          Closed and ended
        </FilterChip>
        <select aria-label="Tier" value={filters.tier ?? ""} onChange={(e) => update({ tier: (e.target.value || undefined) as Tier | undefined })} className={SELECT_CLASS}>
          <option value="">All tiers</option>
          {TIER_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {TIER_LABEL[t]}
            </option>
          ))}
        </select>
        <select
          aria-label="State"
          value={filters.state ?? ""}
          onChange={(e) => update({ state: (e.target.value || undefined) as CasesListFilters["state"] })}
          className={SELECT_CLASS}
        >
          <option value="">All states</option>
          {STATE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATE_LABEL[s]}
            </option>
          ))}
          <option value="off_path">Closed or ended</option>
        </select>
        <select
          aria-label="Waiting on"
          value={filters.waiting ?? ""}
          onChange={(e) => update({ waiting: (e.target.value || undefined) as CasesListFilters["waiting"] })}
          className={SELECT_CLASS}
        >
          <option value="">Waiting on anyone</option>
          {WAITING_OPTIONS.map((w) => (
            <option key={w} value={w}>
              {w === "me" ? "Me" : PARTY_LABEL[w]}
            </option>
          ))}
        </select>
        <input aria-label="Event date from" type="date" value={filters.from ?? ""} onChange={(e) => update({ from: e.target.value || undefined })} className={SELECT_CLASS} />
        <input aria-label="Event date to" type="date" value={filters.to ?? ""} onChange={(e) => update({ to: e.target.value || undefined })} className={SELECT_CLASS} />
      </FilterBar>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <FilterChip key={chip.key} active onClick={() => removeChip(chip.key)}>
              {chip.label}
              <span aria-hidden="true">&times;</span>
            </FilterChip>
          ))}
        </div>
      ) : null}

      <SegmentedControl
        aria-label="Cases pipeline view"
        value={filters.view}
        onChange={(view) => update({ view })}
        options={[
          { value: "board", label: "Board", icon: <LayoutGridIcon className="size-3.5" aria-hidden="true" /> },
          { value: "table", label: "Table", icon: <TableIcon className="size-3.5" aria-hidden="true" /> },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={TableIcon}
          title="No cases match"
          text={chips.length > 0 ? `No result for ${chips.map((c) => c.label).join(", ")}.` : "No cases match these filters."}
          action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
        />
      ) : filters.view === "table" ? (
        <PipelineTable rows={rows} today={today} sort={filters.sort} dir={filters.dir} onSort={handleSort} />
      ) : (
        <PipelineBoard columns={columns} today={today} />
      )}

      {filters.view === "table" ? <KeyboardFooter /> : null}
      <p className="text-xs text-fg-secondary">
        Press <Kbd>/</Kbd> to search.
      </p>
    </div>
  );
}

export { CasesScreen };
