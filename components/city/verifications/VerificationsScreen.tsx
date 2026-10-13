"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { FileCheckIcon } from "lucide-react"
import { CountBadge } from "@/components/ui/count-badge"
import { PageHeader } from "@/components/ui/page-header"
import { FilterBar, FilterChip } from "@/components/ui/filter-bar"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { CaseId, DateText, DueDate, EventTitle } from "@/components/domain"
import { useDemo } from "@/lib/state"
import { routes } from "@/lib/routes"
import { plural } from "@/lib/format"
import { PARTY_LABEL, type Dept, type Party } from "@/lib/types"
import {
  buildDecidedQueue,
  buildVerificationQueue,
  DOC_TYPE_LABEL,
  filterDecidedRows,
  filterQueueRows,
  groupQueueRowsByEvent,
  groupQueueRowsByType,
  oldestWaitingRow,
  parseVerificationsFilters,
  verificationsQueryString,
  type DecidedRow,
  type DocTypeGroup,
  type QueueGroupBy,
  type VerificationQueueRow,
  type VerificationsFilters,
} from "@/lib/view/verifications"

function isDept(role: Party): role is Dept {
  return role !== "applicant"
}

/** This page's own URL, with its filters, for `from`: a row's case comes back here. */
function hereHref(pathname: string, filters: VerificationsFilters): string {
  const qs = verificationsQueryString(filters)
  return qs ? `${pathname}?${qs}` : pathname
}

function caseHref(row: { caseId: string; taskId: string }, from: string): string {
  return routes.city.case(row.caseId, { tab: "documents", task: `verify_document:${row.taskId}`, from })
}

function QueueRow({ row, from, today }: { row: VerificationQueueRow; from: string; today: string }) {
  return (
    <li>
      <Link
        href={caseHref(row, from)}
        className="flex flex-col gap-2 rounded-panel border border-line-subtle bg-surface-1 p-3 outline-none transition-colors duration-[var(--dur-fast)] ease-frost hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <EventTitle name={row.caseName} applicantName={row.applicantName} className="min-w-0" />
            <CaseId id={row.caseId} />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-1 sm:w-56">
          <p className="truncate text-sm font-medium text-fg">{row.title}</p>
          <p className="truncate text-xs text-fg-secondary">
            {row.vendorName ? `${row.vendorName} · ` : ""}
            {DOC_TYPE_LABEL[row.typeGroup]}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Badge variant={row.allPass ? "success" : "danger"}>{row.summary}</Badge>
          {row.dueDate ? <DueDate date={row.dueDate} today={today} relativeOnly /> : null}
          <span className="text-xs text-fg-secondary">{plural(row.daysWaiting ?? 0, "day")} waiting</span>
        </div>
      </Link>
    </li>
  )
}

/** A decided document is a row like a waiting one: it opens its case on the Documents tab, and the case comes back here. */
function DecidedRowItem({ row, from }: { row: DecidedRow; from: string }) {
  return (
    <li>
      <Link
        href={routes.city.case(row.caseId, { tab: "documents", from })}
        className="flex flex-col gap-2 rounded-panel border border-line-subtle bg-surface-1 p-3 outline-none transition-colors duration-[var(--dur-fast)] ease-frost hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring sm:flex-row sm:items-center sm:justify-between"
      >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <EventTitle name={row.caseName} applicantName={row.applicantName} className="min-w-0" />
          <CaseId id={row.caseId} />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-1 sm:w-56">
        <p className="truncate text-sm font-medium text-fg">{row.title}</p>
        <p className="truncate text-xs text-fg-secondary">{row.vendorName ? `${row.vendorName} · ` : ""}{DOC_TYPE_LABEL[row.typeGroup]}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Badge variant={row.verb === "Verified" ? "success" : "warning"}>{row.verb}</Badge>
        <span className="text-xs text-fg-secondary">
          <DateText date={row.decidedOn} />
          {row.decidedBy ? ` · ${PARTY_LABEL[row.decidedBy]}` : ""}
        </span>
      </div>
      </Link>
    </li>
  )
}

const TYPE_OPTIONS: DocTypeGroup[] = ["insurance", "health_permits", "accessibility", "other"]

/**
 * /city/verifications, Health & Legal's tool (workstream 5D): one queue of documents waiting
 * for a check, across every case, grouped by document type or by event, with a "Recently
 * decided" tab. A row opens the case at that document's verification panel.
 */
