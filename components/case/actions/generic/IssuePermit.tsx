"use client"

import * as React from "react"
import { CheckIcon, CircleIcon } from "lucide-react"
import { cn } from "cn"
import { InlineAlert } from "@/components/ui/inline-alert"
import { ConditionList, PartyChip } from "@/components/domain"
import { classify, permitComponents } from "@/lib/rules"
import { checkIssuePermit } from "@/lib/state"
import { fmtDate } from "@/lib/format"
import { issuePermitChecklist } from "@/lib/view/clerkTools"
import { PanelActions, PanelBody, PanelHeader, useCaseContext, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

/** The checklist Issue permit waits for: who owes it, since when, and whether it is met. */
function Checklist({ items }: { items: ReturnType<typeof issuePermitChecklist> }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.key} className="flex items-start gap-2.5 rounded-control border border-line-subtle bg-surface-2 px-3 py-2.5">
          {item.done ? (
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-success-fg" aria-hidden="true" />
          ) : (
            <CircleIcon className="mt-0.5 size-4 shrink-0 text-fg-label" aria-hidden="true" />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className={cn("text-sm", item.done ? "text-fg-secondary" : "text-fg")}>{item.label}</p>
            <div className="flex flex-wrap items-center gap-2">
              <PartyChip party={item.owedBy} />
              {item.sinceDate ? (
                <span className="text-xs text-fg-label">{item.done ? `Done` : `Owed since ${fmtDate(item.sinceDate)}`}</span>
              ) : null}
            </div>
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
