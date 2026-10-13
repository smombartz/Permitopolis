"use client"

import * as React from "react"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { InlineAlert } from "@/components/ui/inline-alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { REQUEST_TEMPLATES } from "@/lib/data/templates"
import { checkRequestInfo } from "@/lib/state"
import type { Dept } from "@/lib/types"
import { PanelActions, PanelBody, PanelHeader, useCaseContext, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

const NEW_ITEM = "__new__"

/** Picks the applicant card it concerns, or names a new item; a message with templates; an optional due date. */
function RequestInfoPanel({ caseId, arg, role, onClose }: ActionPanelProps) {
  const { c } = useCaseContext(caseId)
  const dept = role as Dept
  const openCards = c?.tasks.filter((t) => t.owner === "applicant" && t.status !== "done" && t.status !== "locked") ?? []
  const [target, setTarget] = React.useState(arg && openCards.some((t) => t.id === arg) ? arg : openCards[0]?.id ?? NEW_ITEM)
  const [item, setItem] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [dueDate, setDueDate] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const dispatch = useCaseDispatch(caseId)
  if (!c) return null

  const check = checkRequestInfo(c, dept, target === NEW_ITEM ? undefined : target)
  const templates = REQUEST_TEMPLATES[dept] ?? []
  const valid = message.trim().length > 0 && (target !== NEW_ITEM || item.trim().length > 0)

  function submit() {
    const result = dispatch(
      {
        type: "request_info",
        taskId: target === NEW_ITEM ? undefined : target,
        item: target === NEW_ITEM ? item.trim() : undefined,
        message: message.trim(),
        dueDate: dueDate || undefined,
      },
      "Information requested.",
    )
    if (result.ok) onClose()
    else setError(result.reason ?? "That could not be requested.")
  }

  return (
    <>
      <PanelHeader title="Request information" description="Pins your message to an existing card, or opens a new one. Pauses your review clock until the applicant answers." />
      <PanelBody>
        {!check.ok ? <InlineAlert variant="warning">{check.reason}</InlineAlert> : null}
        <Field label="About">
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {openCards.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.title}
                </SelectItem>
              ))}
              <SelectItem value={NEW_ITEM}>Something new</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {target === NEW_ITEM ? (
          <Field label="What is it called">
            <Input value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Updated vendor list" />
          </Field>
        ) : null}
        {templates.length > 0 ? (
          <Field label="Start from a template">
            <Select value="" onValueChange={(v) => setMessage(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick wording to start from" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        <Field label="Message" required>
          <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What you need from the applicant" />
        </Field>
        <Field label="Due date" hint="Leave blank for the usual response window.">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-44" />
        </Field>
      </PanelBody>
      <PanelActions error={error} onCancel={onClose} submitLabel="Send request" disabled={!check.ok || !valid} onSubmit={submit} />
    </>
  )
}

export { RequestInfoPanel }