function VerificationsScreen() {
  const cases = useDemo((s) => s.cases)
  const today = useDemo((s) => s.demoToday)
  const role = useDemo((s) => s.role)
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()

  if (!isDept(role) || role !== "hl") return null

  const filters = parseVerificationsFilters(search)
  const from = hereHref(pathname, filters)

  function setFilters(next: Partial<VerificationsFilters>) {
    const merged: VerificationsFilters = { ...filters, ...next }
    const qs = verificationsQueryString(merged)
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  const allQueueRows = buildVerificationQueue(cases, role, today)
  const queueRows = filterQueueRows(allQueueRows, filters)
  const decidedRows = filterDecidedRows(buildDecidedQueue(cases, role), filters)
  const nextUp = oldestWaitingRow(allQueueRows)

  const typeGroups = groupQueueRowsByType(queueRows)
  const eventGroups = groupQueueRowsByEvent(queueRows)

  const hasNarrowing = filters.type !== "all" || filters.result !== "all" || filters.overdue || filters.q !== ""

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Health & Legal"
        title="Verifications"
        description="Every document waiting on your check, across all cases."
        actions={
          nextUp ? (
            <Button asChild size="sm">
              <Link href={caseHref(nextUp, from)}>Verify the next one</Link>
            </Button>
          ) : undefined
        }
      />

      <Tabs value={filters.tab} onValueChange={(v) => setFilters({ tab: v === "decided" ? "decided" : "queue" })}>
        {/* A list split into sub-lists, like Intake and Payments: the plain tab list, each tab with its count. */}
        <TabsList>
          <TabsTrigger value="queue">
            Queue
            <CountBadge count={allQueueRows.length} />
          </TabsTrigger>
          <TabsTrigger value="decided">Recently decided</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="pt-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <FilterBar
                className="flex-1"
                searchValue={filters.q}
                onSearchChange={(q) => setFilters({ q })}
                searchPlaceholder="Search event, applicant or vendor"
                resultCount={queueRows.length}
                resultNoun="document"
                onClear={hasNarrowing && queueRows.length > 0 ? () => setFilters({ type: "all", result: "all", overdue: false, q: "" }) : undefined}
              >
                <FilterChip active={filters.result === "fail"} onClick={() => setFilters({ result: filters.result === "fail" ? "all" : "fail" })}>
                  Has a failing item
                </FilterChip>
                <FilterChip active={filters.overdue} onClick={() => setFilters({ overdue: !filters.overdue })}>
                  Overdue
                </FilterChip>
              </FilterBar>
              <SegmentedControl<QueueGroupBy>
                aria-label="Group by"
                value={filters.group}
                onChange={(group) => setFilters({ group })}
                options={[
                  { value: "type", label: "By type" },
                  { value: "event", label: "By event" },
                ]}
              />
            </div>

            {filters.group === "type" ? (
              <div role="group" aria-label="Document type" className="flex flex-wrap gap-2">
                <FilterChip active={filters.type === "all"} onClick={() => setFilters({ type: "all" })}>
                  All types
                </FilterChip>
                {TYPE_OPTIONS.map((type) => (
                  <FilterChip key={type} active={filters.type === type} onClick={() => setFilters({ type: filters.type === type ? "all" : type })}>
                    {DOC_TYPE_LABEL[type]}
                  </FilterChip>
                ))}
              </div>
            ) : null}

            {queueRows.length === 0 ? (
              <EmptyState
                icon={FileCheckIcon}
                title={allQueueRows.length === 0 ? "Nothing is waiting on you" : "No documents match these filters"}
                text={
                  allQueueRows.length === 0
                    ? "Every submitted document has already been checked."
                    : "Try a different type, or clear the filters."
                }
                action={
                  allQueueRows.length > 0 && hasNarrowing ? (
                    <Button variant="secondary" size="sm" onClick={() => setFilters({ type: "all", result: "all", overdue: false, q: "" })}>
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            ) : filters.group === "type" ? (
              <div className="flex flex-col gap-6">
                {typeGroups.map((group) => (
                  <section key={group.type} className="flex flex-col gap-2">
                    <h2 className="flex items-center gap-2 text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">
                      {DOC_TYPE_LABEL[group.type]}
                      <CountBadge count={group.rows.length} />
                    </h2>
                    <ul className="flex flex-col gap-2">
                      {group.rows.map((row) => (
                        <QueueRow key={row.taskId} row={row} from={from} today={today} />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {eventGroups.map((group) => (
                  <section key={group.caseId} className="flex flex-col gap-2">
                    <h2 className="flex items-center gap-2 text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">
                      {group.caseName}
                      <CountBadge count={group.rows.length} />
                    </h2>
                    <ul className="flex flex-col gap-2">
                      {group.rows.map((row) => (
                        <QueueRow key={row.taskId} row={row} from={from} today={today} />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="decided" className="pt-5">
          {decidedRows.length === 0 ? (
            <EmptyState icon={FileCheckIcon} title="Nothing decided yet" text="Documents you verify or send back will show up here." />
          ) : (
            <ul className="flex flex-col gap-2">
              {decidedRows.map((row) => (
                <DecidedRowItem key={row.taskId} row={row} from={from} />
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export { VerificationsScreen }
