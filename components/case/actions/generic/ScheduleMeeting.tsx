"use client"

import * as React from "react"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InlineAlert } from "@/components/ui/inline-alert"
import { checkScheduleMeeting, meetingCardFor } from "@/lib/state"
import { PanelActions, PanelBody, PanelHeader, useCaseContext, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

/** Sets, or moves, a meeting card's date. A meeting may be rescheduled until it has been held. */
function ScheduleMeetingPanel({ caseId, arg, role, onClose }: ActionPanelProps) {
  const { c, today } = useCaseContext(caseId)
  const card = c && arg ? meetingCardFor(c, arg) : undefined
  const [date, setDate] = React.useState(card?.payload.scheduledFor ?? card?.dueDate ?? today)
  const [error, setError] = React.useState<string | null>(null)
  const dispatch = useCaseDispatch(caseId)
  if (!c || !arg || !card) return null

  const check = checkScheduleMeeting(c, arg, role)

  function submit() {
    const result = dispatch({ type: "schedule_meeting", taskId: arg as string, date }, `Scheduled "${card!.title}".`)
    if (result.ok) onClose()
    else setError(result.reason ?? "That meeting could not be scheduled.")
  }

  return (
    <>
      <PanelHeader title={card.title} description={card.why} />
      <PanelBody>
        {!check.ok ? <InlineAlert variant="warning">{check.reason}</InlineAlert> : null}
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </PanelBody>
      <PanelActions error={error} onCancel={onClose} submitLabel="Schedule" disabled={!check.ok || !date} onSubmit={submit} />
    </>
  )
}

export { ScheduleMeetingPanel }
