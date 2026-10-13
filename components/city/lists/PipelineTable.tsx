"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CaseId, DeptStatusDots, DueDate, EventTitle, LeadTimeRisk, StateChip, TierBadge, WaitingOnChips } from "@/components/domain";
import { useRovingListNav } from "@/components/city/lists/useRovingListNav";
import { routes } from "@/lib/routes";
import { fmtDateShort } from "@/lib/format";
import { eventDate } from "@/lib/state";
import type { ISODate } from "@/lib/types";
import type { PipelineTableRow, SortDir, SortField } from "@/lib/view/cityLists";
import { applicantNameOf } from "@/lib/view/cityLists";

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
}

/** The pipeline's Table view: sortable, sticky header, mono ids/dates, long names truncated. */
function PipelineTable({ rows, today, sort, dir, onSort }: PipelineTableProps) {
  const router = useRouter();
  const containerRef = React.useRef<HTMLDivElement>(null);
  useRovingListNav(containerRef, "[data-row-nav]");

  function open(id: string) {
    router.push(routes.city.case(id));
  }

  return (
    <div ref={containerRef}>
    <Table>
      <TableHeader>
        <TableRow>
          {COLUMNS.map((col) => (
            <TableHead key={col.label}>
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
              data-row-nav=""
              role="link"
              tabIndex={0}
              aria-label={`${c.name}, ${applicantNameOf(c)}`}
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
                <EventTitle name={c.name} applicantName={applicantNameOf(c)} className="max-w-56" />
              </TableCell>
              <TableCell>
                <TierBadge tier={c.tier} />
              </TableCell>
              <TableCell numeric>{date ? fmtDateShort(date) : "No date yet"}</TableCell>
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
