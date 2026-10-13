"use client"

import * as React from "react"
import { Field } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PARTIES, PARTY_LABEL, type Party } from "@/lib/types"
import { PanelActions, PanelBody, PanelHeader, useCaseContext, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

/** Writes an activity entry naming the party it is sent to. No real notification goes out in this prototype. */
function RemindPanel({ caseId, arg, onClose }: ActionPanelProps) {
  const { c } = useCaseContext(caseId)
  const [party, setParty] = React.useState<Party>((arg as Party) ?? "applicant")
  const [error, setError] = React.useState<string | null>(null)
  const dispatch = useCaseDispatch(caseId)

  if (!c) return null

  function submit() {
    const result = dispatch({ type: "remind", party }, `Reminder sent to ${PARTY_LABEL[party]}.`)
    if (result.ok) onClose()
    else setError(result.reason ?? "That reminder could not be sent.")
  }

  return (
    <>
      <PanelHeader title="Send a reminder" description="Logs a reminder to the party you pick; this demo has no real email or notification to send." />
      <PanelBody>
        <Field label="Remind">
          <Select value={party} onValueChange={(v) => setParty(v as Party)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PARTIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PARTY_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </PanelBody>
      <PanelActions error={error} onCancel={onClose} submitLabel="Send reminder" onSubmit={submit} />
    </>
  )
}

export { RemindPanel }
