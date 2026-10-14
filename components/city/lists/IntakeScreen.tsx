"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { InboxIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CountBadge } from "@/components/ui/count-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CaseId, DateText, EventTitle, LeadTimeRisk, TierBadge } from "@/components/domain";
import { applicantNameOf } from "@/lib/data/people";
import { useDemo } from "@/lib/state";
import { routes } from "@/lib/routes";
import { plural } from "@/lib/format";
import type { RulesConfig } from "@/lib/rules/types";
import type { EventCase, ISODate } from "@/lib/types";
import { INTAKE_TABS, INTAKE_TAB_LABEL, instantExceptionRows, intakeCounts, intakeRows, type IntakeTab } from "@/lib/view/cityLists";

function isIntakeTab(value: string | null): value is IntakeTab {
  return value === "special" || value === "reviewed" || value === "instant";
}

/** /city/intake, the City Clerk's tool: Special, Standard and Instant exceptions. */
function IntakeScreen() {
  const cases = useDemo((s) => s.cases);
  const today = useDemo((s) => s.demoToday);
  const cfg = useDemo((s) => s.cfg);
  const dispatch = useDemo((s) => s.dispatch);
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const tabParam = search.get("tab");
  const tab: IntakeTab = isIntakeTab(tabParam) ? tabParam : "special";
  const counts = intakeCounts(cases);
  // A case opened from here comes back to this tab.
  const query = search.toString();
  const here = query ? `${pathname}?${query}` : pathname;

  function setTab(next: string) {
    const qs = new URLSearchParams();
    if (next !== "special") qs.set("tab", next);
    router.replace(qs.toString() ? `${pathname}?${qs.toString()}` : pathname);
  }

  function accept(caseId: string) {
    const result = dispatch(caseId, { type: "accept_complete" });
    if (!result.ok) {
      toast.error(result.reason ?? "That could not be accepted.");
      return;
    }
    toast.success("Accepted as complete; the date is held.");
    // The row leaves this table, and what comes next is the Clerk's too: straight on to the
    // case, where the header reads "Date held" and Confirm routing is open.
    router.push(routes.city.case(caseId, { task: "confirm_routing", from: here }));
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="City Clerk" title="Intake queue" description="Every application waiting to be accepted as complete, and the Instant exceptions after closeout." />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {INTAKE_TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {INTAKE_TAB_LABEL[t]}
              <CountBadge count={counts[t]} />
            </TabsTrigger>
          ))}
        </TabsList>

        {(["special", "reviewed"] as const).map((t) => (
          <TabsContent key={t} value={t} className="pt-2">
            <IntakeTabTable tab={t} cases={cases} today={today} cfg={cfg} onAccept={accept} from={here} />
          </TabsContent>
        ))}

        <TabsContent value="instant" className="pt-2">
          <InstantExceptionsTable cases={cases} today={today} from={here} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function IntakeTabTable({
  tab,
  cases,
  today,
  cfg,
  onAccept,
  from,
}: {
  tab: Exclude<IntakeTab, "instant">;
  cases: EventCase[];
  today: ISODate;
  cfg: RulesConfig;
  onAccept: (id: string) => void;
  from: string;
}) {
  const rows = intakeRows(cases, tab, today, cfg);

  if (rows.length === 0) {
    return <EmptyState icon={InboxIcon} title="Nothing waiting" text={`No ${INTAKE_TAB_LABEL[tab].toLowerCase()} applications are waiting at intake.`} />;
  }

  return (
    <Table aria-label={`${INTAKE_TAB_LABEL[tab]} applications at intake`}>
      <TableHeader>
        <TableRow>
          <TableHead>Event</TableHead>
          <TableHead>Tier</TableHead>
          <TableHead>Event date</TableHead>
          <TableHead>Submitted</TableHead>
          <TableHead>Days in intake</TableHead>
          <TableHead>Complete</TableHead>
          <TableHead>Competing application</TableHead>
          <TableHead>Lead time</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const { case: c } = row;
          return (
            <TableRow key={c.id}>
              <TableCell>
                <CaseLink c={c} from={from} />
              </TableCell>
              <TableCell>
                <TierBadge tier={c.tier} />
              </TableCell>
              <TableCell numeric>{c.schedule ? <DateText date={c.schedule.date} short /> : "No date yet"}</TableCell>
              <TableCell numeric>{c.submittedAt ? <DateText date={c.submittedAt.slice(0, 10)} short /> : "—"}</TableCell>
              <TableCell numeric>{plural(row.daysInIntake, "day")}</TableCell>
              <TableCell>
                {row.completeness.done} of {row.completeness.total} {row.completeness.unit}
              </TableCell>
              <TableCell>{row.competing ? <span className="text-danger-fg">{row.competing.reason}</span> : <span className="text-fg-secondary">None</span>}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <LeadTimeRisk risk={row.risk} />
                  {row.risk === "ok" ? <span className="text-xs text-fg-secondary">On track</span> : null}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col items-start gap-1.5">
                  {/* One of each per row: the name says which application, and the reason it cannot be accepted is its description. */}
                  <Button
                    size="sm"
                    disabled={!row.accept.enabled}
                    aria-label={`Accept as complete: ${c.name}`}
                    aria-describedby={!row.accept.enabled && row.accept.reason ? `intake-reason-${c.id}` : undefined}
                    onClick={() => onAccept(c.id)}
                  >
                    Accept as complete
                  </Button>
                  {!row.accept.enabled && row.accept.reason ? (
                    <p id={`intake-reason-${c.id}`} className="max-w-40 text-xs whitespace-normal text-danger-fg">
                      {row.accept.reason}
                    </p>
                  ) : null}
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={routes.city.case(c.id, { task: "request_info", from })} aria-label={`Request information: ${c.name}`}>
                      Request information
                    </Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** A row's identity cell: the event over its applicant, then the id, all one link to the case. */
function CaseLink({ c, from }: { c: EventCase; from: string }) {
  return (
    <Link
      href={routes.city.case(c.id, { from })}
      className="flex w-fit flex-col rounded-control outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
    >
      <EventTitle name={c.name} applicantName={applicantNameOf(c)} className="max-w-56" />
      <CaseId id={c.id} />
    </Link>
  );
}

function InstantExceptionsTable({ cases, today, from }: { cases: EventCase[]; today: ISODate; from: string }) {
  const rows = instantExceptionRows(cases, today);

  if (rows.length === 0) {
    return <EmptyState icon={InboxIcon} title="Nothing to resolve" text="No Instant events are waiting on a closeout exception." />;
  }

  return (
    <Table aria-label="Instant events with a closeout exception">
      <TableHeader>
        <TableRow>
          <TableHead>Event</TableHead>
          <TableHead>Event date</TableHead>
          <TableHead>Days in closeout</TableHead>
          <TableHead>Exception</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ case: c, task, daysInCloseout }) => (
          <TableRow key={c.id}>
            <TableCell>
              <CaseLink c={c} from={from} />
            </TableCell>
            <TableCell numeric>{c.schedule ? <DateText date={c.schedule.date} short /> : "No date yet"}</TableCell>
            <TableCell numeric>{plural(daysInCloseout, "day")}</TableCell>
            <TableCell>
              <Button size="sm" variant="secondary" asChild>
                <Link href={routes.city.case(c.id, { task: task?.id, from })} aria-label={`${task?.title ?? "Resolve"}: ${c.name}`}>
                  {task?.title ?? "Resolve"}
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export { IntakeScreen };
