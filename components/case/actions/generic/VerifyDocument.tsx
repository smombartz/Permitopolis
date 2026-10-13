"use client"

import * as React from "react"
import { Field } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { InlineAlert } from "@/components/ui/inline-alert"
import { ChecklistPanel, DocumentPreview } from "@/components/case/verify"
import { checkVerifyOrReject } from "@/lib/state"
import { buildVerificationPreview } from "@/lib/view/verify"
import { PanelActions, PanelBody, PanelHeader, useCaseContext, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

/**
 * Verify, with Send back folded into the same panel (workstream 4D, replacing the two thin
 * forms Phase 3 shipped): a mock preview of the document on the left, drawn from the case, the
 * card and its file (never a real file, never random), and its checklist on the right, each
 * item pre-evaluated and overridable. The sheet opens wide for this panel; under 1024px the
 * two stack. Verify is the primary action while every item passes; once one is unchecked,
 * Send back takes over with its reason prefilled from the failing items.
 */
function VerifyDocumentPanel({ caseId, arg, role, onClose }: ActionPanelProps) {
  const { c } = useCaseContext(caseId)
  const [overrides, setOverrides] = React.useState<Record<string, boolean>>({})
  const [reason, setReason] = React.useState("")
  const [reasonTouched, setReasonTouched] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const dispatch = useCaseDispatch(caseId)

  const task = c && arg ? c.tasks.find((t) => t.id === arg) : undefined

  if (!c || !arg || !task) return null

  const title = task.title
  const check = checkVerifyOrReject(c, arg, role)
  const preview = buildVerificationPreview(c, task)
  const failing = preview.checklist.filter((it) => !(overrides[it.id] ?? it.pass))
  const allPassNow = failing.length === 0
  const defaultReasonNow = failing.map((it) => it.fix).join(" ")
  const reasonValue = reasonTouched ? reason : defaultReasonNow

  function toggle(id: string) {
    setOverrides((cur) => {
      const current = cur[id] ?? preview.checklist.find((it) => it.id === id)!.pass
      return { ...cur, [id]: !current }
    })
  }

  function submit() {
    const result = allPassNow
      ? dispatch({ type: "verify_document", taskId: arg as string }, `Verified "${title}".`)
      : dispatch({ type: "reject_document", taskId: arg as string, reason: reasonValue.trim() }, `Sent "${title}" back.`)
    if (result.ok) onClose()
    else setError(result.reason ?? "That could not be saved.")
  }

  const nothingSubmitted = (task.payload.files?.length ?? 0) === 0 && !task.payload.form

  return (
    <>
      <PanelHeader title={`Verify: ${task.title}`} description={task.why} />
      <PanelBody>
        {!check.ok ? <InlineAlert variant="warning">{check.reason}</InlineAlert> : null}
        {nothingSubmitted ? (
          <p className="text-sm text-fg-secondary">Nothing uploaded yet.</p>
        ) : (
          <div data-slot="verify-layout" className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
            <DocumentPreview preview={preview} task={task} />
            <div className="flex min-w-0 flex-col gap-4">
              <ChecklistPanel items={preview.checklist} overrides={overrides} onToggle={toggle} />
              {!allPassNow ? (
                <Field label="Reason the applicant will see" required>
                  <Textarea
                    autoFocus
                    rows={3}
                    value={reasonValue}
                    onChange={(e) => {
                      setReason(e.target.value)
                      setReasonTouched(true)
                    }}
                    placeholder="What needs to change"
                  />
                </Field>
              ) : null}
            </div>
          </div>
        )}
      </PanelBody>
      <PanelActions
        error={error}
        onCancel={onClose}
        submitLabel={allPassNow ? "Verify" : "Send back"}
        submitVariant={allPassNow ? "primary" : "destructive"}
        disabled={!check.ok || nothingSubmitted || (!allPassNow && reasonValue.trim().length === 0)}
        onSubmit={submit}
      />
    </>
  )
}

export { VerifyDocumentPanel }
