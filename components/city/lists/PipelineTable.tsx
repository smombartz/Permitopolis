"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CaseId, DateText, DeptStatusDots, DueDate, LeadTimeRisk, StateChip, TierBadge, WaitingOnChips } from "@/components/domain";
import { Truncate } from "@/components/ui/truncate";
import { useRovingListNav } from "@/components/city/lists/useRovingListNav";
import { routes } from "@/lib/routes";
import { eventDate } from "@/lib/state";
import type { ISODate } from "@/lib/types";
import type { PipelineTableRow, SortDir, SortField } from "@/lib/view/cityLists";
import { applicantNameOf } from "@/lib/data/people";

const COLUMNS: { field: SortField | null; label: string }[] = [
  { field: null, label: "ID" },
  { field: null, label: "Event" },
  { field: null, label: "Tier" },
  { field: "event_date", label: "Event date" },
  { field: "state", label: "State" },
  { field: "waiting", label: "Waiting on" },
  { field: null, label: "Next action" },
  { field: "due", label: "Due" },
  { field: null, label: "Depts" },
  { field: null, label: "Risk" },
];

interface PipelineTableProps {
  rows: PipelineTableRow[];
  today: ISODate;
  sort: SortField;
  dir: SortDir;
  onSort: (field: SortField) => void;
  /** This list's own URL: a case opened from a row comes back to it. */
  from: string;
}

/** The pipeline's Table view: sortable, sticky header, mono ids/dates, long names truncated. */
function PipelineTable({ rows, today, sort, dir, onSort, from }: PipelineTableProps) {
  const router = useRouter();
  const containerRef = React.useRef<HTMLDivElement>(null);
  useRovingListNav(containerRef, "[data-row-nav]");

  function open(id: string) {
    router.push(routes.city.case(id, { from }));
  }

  return (
    <div ref={containerRef}>
    <Table>
      <TableHeader>
        <TableRow>
          {COLUMNS.map((col) => (
            <TableHead key={col.label} aria-sort={col.field && sort === col.field ? (dir === "asc" ? "ascending" : "descending") : undefined}>
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
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const { case: c } = row;
          const date = eventDate(c, today);
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
              <TableCell numeric>
                <CaseId id={c.id} />
              </TableCell>
              <TableCell>
                <div data-slot="event-title" className="flex max-w-56 min-w-0 flex-col">
                  <Link
                    href={routes.city.case(c.id, { from })}
                    title={c.name}
                    // The row opens the case too: one navigation, not two.
                    onClick={(event) => event.stopPropagation()}
                    className="block truncate rounded-control text-sm font-semibold text-fg underline-offset-4 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  >
                    {c.name}
                  </Link>
                  <Truncate text={applicantNameOf(c)} className="text-xs text-fg-secondary" />
                </div>
              </TableCell>
              <TableCell>
                <TierBadge tier={c.tier} />
              </TableCell>
              <TableCell numeric>{date ? <DateText date={date} short /> : "No date yet"}</TableCell>
              <TableCell>
                <StateChip state={c.state} ending={c.ending} />
              </TableCell>
              <TableCell>
                <WaitingOnChips items={row.waitingOn} />
              </TableCell>
              <TableCell>
                <span className="block max-w-48 truncate text-fg">{row.nextAction}</span>
              </TableCell>
              <TableCell numeric>{row.due ? <DueDate date={row.due} today={today} /> : "—"}</TableCell>
              <TableCell>
                <DeptStatusDots items={row.deptStatus} />
              </TableCell>
              <TableCell>
                <LeadTimeRisk risk={row.leadTimeRisk} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
    </div>
  );
}

export { PipelineTable };
