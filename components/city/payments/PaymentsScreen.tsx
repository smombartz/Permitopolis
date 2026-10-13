"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDownIcon, ChevronRightIcon, InboxIcon, ReceiptIcon, Undo2Icon } from "lucide-react";
import { CaseId, DueDate, EventTitle, Money } from "@/components/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CountBadge } from "@/components/ui/count-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtDateShort, fmtMoney, plural } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useDemo } from "@/lib/state";
import type { ISODate } from "@/lib/types";
import {
  dueRows,
  dueTotal,
  filterReceivedRows,
  groupReceivedRows,
  matchesPaymentsQuery,
  paymentsSummary,
  receivedRows,
  receivedTotal,
  refundsIssuedRows,
  refundsIssuedTotal,
  refundsOwedRows,
  refundsOwedTotal,
  type DueRow,
  type PaymentsTab,
  type ReceivedFilters,
  type ReceivedGroup,
  type RefundIssuedRow,
  type RefundOwedRow,
} from "@/lib/view/payments";

const SELECT_CLASS =
  "h-8 shrink-0 rounded-control border border-line-subtle bg-surface-strong px-2.5 text-xs text-fg outline-none focus-visible:border-focus-ring focus-visible:shadow-focus-halo";

function isTab(value: string | null): value is PaymentsTab {
  return value === "due" || value === "received" || value === "refunds";
}

function isMethod(value: string | null): value is "card" | "in_person" {
  return value === "card" || value === "in_person";
}

/**
 * /city/payments, the City Clerk's tool: three tabs kept in the URL (Due, Received, Refunds),
 * each with a count and a total, plus a header summary and a search by event, applicant or
 * case id (PRD "City Clerk views", Payments; also Licenses and Consultation's money, which stay
 * ordinary quote and fee lines here, with no tab of their own).
 */
export function PaymentsScreen() {
  const cases = useDemo((s) => s.cases);
  const today = useDemo((s) => s.demoToday);
  const cfg = useDemo((s) => s.cfg);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab: PaymentsTab = isTab(searchParams.get("tab")) ? (searchParams.get("tab") as PaymentsTab) : "due";
  const q = searchParams.get("q") ?? "";
  const method = isMethod(searchParams.get("method")) ? (searchParams.get("method") as "card" | "in_person") : undefined;
  const start = searchParams.get("start") ?? undefined;
  const end = searchParams.get("end") ?? undefined;

  // A case opened from here comes back to this tab, search and filters.
  const query = searchParams.toString();
  const here = query ? `${pathname}?${query}` : pathname;

  const setParams = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const nextQuery = next.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const setTab = React.useCallback((next: string) => setParams({ tab: next === "due" ? null : next }), [setParams]);
  const setQuery = React.useCallback((next: string) => setParams({ q: next || null }), [setParams]);
  const setMethod = React.useCallback((next: string) => setParams({ method: next || null }), [setParams]);
  const setStart = React.useCallback((next: string) => setParams({ start: next || null }), [setParams]);
  const setEnd = React.useCallback((next: string) => setParams({ end: next || null }), [setParams]);

  const due = React.useMemo(
    () => dueRows(cases, today, cfg).filter((r) => matchesPaymentsQuery(r.eventName, r.applicantName, r.caseId, q)),
    [cases, today, cfg, q],
  );
  const allReceived = React.useMemo(() => receivedRows(cases), [cases]);
  const filteredReceived = React.useMemo(() => {
    const byFilters = filterReceivedRows(allReceived, { method, from: start, to: end } satisfies ReceivedFilters);
    return byFilters.filter((r) => matchesPaymentsQuery(r.eventName, r.applicantName, r.caseId, q));
  }, [allReceived, method, start, end, q]);
  const receivedGroups = React.useMemo(() => groupReceivedRows(filteredReceived, cases), [filteredReceived, cases]);
  const issued = React.useMemo(
    () => refundsIssuedRows(cases).filter((r) => matchesPaymentsQuery(r.eventName, r.applicantName, r.caseId, q)),
    [cases, q],
  );
  const owed = React.useMemo(
    () => refundsOwedRows(cases).filter((r) => matchesPaymentsQuery(r.eventName, r.applicantName, r.caseId, q)),
    [cases, q],
  );
  const summary = React.useMemo(() => paymentsSummary(cases, today, cfg), [cases, today, cfg]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="City Clerk"
        title="Payments"
        description="Every amount due, every payment received, and every refund issued or owed."
      />

      <div className="grid grid-cols-1 gap-4 rounded-panel border border-line-subtle bg-surface-1 p-4 sm:grid-cols-3">
        <Stat label="Collected this month" value={fmtMoney(summary.collectedThisMonth)} />
        <Stat label="Outstanding" value={fmtMoney(summary.outstanding)} />
        <Stat label="Refunds issued this month" value={fmtMoney(summary.refundsIssuedThisMonth)} />
      </div>

      <FilterBar searchValue={q} onSearchChange={setQuery} searchPlaceholder="Search event, applicant or case id" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="due">
            Due
            <CountBadge count={due.length} />
          </TabsTrigger>
          <TabsTrigger value="received">
            Received
            <CountBadge count={filteredReceived.length} />
          </TabsTrigger>
          <TabsTrigger value="refunds">
            Refunds
            <CountBadge count={issued.length + owed.length} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="due" className="pt-4">
          <DueTable rows={due} today={today} from={here} query={q} />
        </TabsContent>

        <TabsContent value="received" className="pt-4">
          <div className="flex flex-col gap-4">
            <FilterBar>
              <select aria-label="Method" value={method ?? ""} onChange={(e) => setMethod(e.target.value)} className={SELECT_CLASS}>
                <option value="">Any method</option>
                <option value="card">Card</option>
                <option value="in_person">In person</option>
              </select>
              <input aria-label="From date" type="date" value={start ?? ""} onChange={(e) => setStart(e.target.value)} className={SELECT_CLASS} />
              <input aria-label="To date" type="date" value={end ?? ""} onChange={(e) => setEnd(e.target.value)} className={SELECT_CLASS} />
              {method || start || end ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMethod("");
                    setStart("");
                    setEnd("");
                  }}
                >
                  Clear filters
                </Button>
              ) : null}
            </FilterBar>
            <ReceivedTable groups={receivedGroups} total={receivedTotal(filteredReceived)} from={here} query={q} hasFilters={Boolean(method || start || end)} />
          </div>
        </TabsContent>

        <TabsContent value="refunds" className="pt-4">
          <RefundsTable issued={issued} owed={owed} from={here} query={q} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------- */
