"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { InlineAlert } from "@/components/ui/inline-alert"
import { ConditionList, PartyChip } from "@/components/domain"
import { classify, permitComponents } from "@/lib/rules"
import { checkIssuePermit } from "@/lib/state"
import { fmtDate } from "@/lib/format"
import { issuePermitChecklist } from "@/lib/view/clerkTools"
import { PanelActions, PanelBody, PanelHeader, useCaseContext, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

/**
 * The checklist Issue permit waits for: who owes it, since when, and whether it is met. Laid
 * out as the verification checklist is (the item and its badge on one line, what is behind it
 * below), so a checklist reads the same in both panels. This one is read-only: each item is
 * met by its own party's action, not ticked here.
 */
function Checklist({ items }: { items: ReturnType<typeof issuePermitChecklist> }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.key} data-done={item.done} className="flex flex-col gap-1 rounded-control border border-line-subtle bg-surface-2 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-fg">{item.label}</p>
            <Badge variant={item.done ? "success" : "warning"}>{item.done ? "Done" : "Waiting"}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PartyChip party={item.owedBy} />
            {!item.done && item.sinceDate ? <span className="text-xs text-fg-secondary">Owed since {fmtDate(item.sinceDate)}</span> : null}
          </div>
        </li>
      ))}
    </ul>
  )
}

/** The checklist a permit needs, what it will cover, and what issuing triggers. Disabled with the engine's reasons until every item is met. */
function IssuePermitPanel({ caseId, onClose }: ActionPanelProps) {
  const { c, today, cfg, cases } = useCaseContext(caseId)
  const [error, setError] = React.useState<string | null>(null)
  const dispatch = useCaseDispatch(caseId)
  if (!c) return null

  const check = checkIssuePermit(c, { today, cases, cfg })
  const checklist = issuePermitChecklist(c)
  const components = permitComponents(c, c.triggers, classify(c, cfg).blockPartyException)

  function submit() {
    const result = dispatch({ type: "issue_permit" }, "Permit issued.")
    if (result.ok) onClose()
    else setError(result.reason ?? "The permit could not be issued.")
  }

  return (
    <>
      <PanelHeader
        title="Issue permit"
        description="Moves the case to Permitted, creates Public Works & Safety's work orders, and opens the applicant's day-of cards and permit."
      />
      <PanelBody>
        {!check.ok ? <InlineAlert variant="warning">{check.reason}</InlineAlert> : <InlineAlert variant="success">Everything this needs is in place.</InlineAlert>}

        <div className="flex flex-col gap-2">
          <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">What the permit needs</p>
          <Checklist items={checklist} />
        </div>

        {c.conditions.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Conditions the permit will carry</p>
            <ConditionList conditions={c.conditions} />
          </div>
        ) : null}

        {components.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">What one permit covers</p>
            <ul className="flex flex-col gap-1 text-sm text-fg-secondary">
              {components.map((component) => (
                <li key={component.id}>
                  {component.label} <span className="text-fg-label">({component.approvedBy})</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <InlineAlert variant="info">
          Issuing creates Public Works & Safety&apos;s work orders for this plan (barricades, police, closures, trash or power, as it needs them) and unlocks the
          applicant&apos;s day-of cards, including &ldquo;Carry your permit&rdquo;.
        </InlineAlert>
      </PanelBody>
      <PanelActions error={error} onCancel={onClose} submitLabel="Issue permit" disabled={!check.ok} onSubmit={submit} />
    </>
  )
}

export { IssuePermitPanel }
