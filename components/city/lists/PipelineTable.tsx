"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CaseId, DateText, DeptStatusDots, DueDate, LeadTimeRisk, StateChip, TierBadge, WaitingOnChips } from "@/components/domain";
import { CommissionBadge } from "@/components/domain/CommissionBadge";
import { StalledBadge } from "@/components/domain/StalledBadge";
import { Truncate } from "@/components/ui/truncate";
import { useRovingListNav } from "@/components/city/lists/useRovingListNav";
import { routes } from "@/lib/routes";
import { cn } from "cn";
import { eventDate, isStalled } from "@/lib/state";
import type { ISODate } from "@/lib/types";
import { visibleTableColumns, type PipelineTableRow, type SortDir, type SortField, type TableColumn, type TableDensity } from "@/lib/view/cityLists";
import { applicantNameOf } from "@/lib/data/people";

type ColumnId = "id" | "event" | "tier" | "event_date" | "state" | "waiting" | "next_action" | "due" | "depts" | "risk";

const COLUMN_DEF: Record<ColumnId, { field: SortField | null; label: string }> = {
  id: { field: null, label: "ID" },
  event: { field: null, label: "Event" },
  tier: { field: null, label: "Tier" },
  event_date: { field: "event_date", label: "Event date" },
  state: { field: "state", label: "State" },
  waiting: { field: "waiting", label: "Waiting on" },
  next_action: { field: null, label: "Next action" },
  due: { field: "due", label: "Due" },
  depts: { field: null, label: "Depts" },
  risk: { field: null, label: "Risk" },
};

interface PipelineTableProps {
  rows: PipelineTableRow[];
  today: ISODate;
  sort: SortField;
  dir: SortDir;
  onSort: (field: SortField) => void;
  /** This list's own URL: a case opened from a row comes back to it. */
  from: string;
  /** The optional columns visible beyond event, event date and state (always on). */
  columns: TableColumn[];
  density: TableDensity;
}

/** The pipeline's Table view: sortable, sticky header, mono ids/dates, long names truncated. */
function PipelineTable({ rows, today, sort, dir, onSort, from, columns, density }: PipelineTableProps) {
  const router = useRouter();
  const containerRef = React.useRef<HTMLDivElement>(null);
  useRovingListNav(containerRef, "[data-row-nav]");
  const visible = visibleTableColumns({ columns });
  const compact = density === "compact";
  const headClass = compact ? "!h-7" : undefined;
  const cellClass = compact ? "!h-8" : undefined;

  function open(id: string) {
    router.push(routes.city.case(id, { from }));
  }

  return (
    <div ref={containerRef}>
    <Table aria-label="Cases">
      <TableHeader>
        <TableRow>
          {visible.map((id) => {
            const col = COLUMN_DEF[id];
            return (
              <TableHead key={id} className={headClass} aria-sort={col.field && sort === col.field ? (dir === "asc" ? "ascending" : "descending") : undefined}>
                {col.field ? (
                  <button
                    type="button"
                    onClick={() => onSort(col.field!)}
                    className="flex items-center gap-1 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  >
                    {col.label}
                    {sort === col.field ? dir === "asc" ? <ArrowUpIcon className="size-3" aria-hidden="true" /> : <ArrowDownIcon className="size-3" aria-hidden="true" /> : null}
                  </button>
                ) : (
                  col.label
                )}
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const { case: c } = row;
          const date = eventDate(c, today);
          const cells: Record<ColumnId, React.ReactNode> = {
            id: <CaseId id={c.id} />,
            event: (
              <div data-slot="event-title" className="flex max-w-56 min-w-0 flex-col">
                <div className="flex min-w-0 items-center gap-1.5">
                  <Link
                    href={routes.city.case(c.id, { from })}
                    title={c.name}
                    // The row opens the case too: one navigation, not two.
                    onClick={(event) => event.stopPropagation()}
                    className="block min-w-0 truncate rounded-control text-sm font-semibold text-fg underline-offset-4 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  >
                    {c.name}
                  </Link>
                  {isStalled(c, today) ? <StalledBadge /> : null}
                  {c.flags.sentToCommission ? <CommissionBadge /> : null}
                </div>
                <Truncate text={applicantNameOf(c)} className="text-xs text-fg-secondary" />
              </div>
            ),
            tier: <TierBadge tier={c.tier} />,
            event_date: date ? <DateText date={date} short /> : "No date yet",
            state: <StateChip state={c.state} ending={c.ending} />,
            waiting: <WaitingOnChips items={row.waitingOn} />,
            next_action: <span className="block max-w-48 truncate text-fg">{row.nextAction}</span>,
            due: row.due ? <DueDate date={row.due} today={today} /> : "—",
            depts: <DeptStatusDots items={row.deptStatus} />,
            risk: <LeadTimeRisk risk={row.leadTimeRisk} />,
          };
          const numericCols: ColumnId[] = ["id", "event_date", "due"];
          return (
            <TableRow
              key={c.id}
              // A row, with its cells and column headers intact for a screen reader: the link to
              // the case is the event's name. The row itself stays focusable for j/k and Enter.
              data-row-nav=""
              tabIndex={0}
              className="cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              onClick={() => open(c.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  open(c.id);
                }
              }}
            >
              {visible.map((id) => (
                <TableCell key={id} numeric={numericCols.includes(id)} className={cn(cellClass, id === "event" ? "min-w-0" : undefined)}>
                  {cells[id]}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
    </div>
  );
}

export { PipelineTable };