/* Due                                                                                        */
/* ---------------------------------------------------------------------------------------- */

function DueTable({ rows, today, from, query }: { rows: DueRow[]; today: ISODate; from: string; query: string }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={InboxIcon}
        title="Nothing is due"
        text={query ? `No amount due matches "${query}".` : "No quote, session or final bill is waiting on a payment."}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>For</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className="sr-only">Record payment</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell>
                <Link href={routes.city.case(row.caseId, { from })} className="outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
                  <EventTitle name={row.eventName} applicantName={row.applicantName} />
                </Link>
                <CaseId id={row.caseId} />
              </TableCell>
              <TableCell className="text-sm text-fg-secondary">
                {row.label}
                {row.kind === "quote" && row.holdExpiresOn ? <div className="text-xs">Holds the date until {fmtDateShort(row.holdExpiresOn)}</div> : null}
              </TableCell>
              <TableCell numeric>
                <Money amount={row.amount} />
              </TableCell>
              <TableCell>{row.dueDate ? <DueDate date={row.dueDate} today={today} /> : <span className="text-sm text-fg-secondary">Not provided</span>}</TableCell>
              <TableCell>
                <Button asChild variant="secondary" size="sm">
                  <Link href={routes.city.case(row.caseId, { task: "pay", from })}>Record payment</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-fg-secondary">
        {plural(rows.length, "row")} · {fmtMoney(dueTotal(rows))} total
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------- */
/* Received                                                                                  */
/* ---------------------------------------------------------------------------------------- */

function ReceivedTable({ groups, total, from, query, hasFilters }: { groups: ReceivedGroup[]; total: number; from: string; query: string; hasFilters: boolean }) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  function toggle(caseId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) next.delete(caseId);
      else next.add(caseId);
      return next;
    });
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={ReceiptIcon}
        title="No payments match"
        text={query || hasFilters ? "Try a different method, date range or search." : "No payment has been received yet."}
      />
    );
  }

  const rowCount = groups.reduce((sum, g) => sum + g.rows.length, 0);

  return (
    <div className="flex flex-col gap-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>For</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => {
            const isOpen = expanded.has(group.caseId);
            const collapse = group.isSeries && !isOpen;
            return (
              <React.Fragment key={group.caseId}>
                <TableRow>
                  <TableCell>
                    <Link href={routes.city.case(group.caseId, { from })} className="outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
                      <EventTitle name={group.eventName} applicantName={group.applicantName} />
                    </Link>
                    <CaseId id={group.caseId} />
                  </TableCell>
                  {collapse ? (
                    <>
                      <TableCell colSpan={3} className="text-sm text-fg-secondary">
                        <button
                          type="button"
                          onClick={() => toggle(group.caseId)}
                          className="flex items-center gap-1 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                        >
                          <ChevronRightIcon className="size-3.5" aria-hidden="true" />
                          {group.seriesSummary}
                        </button>
                      </TableCell>
                      <TableCell numeric>
                        <Money amount={group.rows.reduce((s, r) => s + r.amount, 0)} />
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="text-sm text-fg-secondary">{group.rows[0].label}</TableCell>
                      <TableCell>
                        <span className="text-sm text-fg-secondary">{fmtDateShort(group.rows[0].at.slice(0, 10))}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{group.rows[0].method === "card" ? "Card" : "In person"}</Badge>
                      </TableCell>
                      <TableCell numeric>
                        <Money amount={group.rows[0].amount} />
                      </TableCell>
                    </>
                  )}
                </TableRow>
                {group.isSeries && isOpen
                  ? group.rows.map((row) => (
                      <TableRow key={row.key} className="bg-surface-2/40">
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => toggle(group.caseId)}
                            className="flex items-center gap-1 pl-4 text-xs text-fg-secondary outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                          >
                            <ChevronDownIcon className="size-3.5" aria-hidden="true" />
                            Collapse
                          </button>
                        </TableCell>
                        <TableCell className="text-sm text-fg-secondary">{row.label}</TableCell>
                        <TableCell>
                          <span className="text-sm text-fg-secondary">{fmtDateShort(row.at.slice(0, 10))}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.method === "card" ? "Card" : "In person"}</Badge>
                        </TableCell>
                        <TableCell numeric>
                          <Money amount={row.amount} />
                        </TableCell>
                      </TableRow>
                    ))
                  : null}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
      <p className="text-xs text-fg-secondary">
        {plural(rowCount, "payment")} · {fmtMoney(total)} total
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------- */
/* Refunds                                                                                   */
/* ---------------------------------------------------------------------------------------- */

