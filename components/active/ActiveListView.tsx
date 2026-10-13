"use client";

import Link from "next/link";
import { ChevronRightIcon, InboxIcon } from "lucide-react";
import { DateText, EventTitle, HoldStatus, StateChip, TierBadge } from "@/components/domain";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toolbar } from "@/components/ui/toolbar";
import { fmtTimeRange, plural } from "@/lib/format";
import { applicantNameOf } from "@/lib/data/people";
import { routes } from "@/lib/routes";
import type { Dept, ISODate } from "@/lib/types";
import { clerkOverlay, type ActiveListRow } from "@/lib/view/active";
import { ROLE_OVERLAY_COLUMN_LABEL, RoleOverlayCell } from "./RoleOverlay";

const DAY_OF_CONTACT = clerkOverlay();

interface ActiveListViewProps {
  rows: ActiveListRow[];
  today: ISODate;
  role: Dept;
  includeHolds: boolean;
  expandSessions: boolean;
  onToggleExpand: (next: boolean) => void;
  /** This list's own URL: a case opened from a row comes back to it. */
  from: string;
}

/**
 * List, sorted by event date: one row per case, or per session when expanded (PRD "Active
 * permits"). "Include held dates" is global, in the page header; this view's own toggle is
 * "Show every session", since only the list ever collapses a series.
 */
export function ActiveListView({ rows, today, role, includeHolds, expandSessions, onToggleExpand, from }: ActiveListViewProps) {
  return (
    <div className="flex flex-col gap-4">
      <Toolbar aria-label="Active permits list options">
        <Switch id="active-expand-sessions" checked={expandSessions} onCheckedChange={onToggleExpand} />
        <Label htmlFor="active-expand-sessions" className="normal-case">
          Show every session
        </Label>
      </Toolbar>

      {rows.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title="No active permits"
          text={includeHolds ? "Nothing is permitted, on event day, in closeout, or holding a date." : "Nothing is permitted, on event day or in closeout. Try including held dates."}
        />
      ) : (
        <Table aria-label="Active permits">
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Place</TableHead>
              <TableHead>Date &amp; hours</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Day-of contact</TableHead>
              <TableHead>{ROLE_OVERLAY_COLUMN_LABEL[role]}</TableHead>
              {/* The word is hidden, not the cell: a header taken out of the table's grid heads nothing. */}
              <TableHead>
                <span className="sr-only">Open</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell>
                  <Link
                    href={routes.city.case(row.case.id, { from })}
                    className="outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  >
                    <EventTitle name={row.case.name} applicantName={applicantNameOf(row.case)} />
                  </Link>
                </TableCell>
                <TableCell>
                  <TierBadge tier={row.case.tier} />
                </TableCell>
                <TableCell className="max-w-48 truncate text-sm text-fg-secondary" title={row.case.location?.label}>
                  {row.case.location?.label ?? "Not provided"}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex flex-col gap-0.5">
                    <DateText date={row.date} short />
                    {row.case.schedule ? <span className="text-xs text-fg-secondary">{fmtTimeRange(row.case.schedule.start, row.case.schedule.end)}</span> : null}
                    {row.moreCount > 0 ? <span className="text-xs text-fg-secondary">+{row.moreCount} more</span> : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {row.isHeld ? <HoldStatus hold={row.case.dateHold} /> : <StateChip state={row.case.state} />}
                    {row.holdExpiresTomorrow ? <InlineAlert variant="warning">Expires tomorrow</InlineAlert> : null}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-fg-secondary">{DAY_OF_CONTACT.contactName}</TableCell>
                <TableCell>
                  <RoleOverlayCell role={role} case={row.case} today={today} />
                </TableCell>
                <TableCell>
                  <Button asChild variant="ghost" size="icon-sm" aria-label={`Open ${row.case.name}`}>
                    <Link href={routes.city.case(row.case.id, { from })}>
                      <ChevronRightIcon />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <p className="text-xs text-fg-secondary">{plural(rows.length, "row")}</p>
    </div>
  );
}
