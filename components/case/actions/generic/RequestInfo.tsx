"use client"

import * as React from "react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { InlineAlert } from "@/components/ui/inline-alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TaskCard } from "@/components/domain"
import { REQUEST_TEMPLATES } from "@/lib/data/templates"
import { dueDate } from "@/lib/rules"
import { checkRequestInfo, useDemo } from "@/lib/state"
import { fillRequestTemplate, previewRequestCard, requestableCardGroups } from "@/lib/view/clerkTools"
import type { Dept } from "@/lib/types"
import { PanelActions, PanelBody, PanelHeader, useCaseContext } from "../panelKit"
import type { ActionPanelProps } from "../types"

/** Picks the applicant cards this request concerns (checkboxes, grouped by status), or names a new item; a message with templates; a due date; a preview of the card the applicant will see. One request_info goes out per chosen card. */
function RequestInfoPanel({ caseId, arg, role, onClose }: ActionPanelProps) {
  const { c, today, cfg } = useCaseContext(caseId)
  const dept = role as Dept
  const groups = React.useMemo(() => (c ? requestableCardGroups(c) : []), [c])
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(arg ? [arg] : []))
  const [newItem, setNewItem] = React.useState(false)
  const [item, setItem] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [due, setDue] = React.useState(() => (c ? dueDate(today, cfg.sla.requestResponseDays, cfg) : today))
  const [error, setError] = React.useState<string | null>(null)
  if (!c) return null

  const templates = REQUEST_TEMPLATES[dept] ?? []
  const anyChosen = selected.size > 0 || (newItem && item.trim().length > 0)
  const valid = message.trim().length > 0 && anyChosen
  // Every chosen card passes the same check (the actor and the case's state): one is enough to
  // know whether sending would be refused.
  const check = checkRequestInfo(c, dept, selected.size > 0 ? [...selected][0] : undefined)

  function toggle(taskId: string) {
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  function submit() {
    const targets = [...selected]
    const dispatch = useDemo.getState().dispatch
    let sent = 0
    let reason: string | undefined
    for (const taskId of targets) {
      const result = dispatch(caseId, { type: "request_info", taskId, message: message.trim(), dueDate: due });
      if (result.ok) sent++
      else reason = reason ?? result.reason
    }
    if (newItem && item.trim().length > 0) {
      const result = dispatch(caseId, { type: "request_info", item: item.trim(), message: message.trim(), dueDate: due });
      if (result.ok) sent++
      else reason = reason ?? result.reason
    }
    if (sent === 0) {
      setError(reason ?? "That could not be requested.")
      return
    }
    toast.success(sent === 1 ? "Information requested." : `${sent} requests sent.`)
    onClose()
  }

  return (
    <>
      <PanelHeader title="Request information" description="Pins your message to one or more of the applicant's cards, or opens a new one. Pauses your review clock until the applicant answers." />
      <PanelBody>
        {!check.ok ? <InlineAlert variant="warning">{check.reason}</InlineAlert> : null}

        <div className="flex flex-col gap-3">
          <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">About</p>
          {groups.length === 0 ? <p className="text-sm text-fg-secondary">The applicant has no cards yet.</p> : null}
          {groups.map((group) => (
            <div key={group.status} className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-fg-label">{group.label}</p>
              <ul className="flex flex-col gap-1.5">
                {group.cards.map((task) => (
                  <li key={task.id} className="flex items-start gap-2">
                    <Checkbox checked={selected.has(task.id)} onCheckedChange={() => toggle(task.id)} className="mt-0.5" aria-label={task.title} />
                    <span className="text-sm text-fg">{task.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="flex items-start gap-2">
            <Checkbox checked={newItem} onCheckedChange={(v) => setNewItem(v === true)} className="mt-0.5" aria-label="Something new" />
            <span className="text-sm text-fg">Something new (opens a card)</span>
          </div>
          {newItem ? (
            <Field label="What is it called">
              <Input value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Updated vendor list" />
            </Field>
          ) : null}
        </div>

        {templates.length > 0 ? (
          <Field label="Start from a template">
            <Select value="" onValueChange={(v) => setMessage(fillRequestTemplate(v, c.tasks.filter((t) => selected.has(t.id))))}>
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
        <Field label="Due date" hint="Defaults to the usual response window.">
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-44" />
        </Field>

        {anyChosen ? (
          <div className="flex flex-col gap-2">
            <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">What the applicant will see</p>
            <div className="flex flex-col gap-2">
              {[...selected].map((taskId) => {
                const target = c.tasks.find((t) => t.id === taskId) ?? null
                return <TaskCard key={taskId} task={previewRequestCard(target, dept, item, message || "…", due, `${today}T09:00`)} today={today} />
              })}
              {newItem && item.trim().length > 0 ? <TaskCard task={previewRequestCard(null, dept, item, message || "…", due, `${today}T09:00`)} today={today} /> : null}
            </div>
          </div>
        ) : null}
      </PanelBody>
      <PanelActions error={error} onCancel={onClose} submitLabel="Send request" disabled={!check.ok || !valid} onSubmit={submit} />
    </>
  )
}

export { RequestInfoPanel }