function RefundsTable({
  issued,
  owed,
  from,
  query,
}: {
  issued: RefundIssuedRow[];
  owed: RefundOwedRow[];
  from: string;
  query: string;
}) {
  if (issued.length === 0 && owed.length === 0) {
    return (
      <EmptyState
        icon={Undo2Icon}
        title="No refunds"
        text={query ? `No refund matches "${query}".` : "Nothing has been cancelled, withdrawn or closed out with a refund yet."}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-fg">Owed</h3>
        {owed.length === 0 ? (
          <p className="text-sm text-fg-secondary">Nothing is waiting to be refunded.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {owed.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>
                    <Link href={routes.city.case(row.caseId, { from })} className="outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
                      <EventTitle name={row.eventName} applicantName={row.applicantName} />
                    </Link>
                    <CaseId id={row.caseId} />
                  </TableCell>
                  <TableCell className="text-sm text-fg-secondary">{row.rule}</TableCell>
                  <TableCell numeric>
                    <Money amount={row.amount} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="text-xs text-fg-secondary">
          {plural(owed.length, "case")} · {fmtMoney(refundsOwedTotal(owed))} total
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-fg">Issued</h3>
        {issued.length === 0 ? (
          <p className="text-sm text-fg-secondary">No refund has gone out yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issued.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>
                    <Link href={routes.city.case(row.caseId, { from })} className="outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
                      <EventTitle name={row.eventName} applicantName={row.applicantName} />
                    </Link>
                    <CaseId id={row.caseId} />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-fg-secondary">{fmtDateShort(row.at.slice(0, 10))}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.method === "card" ? "Card" : "In person"}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-fg-secondary">{row.rule}</TableCell>
                  <TableCell numeric>
                    <Money amount={row.amount} signColor />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="text-xs text-fg-secondary">
          {plural(issued.length, "refund")} · {fmtMoney(refundsIssuedTotal(issued))} total
        </p>
      </div>
    </div>
  );
}
