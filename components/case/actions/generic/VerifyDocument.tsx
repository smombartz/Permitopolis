"use client"

import * as React from "react"
import { InlineAlert } from "@/components/ui/inline-alert"
import { fmtFileSize } from "@/lib/format"
import { checkVerifyOrReject } from "@/lib/state/checks"
import { PanelActions, PanelBody, PanelHeader, useCaseContext, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

/** Shows the applicant's card content: what a mock document preview stands in for. */
function CardContent({ task }: { task: { payload: { files?: { name: string; size: number; type: string }[]; form?: Record<string, unknown> } } }) {
  const files = task.payload.files ?? []
  const form = task.payload.form
  if (files.length === 0 && (!form || Object.keys(form).length === 0)) {
    return <p className="text-sm text-fg-secondary">Nothing uploaded yet.</p>
  }
  return (
    <div className="flex flex-col gap-3">
      {files.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between gap-3 rounded-control border border-line-subtle bg-surface-2 px-3 py-2 text-sm">
              <span className="min-w-0 truncate text-fg">{f.name}</span>
              <span className="shrink-0 font-mono text-xs text-fg-label">
                {fmtFileSize(f.size)} &middot; {f.type || "unknown type"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {form && Object.keys(form).length > 0 ? (
        <dl className="flex flex-col gap-1.5 rounded-control border border-line-subtle bg-surface-2 px-3 py-2 text-sm">
          {Object.entries(form).map(([key, value]) => (
            <div key={key} className="flex items-baseline justify-between gap-3">
              <dt className="text-fg-label">{key}</dt>
              <dd className="text-right text-fg">{String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  )
}

/** Accepts a submitted applicant card. For the card's reviewer, or the department whose request it answers. */
function VerifyDocumentPanel({ caseId, arg, role, onClose }: ActionPanelProps) {
  const { c } = useCaseContext(caseId)
  const [error, setError] = React.useState<string | null>(null)
  const dispatch = useCaseDispatch(caseId)
  if (!c || !arg) return null
  const task = c.tasks.find((t) => t.id === arg)
  if (!task) return null

  const check = checkVerifyOrReject(c, arg, role)

  function submit() {
    const result = dispatch({ type: "verify_document", taskId: arg as string }, `Verified "${task!.title}".`)
    if (result.ok) onClose()
    else setError(result.reason ?? "That could not be verified.")
  }

  return (
    <>
      <PanelHeader title={`Verify: ${task.title}`} description={task.why} />
      <PanelBody>
        {!check.ok ? <InlineAlert variant="warning">{check.reason}</InlineAlert> : null}
        <CardContent task={task} />
      </PanelBody>
      <PanelActions error={error} onCancel={onClose} submitLabel="Verify" disabled={!check.ok} onSubmit={submit} />
    </>
  )
}

export { VerifyDocumentPanel, CardContent }
