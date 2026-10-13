"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDemo } from "@/lib/state";
import { routes, type ActiveView } from "@/lib/routes";
import type { Dept, ISODate } from "@/lib/types";
import { activeCalendarItems, activeListRows, activeMapHighlights, blackoutLabelOn, closeoutRows, todayLine } from "@/lib/view/active";
import { ActiveCalendarView, type CalendarSubView } from "./ActiveCalendarView";
import { ActiveCloseoutView } from "./ActiveCloseoutView";
import { ActiveListView } from "./ActiveListView";
import { ActiveMapView } from "./ActiveMapView";
import { TodayStrip } from "./TodayStrip";

const VIEWS: ActiveView[] = ["list", "calendar", "map", "closeout"];

function asView(value: string | null): ActiveView {
  return VIEWS.includes(value as ActiveView) ? (value as ActiveView) : "list";
}

function asCalSub(value: string | null): CalendarSubView {
  return value === "week" ? "week" : "month";
}

/**
 * /city/active, shared by all three city roles. Every case in Permitted, Event day or Closeout,
 * plus a toggle for Quote sent cases holding a date; list, calendar and map views, a Closeout
 * tab, and a role-specific overlay. View, date and the two toggles live in the URL.
 */
export function ActiveScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const cases = useDemo((s) => s.cases);
  const today = useDemo((s) => s.demoToday);
  const party = useDemo((s) => s.role);
  // CityShell renders this screen only for a city role; a direct, unguarded mount (a test that
  // skips the shell) falls back to the Clerk rather than crash on an applicant-only overlay.
  const role: Dept = party === "applicant" ? "clerk" : party;

  const view = asView(searchParams.get("view"));
  const includeHolds = searchParams.get("holds") === "1";
  const expandSessions = searchParams.get("sessions") === "1";
  const calSub = asCalSub(searchParams.get("cal"));
  const date = searchParams.get("date") || today;

  const setParams = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const setView = React.useCallback((next: ActiveView) => setParams({ view: next === "list" ? null : next }), [setParams]);
  const setDate = React.useCallback((next: ISODate) => setParams({ date: next === today ? null : next }), [setParams, today]);
  const setCalSub = React.useCallback((next: CalendarSubView) => setParams({ cal: next === "month" ? null : next }), [setParams]);
  const setIncludeHolds = React.useCallback((next: boolean) => setParams({ holds: next ? "1" : null }), [setParams]);
  const setExpandSessions = React.useCallback((next: boolean) => setParams({ sessions: next ? "1" : null }), [setParams]);
  const openCase = React.useCallback((caseId: string) => router.push(routes.city.case(caseId)), [router]);

  const listRows = React.useMemo(
    () => activeListRows(cases, today, { includeHolds, expandSessions }),
    [cases, today, includeHolds, expandSessions],
  );
  const calendarItems = React.useMemo(() => activeCalendarItems(cases, { includeHolds }), [cases, includeHolds]);
  const mapHighlights = React.useMemo(() => activeMapHighlights(cases, date, { includeHolds }), [cases, date, includeHolds]);
  const closeout = React.useMemo(() => closeoutRows(cases, today), [cases, today]);
  const headline = React.useMemo(() => todayLine(cases, today), [cases, today]);
  const blackoutLabel = blackoutLabelOn(date);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="City"
        title="Active permits"
        description="Every case that is Permitted, on Event day or in Closeout."
        actions={
          <div className="flex items-center gap-2">
            <Switch id="active-include-holds-header" checked={includeHolds} onCheckedChange={setIncludeHolds} />
            <Label htmlFor="active-include-holds-header" className="normal-case">
              Include held dates
            </Label>
          </div>
        }
      />

      <TodayStrip headline={headline} items={calendarItems} today={today} onSelectDay={setDate} onSelectCase={openCase} />

      <Tabs value={view} onValueChange={(v) => setView(v as ActiveView)}>
        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
          <TabsTrigger value="closeout">Closeout</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="pt-4">
          <ActiveListView
            rows={listRows}
            today={today}
            role={role}
            includeHolds={includeHolds}
            expandSessions={expandSessions}
            onToggleExpand={setExpandSessions}
          />
        </TabsContent>

        <TabsContent value="calendar" className="pt-4">
          <ActiveCalendarView
            items={calendarItems}
            cases={cases}
            today={today}
            role={role}
            date={date}
            onDateChange={setDate}
            subView={calSub}
            onSubViewChange={setCalSub}
            onSelectCase={openCase}
          />
        </TabsContent>

        <TabsContent value="map" className="pt-4">
          <ActiveMapView
            highlights={mapHighlights}
            cases={cases}
            today={today}
            role={role}
            date={date}
            onDateChange={setDate}
            blackoutLabel={blackoutLabel}
            onSelectCase={openCase}
          />
        </TabsContent>

        <TabsContent value="closeout" className="pt-4">
          <ActiveCloseoutView rows={closeout} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
