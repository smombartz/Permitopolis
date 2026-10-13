"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Section } from "@/components/ui/section"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"
import { FilterChip } from "@/components/ui/filter-bar"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Progress } from "@/components/ui/progress"
import { FormAnswers, TaskKindLabel } from "@/components/domain"
import { FileQuestionIcon } from "lucide-react"
import { fmtDate, fmtFileSize, plural } from "@/lib/format"
import { useDemo } from "@/lib/state"
import { PARTY_LABEL, type EventCase, type ISODate, type Party, type Task, type TaskStatus } from "@/lib/types"
import { documentGroups } from "@/lib/view/caseDetail"
import {
  canActOn,
  daysWaiting,
  decidedOn,
  groupDocumentsForDisplay,
  groupStartsOpen,
  orderGroupsForViewer,
  rowNeedsViewerCheck,
  sortDocumentRowsForViewer,
  submittedOn,
  type DocumentRow,
} from "@/lib/view/verify"
import { vendorPermitGroup } from "@/lib/view/vendors"
import { VendorsSection } from "@/components/case/vendors/VendorsSection"

const STATUS_BADGE: Record<TaskStatus, { variant: "secondary" | "default" | "warning" | "success"; text: string }> = {
  locked: { variant: "secondary", text: "Locked" },
  todo: { variant: "secondary", text: "Not yet provided" },
  submitted: { variant: "default", text: "Submitted" },
  changes_requested: { variant: "warning", text: "Changes requested" },
  done: { variant: "success", text: "Verified" },
}

/** "Submitted Fri, Apr 30 · waiting 3 days" or what became of a decided card, from its own history. */
function HistoryLine({ task, today }: { task: Task; today: ISODate }) {
  const decided = decidedOn(task)
  if (decided) return <p className="text-xs text-fg-label">{decided.verb} {fmtDate(decided.date)}.</p>
  const on = submittedOn(task)
  if (!on) return null
  const waiting = daysWaiting(task, today)
  return (
    <p className="text-xs text-fg-label">
      Submitted {fmtDate(on)}{waiting !== null ? ` · waiting ${plural(waiting, "day")}` : ""}
    </p>
  )
}

function RequestThread({ task }: { task: Task }) {
  if (!task.request) return null
  return (
    <p className="text-xs text-fg-secondary">
      <span className="font-semibold text-fg">{PARTY_LABEL[task.request.from]} asked:</span> {task.request.message}
      {task.request.resolved ? null : " (waiting on the applicant)"}
    </p>
  )
}

