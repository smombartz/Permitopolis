"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarIcon, LayoutGridIcon, LayoutListIcon, TableIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { FilterBar, FilterChip } from "@/components/ui/filter-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { PipelineBoard, type BoardColumnSpec } from "@/components/city/lists/PipelineBoard";
import { PipelineTable } from "@/components/city/lists/PipelineTable";
import { KeyboardFooter } from "@/components/city/lists/KeyboardFooter";
import { isInsideOverlay, isPlainShortcut } from "@/lib/keyboard";
import { useDemo } from "@/lib/state";
import { STATE_LABEL, TIER_LABEL, PARTY_LABEL, type CaseState, type Party, type Tier } from "@/lib/types";
import {
  activeFilterChips,
  casesQueryString,
  defaultInvolvesMe,
  EVENT_DATE_BUCKET_LABEL,
  EVENT_DATE_BUCKETS,
  filteredCases,
  parseCasesFilters,
  pipelineBoardColumns,
  pipelineEventDateColumns,
  pipelineTableRows,
  sortTableRows,
  TOGGLABLE_TABLE_COLUMNS,
  TABLE_COLUMN_LABEL,
  type BoardGroupBy,
  type CasesListFilters,
  type SortField,
  type TableColumn,
  type TableDensity,
} from "@/lib/view/cityLists";

const SELECT_CLASS = "h-8 shrink-0 rounded-control border border-line-subtle bg-surface-strong px-2.5 text-xs text-fg outline-none focus-visible:border-focus-ring focus-visible:shadow-focus-halo";

