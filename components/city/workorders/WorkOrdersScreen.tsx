"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CountBadge } from "@/components/ui/count-badge";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilterBar, FilterChip } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { useDemo } from "@/lib/state";
import type { Dept, Party } from "@/lib/types";
import {
  WORK_ORDER_KIND_LABEL,
  filterWorkOrders,
  meetingRows,
  parseWorkOrdersFilters,
  todaysClosureCases,
  workOrderRows,
  workOrdersQueryString,
  workOrdersSummary,
  type WorkOrderKind,
  type WorkOrderStatus,
} from "@/lib/view/workOrders";
import { MeetingsTab } from "./MeetingsTab";
import { TodayPanel } from "./TodayPanel";
import { WorkOrdersList } from "./WorkOrdersList";

const STATUS_OPTIONS: WorkOrderStatus[] = ["scheduled", "done"];
const KIND_OPTIONS: WorkOrderKind[] = ["barricades", "police", "closure", "trash", "power"];

function isDept(role: Party): role is Dept {
  return role !== "applicant";
}

/**
 * /city/work-orders, Public Works & Safety's tool (5C): every work order across cases,
 * grouped by event; a Walkthroughs and meetings tab; and, on Event day, a Today panel with
 * the closure checklist. State lives in the URL.
 */
function WorkOrdersScreen() {
  const cases = useDemo((s) => s.cases);
  const today = useDemo((s) => s.demoToday);
  const role = useDemo((s) => s.role);
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const filters = parseWorkOrdersFilters(search);
  const query = workOrdersQueryString(filters);
  const here = query ? `${pathname}?${query}` : pathname;

  function go(next: Partial<typeof filters>) {
    const merged = { ...filters, ...next };
    const nextQuery = workOrdersQueryString(merged);
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }

  if (!isDept(role)) return null;

  const allOrders = workOrderRows(cases, today);
  const filteredOrders = filterWorkOrders(allOrders, { status: filters.status, kind: filters.kind, from: filters.from, to: filters.to });
  const meetings = meetingRows(cases, today);
  const todays = todaysClosureCases(cases, today);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Public Works & Safety"
        title="Work orders"
        description="Barricades, police, closures, trash and power, generated when a case is permitted."
      />

      <TodayPanel cases={todays} here={here} />

      <Tabs value={filters.tab} onValueChange={(tab) => go({ tab: tab as typeof filters.tab })}>
        {/* A list split into sub-lists, like Intake and Payments: the plain tab list, each tab with its count. */}
        <TabsList>
          <TabsTrigger value="orders">
            Work orders
            <CountBadge count={allOrders.filter((row) => row.status !== "done").length} />
          </TabsTrigger>
          <TabsTrigger value="meetings">
            Walkthroughs and meetings
            <CountBadge count={meetings.filter((row) => !row.held).length} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="flex flex-col gap-4 pt-4">
          <p className="text-sm text-fg-secondary">{workOrdersSummary(allOrders, today)}</p>
          <FilterBar
            resultCount={filteredOrders.length}
            resultNoun="work order"
            onClear={filters.status || filters.kind || filters.from || filters.to ? () => go({ status: undefined, kind: undefined, from: undefined, to: undefined }) : undefined}
          >
            {STATUS_OPTIONS.map((status) => (
              <FilterChip key={status} active={filters.status === status} onClick={() => go({ status: filters.status === status ? undefined : status })}>
                {status === "done" ? "Done" : "Scheduled"}
              </FilterChip>
            ))}
            {KIND_OPTIONS.map((kind) => (
              <FilterChip key={kind} active={filters.kind === kind} onClick={() => go({ kind: filters.kind === kind ? undefined : kind })}>
                {WORK_ORDER_KIND_LABEL[kind]}
              </FilterChip>
            ))}
            <Input
              type="date"
              aria-label="Due from"
              value={filters.from ?? ""}
              onChange={(event) => go({ from: event.target.value || undefined })}
              className="h-8 w-36 text-xs"
            />
            <Input
              type="date"
              aria-label="Due to"
              value={filters.to ?? ""}
              onChange={(event) => go({ to: event.target.value || undefined })}
              className="h-8 w-36 text-xs"
            />
          </FilterBar>
          <WorkOrdersList rows={filteredOrders} today={today} here={here} filtered={Boolean(filters.status || filters.kind || filters.from || filters.to)} />
        </TabsContent>

        <TabsContent value="meetings" className="pt-4">
          <MeetingsTab rows={meetings} role={role} today={today} here={here} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { WorkOrdersScreen };