function DocumentCard({ task, role, today, onOpen }: { task: Task; role: Party; today: ISODate; onOpen: (key: string) => void }) {
  const files = task.payload.files ?? []
  const badge = STATUS_BADGE[task.status]
  const canAct = canActOn(task, role)
  const readOnly = task.reviewer !== null && task.reviewer !== role

  return (
    <div data-testid={`document-card-${task.id}`} className="flex flex-col gap-2.5 rounded-panel border border-line-subtle bg-surface-1 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TaskKindLabel kind={task.kind} />
          <span className="text-sm font-semibold text-fg">{task.title}</span>
        </div>
        <Badge variant={badge.variant}>{badge.text}</Badge>
      </div>
      <p className="text-xs text-fg-secondary">
        {task.reviewer ? `Checked by ${PARTY_LABEL[task.reviewer]}${readOnly ? " (not yours to check)" : ""}` : "Nobody has to check this card"}
      </p>
      <HistoryLine task={task} today={today} />
      {files.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between gap-3 rounded-control border border-line-subtle bg-surface-2 px-2.5 py-1.5 text-xs">
              <span className="min-w-0 truncate text-fg">{f.name}</span>
              <span className="shrink-0 font-mono text-fg-label">
                {fmtFileSize(f.size)} &middot; {f.type || "unknown type"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <FormAnswers task={task} size="xs" />
      <RequestThread task={task} />
      {task.status === "changes_requested" && task.payload.rejectedReason ? (
        <p className="text-xs text-fg-secondary">
          <span className="font-semibold text-fg">Sent back:</span> {String(task.payload.rejectedReason)}
        </p>
      ) : null}
      {canAct ? (
        <div className="flex items-center gap-2 pt-1">
          <Button type="button" size="sm" onClick={() => onOpen(`verify_document:${task.id}`)}>
            Verify
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function VendorGroupCard({
  row,
  role,
  today,
  onOpen,
}: {
  row: Extract<DocumentRow, { kind: "vendor_group" }>
  role: Party
  today: ISODate
  onOpen: (key: string) => void
}) {
  // Open by default while a permit in it is in flight (asked about, waiting for its check, sent
  // back), so a case with a handful still pending does not hide them a click away; a group
  // that is all decided, like S6's 25 verified permits, starts collapsed.
  const defaultOpen = groupStartsOpen(row)

  return (
    <div className="lg:col-span-2">
      {/* Keyed on defaultOpen: an uncontrolled Accordion ignores a later defaultValue change,
          and a card answering a request can flip this group from nothing-to-check to
          something-to-check without the page remounting around it. */}
      <Accordion key={String(defaultOpen)} type="single" collapsible defaultValue={defaultOpen ? row.catalogId : undefined}>
        <AccordionItem value={row.catalogId} className="rounded-panel border border-line-subtle bg-surface-1 px-3.5">
          <AccordionTrigger className="py-3">
            <div className="flex w-full flex-col gap-2 pr-2">
              <span className="text-sm font-semibold text-fg">{row.title}</span>
              <Progress value={row.verifiedCount} max={row.total} label={`${row.verifiedCount} of ${plural(row.total, "vendor")} verified`} />
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {row.tasks.map((task) => (
                <DocumentCard key={task.id} task={task} role={role} today={today} onOpen={onOpen} />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

interface DocumentsTabProps {
  c: EventCase
  role: Party
  onOpen: (key: string) => void
}

/**
 * Documents grouped by the department that checks them (workstream 4D): the viewer's own
 * department first, its own actionable cards first within it, Verify as the only entry point
 * (it offers Send back itself once a checklist item fails). A department that is not the
 * card's reviewer sees the same cards read-only, with who checks them. Per-vendor health
 * permits collapse into one row with its progress, expanding to each vendor's own card.
 */
function DocumentsTab({ c, role, onOpen }: DocumentsTabProps) {
  const today = useDemo((s) => s.demoToday)
  const [onlyMine, setOnlyMine] = React.useState(false)
  const groups = documentGroups(c)

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={FileQuestionIcon}
        title="No documents yet"
        text="Files and forms the applicant uploads or fills in will appear here, grouped by who checks them."
      />
    )
  }

  // Whether the case has food vendors at all (workstream 5D's "Vendors" group, appended below).
  const hasVendors = vendorPermitGroup(c) !== null

  const ordered = orderGroupsForViewer(groups, role)
  const sections = ordered
    .map((group) => {
      const rows = sortDocumentRowsForViewer(groupDocumentsForDisplay(group.cards), role)
      const visible = onlyMine ? rows.filter((row) => rowNeedsViewerCheck(row, role)) : rows
      return { group, rows: visible }
    })
    .filter((section) => section.rows.length > 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <FilterChip active={onlyMine} aria-pressed={onlyMine} onClick={() => setOnlyMine((v) => !v)}>
          Needs my check
        </FilterChip>
      </div>
      {sections.length === 0 ? (
        <EmptyState icon={FileQuestionIcon} title="Nothing needs your check" text="Every card you review is already decided, or nothing has been submitted to you yet." />
      ) : (
        <div className="flex flex-col gap-8">
          {sections.map(({ group, rows }) => (
            <Section
              key={group.dept}
              title={PARTY_LABEL[group.dept]}
              description={group.dept === role ? "Your department's documents." : `Checked by ${PARTY_LABEL[group.dept]}; yours to view only.`}
            >
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {rows.map((row) =>
                  row.kind === "single" ? (
                    <DocumentCard key={row.task.id} task={row.task} role={role} today={today} onOpen={onOpen} />
                  ) : (
                    <VendorGroupCard key={row.catalogId} row={row} role={role} today={today} onOpen={onOpen} />
                  ),
                )}
              </div>
            </Section>
          ))}
        </div>
      )}
      {hasVendors ? <VendorsSection c={c} /> : null}
    </div>
  )
}

export { DocumentsTab }
