"use client"

import { Button } from "@/components/ui/button"
import { Section } from "@/components/ui/section"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"
import { TaskKindLabel } from "@/components/domain"
import { FileQuestionIcon } from "lucide-react"
import { fmtFileSize, plural } from "@/lib/format"
import { PARTY_LABEL, type EventCase, type Party, type Task, type TaskStatus } from "@/lib/types"
import { documentGroups } from "@/lib/view/caseDetail"
import { FormAnswers } from "../FormAnswers"

const STATUS_BADGE: Record<TaskStatus, { variant: "secondary" | "default" | "warning" | "success"; text: string }> = {
  locked: { variant: "secondary", text: "Locked" },
  todo: { variant: "secondary", text: "Not yet provided" },
  submitted: { variant: "default", text: "Submitted" },
  changes_requested: { variant: "warning", text: "Changes requested" },
  done: { variant: "success", text: "Verified" },
}

function DocumentCard({ task, role, onOpen }: { task: Task; role: Party; onOpen: (key: string) => void }) {
  const files = task.payload.files ?? []
  const badge = STATUS_BADGE[task.status]
  const canAct = task.status === "submitted" && (task.reviewer === role || task.request?.from === role)

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
        {task.reviewer ? `Checked by ${PARTY_LABEL[task.reviewer]}` : "Nobody has to check this card"}
      </p>
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
      {task.request && !task.request.resolved ? (
        <p className="text-xs text-fg-secondary">
          <span className="font-semibold text-fg">{PARTY_LABEL[task.request.from]} asked:</span> {task.request.message}
        </p>
      ) : null}
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
          <Button type="button" variant="secondary" size="sm" onClick={() => onOpen(`reject_document:${task.id}`)}>
            Send back
          </Button>
        </div>
      ) : null}
    </div>
  )
}

interface DocumentsTabProps {
  c: EventCase
  role: Party
  onOpen: (key: string) => void
}

function DocumentsTab({ c, role, onOpen }: DocumentsTabProps) {
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

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <Section key={group.dept} title={PARTY_LABEL[group.dept]} description={plural(group.cards.length, "card")}>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {group.cards.map((task) => (
              <DocumentCard key={task.id} task={task} role={role} onOpen={onOpen} />
            ))}
          </div>
        </Section>
      ))}
    </div>
  )
}

export { DocumentsTab }
