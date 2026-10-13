"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ClipboardCheckIcon } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Section } from "@/components/ui/section"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { CaseId, DateText, EventTitle, TierBadge } from "@/components/domain"
import { useDemo } from "@/lib/state"
import { routes } from "@/lib/routes"
import type { Dept, Party } from "@/lib/types"
import {
  buildInspectionGroups,
  formatInspectionNote,
  groupsByBucket,
  INSPECTION_RESULTS,
  RESULT_LABEL,
  type BoothRow,
  type InspectionEventGroup,
  type InspectionResult,
} from "@/lib/view/inspections"

function isDept(role: Party): role is Dept {
  return role !== "applicant"
}

const RESULT_BADGE: Record<InspectionResult, "success" | "danger" | "warning"> = {
  pass: "success",
  fail: "danger",
  "re-inspect": "warning",
};

function BoothCard({ caseId, booth }: { caseId: string; booth: BoothRow }) {
  const dispatch = useDemo((s) => s.dispatch)
  const [result, setResult] = React.useState<InspectionResult>(booth.result ?? "pass")
  const [note, setNote] = React.useState("")

  function record() {
    const text = formatInspectionNote(booth.vendorName, result, note)
    const outcome = dispatch(caseId, { type: "add_note", text })
    if (!outcome.ok) {
      toast.error(outcome.reason ?? "That could not be recorded.")
      return
    }
    toast.success("Recorded.")
    setNote("")
  }

  return (
    <div className="flex flex-col gap-3 rounded-panel border border-line-subtle bg-surface-1 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-fg">{booth.vendorName}</span>
        {booth.result ? <Badge variant={RESULT_BADGE[booth.result]}>{RESULT_LABEL[booth.result]}</Badge> : <Badge variant="secondary">Not inspected</Badge>}
      </div>
      {booth.result ? (
        <p className="text-xs text-fg-secondary">
          {booth.recordedAt ? <DateText date={booth.recordedAt} /> : null}
          {booth.note ? ` · ${booth.note}` : ""}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <select
          aria-label={`Result for ${booth.vendorName}`}
          value={result}
          onChange={(event) => setResult(event.target.value as InspectionResult)}
          className="h-9 shrink-0 rounded-control border border-line-subtle bg-surface-strong px-2.5 text-sm text-fg outline-none focus-visible:border-focus-ring focus-visible:shadow-focus-halo"
        >
          {INSPECTION_RESULTS.map((value) => (
            <option key={value} value={value}>
              {RESULT_LABEL[value]}
            </option>
          ))}
        </select>
        <Textarea
          aria-label={`Note for ${booth.vendorName}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Note (optional)"
          className="min-h-9 flex-1 py-2 text-sm"
          rows={1}
        />
        <Button type="button" size="sm" onClick={record}>
          Record
        </Button>
      </div>
    </div>
  )
}

function EventGroupCard({ group }: { group: InspectionEventGroup }) {
  return (
    <div className="flex flex-col gap-3 rounded-panel border border-line-subtle bg-surface-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* The event as every list names one: its name over its applicant, the id and the tier. */}
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={routes.city.case(group.caseId, { from: routes.city.inspections() })}
            className="min-w-0 rounded-control outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <EventTitle name={group.caseName} applicantName={group.applicantName} className="min-w-0" />
          </Link>
          <CaseId id={group.caseId} />
          <TierBadge tier={group.tier} />
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-fg-secondary">
          <span>Event day</span>
          <DateText date={group.eventDate} short />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {group.booths.map((booth) => (
          <BoothCard key={booth.vendorTaskId} caseId={group.caseId} booth={booth} />
        ))}
      </div>
    </div>
  )
}

/**
 * /city/inspections, Health & Legal's tool (workstream 5D, P2): day-of food booth inspections
 * by event, for each event with vendors on its event day and the next 14 days. There is no
 * engine storage for an inspection: a result is written as a fixed, readable activity note and
 * read back from the case's own log (lib/view/inspections.ts).
 */
function InspectionsScreen() {
  const cases = useDemo((s) => s.cases)
  const today = useDemo((s) => s.demoToday)
  const role = useDemo((s) => s.role)

  if (!isDept(role) || role !== "hl") return null

  const groups = buildInspectionGroups(cases, today)
  const { today: todayGroups, upcoming: upcomingGroups } = groupsByBucket(groups)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Health & Legal" title="Inspections" description="Day-of food booth inspections, by event." />

      {groups.length === 0 ? (
        <EmptyState
          icon={ClipboardCheckIcon}
          title="No food booths to inspect"
          text="Events with food vendors on their day, or in the next 14 days, will show up here."
        />
      ) : (
        <div className="flex flex-col gap-8">
          {todayGroups.length > 0 ? (
            <Section title="Today" description="Events with food vendors on their day.">
              <div className="flex flex-col gap-4">
                {todayGroups.map((group) => (
                  <EventGroupCard key={group.caseId} group={group} />
                ))}
              </div>
            </Section>
          ) : null}
          {upcomingGroups.length > 0 ? (
            <Section title="Upcoming" description="Events with food vendors in the next 14 days.">
              <div className="flex flex-col gap-4">
                {upcomingGroups.map((group) => (
                  <EventGroupCard key={group.caseId} group={group} />
                ))}
              </div>
            </Section>
          ) : null}
        </div>
      )}
    </div>
  )
}

export { InspectionsScreen }