const TIER_OPTIONS: Tier[] = ["instant", "reviewed", "special"];
const STATE_OPTIONS: CaseState[] = ["submitted", "in_review", "needs_info", "quote_sent", "permitted", "event_day", "closeout", "closed"];
const WAITING_OPTIONS: ("me" | Party)[] = ["me", "applicant", "clerk", "pws", "hl"];
/** How long the search box waits after the last key before it writes the URL. */
const SEARCH_URL_DELAY_MS = 200;

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

  const urlFilters = parseCasesFilters(search, role);
  // The search text lives here, not in the URL. A router.replace() is a transition (an RSC round
  // trip under `next dev`), so an input drawn from the URL is put back to its old value after
  // every key until the navigation commits: letters drop and the caret jumps. The field and the
  // list follow this state at once; the URL is written after a pause in the typing.
  const [q, setQ] = React.useState(urlFilters.q);
  // The URL's own q as last seen, and every q this screen has written there and not yet seen
  // come back (two writes can be in flight). A URL q that is neither came from outside (Back, a
  // link), and the field takes it.
  const [seenUrlQ, setSeenUrlQ] = React.useState(urlFilters.q);
  const [sentQs, setSentQs] = React.useState<string[]>([]);
  if (urlFilters.q !== seenUrlQ) {
    setSeenUrlQ(urlFilters.q);
    const arrived = sentQs.lastIndexOf(urlFilters.q);
    if (arrived >= 0) {
      setSentQs(sentQs.slice(arrived));
    } else {
      setSentQs([]);
      setQ(urlFilters.q);
    }
  }
  const filters: CasesListFilters = { ...urlFilters, q };
  const searchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // A case opened from here comes back to this list as it is: view, filters and sort, with
  // the search as typed even if the URL has not caught up with it yet.
  const query = casesQueryString(filters, role);
  const here = query ? `${pathname}?${query}` : pathname;

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Not while somebody is typing, with a modifier held, or from inside an open sheet or dialog.
      if (event.key !== "/" || !isPlainShortcut(event) || isInsideOverlay(event.target)) return;
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
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
    const next = { ...filters, ...patch };
    if (patch.q !== undefined) setQ(patch.q);
    // A write that leaves the URL's q as it is, with none on its way, has nothing to wait for.
    setSentQs((sent) => (sent.length === 0 && next.q === urlFilters.q ? sent : [...sent, next.q]));
    const qs = casesQueryString(next, role);
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  // The newest `update`, for the timer below: it must write the filters as they are when it
  // fires, not as they were when the key was pressed.
  const updateRef = React.useRef(update);
  React.useEffect(() => {
    updateRef.current = update;
  });
  React.useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  function handleSearch(value: string) {
    setQ(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      searchTimer.current = null;
      updateRef.current({});
    }, SEARCH_URL_DELAY_MS);
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
  const boardColumns: BoardColumnSpec[] =
    filters.groupBy === "event_date"
      ? EVENT_DATE_BUCKETS.map((bucket) => ({ key: bucket, label: EVENT_DATE_BUCKET_LABEL[bucket], cases: pipelineEventDateColumns(visible, today)[bucket] }))
      : Object.entries(pipelineBoardColumns(visible, today, filters.state)).map(([state, stateCases]) => ({ key: state, label: STATE_LABEL[state as CaseState], cases: stateCases }));

  function toggleColumn(col: TableColumn) {
    const next = filters.columns.includes(col) ? filters.columns.filter((c) => c !== col) : [...filters.columns, col];
    update({ columns: next });
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-6">
      <PageHeader eyebrow="City" title="Cases pipeline" description="Every case the city is tracking, as a board or a table." />

      <p className="text-sm text-fg-secondary" aria-live="polite">
        {visible.length} of {universe.length} cases
      </p>

      <FilterBar searchValue={q} onSearchChange={handleSearch} searchPlaceholder="Search cases" searchShortcut="/" onClear={clearFilters}>
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
          <option value="off_path">Ended</option>
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          aria-label="Cases pipeline view"
          value={filters.view}
          onChange={(view) => update({ view })}
          options={[
            { value: "board", label: "Board", icon: <LayoutGridIcon className="size-3.5" aria-hidden="true" /> },
            { value: "table", label: "Table", icon: <TableIcon className="size-3.5" aria-hidden="true" /> },
          ]}
        />

        {filters.view === "board" ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-fg-secondary">Group by</span>
            <SegmentedControl
              aria-label="Group cases by"
              value={filters.groupBy}
              onChange={(groupBy) => update({ groupBy: groupBy as BoardGroupBy })}
              options={[
                { value: "state", label: "State" },
                { value: "event_date", label: "Event date", icon: <CalendarIcon className="size-3.5" aria-hidden="true" /> },
              ]}
            />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-fg-secondary">Columns</span>
            {TOGGLABLE_TABLE_COLUMNS.map((col) => (
              <FilterChip key={col} active={filters.columns.includes(col)} onClick={() => toggleColumn(col)}>
                {TABLE_COLUMN_LABEL[col]}
              </FilterChip>
            ))}
            <SegmentedControl
              aria-label="Table density"
              value={filters.density}
              onChange={(density) => update({ density: density as TableDensity })}
              options={[
                { value: "comfortable", label: "Comfortable", icon: <LayoutListIcon className="size-3.5" aria-hidden="true" /> },
                { value: "compact", label: "Compact" },
              ]}
            />
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={TableIcon}
          title="No cases match"
          text={chips.length > 0 ? `No result for ${chips.map((c) => c.label).join(", ")}.` : "No cases match these filters."}
          action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
        />
      ) : filters.view === "table" ? (
        <PipelineTable rows={rows} today={today} sort={filters.sort} dir={filters.dir} onSort={handleSort} from={here} columns={filters.columns} density={filters.density} />
      ) : (
        <PipelineBoard columns={boardColumns} today={today} from={here} showStateChip={filters.groupBy === "event_date"} />
      )}

      {filters.view === "table" ? <KeyboardFooter /> : null}
      <p className="text-xs text-fg-secondary">
        Press <Kbd>/</Kbd> to search.
      </p>
    </div>
  );
}

export { CasesScreen };
