"use client"

import * as React from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { InlineAlert } from "@/components/ui/inline-alert"
import { PartyChip } from "@/components/domain"
import { classify, routing } from "@/lib/rules"
import { checkConfirmRouting } from "@/lib/state"
import type { RoutedReviewer } from "@/lib/state/actions"
import { defaultReviewDueDate, leadTimeLeftAfterRouting } from "@/lib/view/clerkTools"
import { plural } from "@/lib/format"
import { DEPTS, PARTY_LABEL, type Dept } from "@/lib/types"
import { PanelActions, PanelBody, PanelHeader, useCaseContext, useCaseDispatch } from "../panelKit"
import type { ActionPanelProps } from "../types"

interface Row {
  dept: Dept
  reasons: string[]
  checked: boolean
  sections: string
  dueDate: string
}

/** Suggested reviewers from routing(), each with a checkbox, editable sections, and a due date. */
function ConfirmRoutingPanel({ caseId, onClose }: ActionPanelProps) {
  const { c, today, cfg } = useCaseContext(caseId)
  const dispatch = useCaseDispatch(caseId)
  const [error, setError] = React.useState<string | null>(null)

  const suggestions = React.useMemo(() => (c ? routing(c, classify(c, cfg), cfg) : []), [c, cfg]);
  // Today plus the tier's review days, rolled back off a weekend: never empty, never a weekend.
  const defaultDue = c ? defaultReviewDueDate(c, cfg, today) : today;
  // Every department has a row, so the Clerk can add a reviewer as well as take one off (PRD,
  // "Routing"): the suggested ones first and checked, the others after them and unchecked.
  const [rows, setRows] = React.useState<Row[]>(() => [
    ...suggestions.map((s) => ({ dept: s.dept, reasons: s.reasons, checked: true, sections: s.sections.join("\n"), dueDate: defaultDue })),
    ...DEPTS.filter((dept) => !suggestions.some((s) => s.dept === dept)).map((dept) => ({ dept, reasons: [], checked: false, sections: "", dueDate: defaultDue })),
  ])

  if (!c) return null
  const check = checkConfirmRouting(c)

  function updateRow(dept: Dept, patch: Partial<Row>) {
    setRows((cur) => cur.map((r) => (r.dept === dept ? { ...r, ...patch } : r)))
  }

  const reviewers: RoutedReviewer[] = rows
    .filter((r) => r.checked)
    .map((r) => ({ dept: r.dept, sections: r.sections.split("\n").map((s) => s.trim()).filter(Boolean), dueDate: r.dueDate }))

  function submit() {
    const result = dispatch({ type: "confirm_routing", reviewers }, "Routing confirmed; the case moved to In review.")
    if (result.ok) onClose()
    else setError(result.reason ?? "Routing could not be confirmed.")
  }

  // A checked reviewer needs a date on or after today: it is the review's allowance. Shown on
  // the row's own field; the engine refuses the same thing.
  const dateProblem = (row: Row): string | null => {
    if (!row.checked) return null
    if (!row.dueDate) return "Choose a due date."
    return row.dueDate < today ? "The due date has passed; choose today or later." : null
  }
  const datesOk = rows.every((row) => dateProblem(row) === null)
  // The list as it stands, asked of the engine before the click: nobody routed, or a
  // department left off that one of the applicant's cards names as its reviewer.
  const listCheck = check.ok ? checkConfirmRouting(c, reviewers, today) : check
  const listProblem = datesOk && !listCheck.ok ? listCheck.reason : null

  const checkedDueDates = rows.filter((r) => r.checked && r.dueDate).map((r) => r.dueDate);
  const latestDueDate = checkedDueDates.length > 0 ? checkedDueDates.reduce((a, b) => (a > b ? a : b)) : null;
  const leadTimeLeft = latestDueDate ? leadTimeLeftAfterRouting(c, latestDueDate) : null;

  return (
    <>
      <PanelHeader title="Confirm routing" description="Suggested from the plan's triggers. Adjust who reviews, what each checks, and the due date for its decision." />
      <PanelBody>
        {!check.ok ? <InlineAlert variant="warning">{check.reason}</InlineAlert> : null}
        {suggestions.length === 0 ? (
          <p className="text-sm text-fg-secondary">Nothing suggests a reviewer for this plan; route at least one department.</p>
        ) : null}
        {rows.map((row) => (
          <div key={row.dept} className="flex flex-col gap-2.5 rounded-panel border border-line-subtle bg-surface-1 p-3.5">
            <div className="flex items-start gap-2.5">
              <Checkbox checked={row.checked} onCheckedChange={(v) => updateRow(row.dept, { checked: v === true })} className="mt-1" aria-label={`Route to ${PARTY_LABEL[row.dept]}`} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <PartyChip party={row.dept} />
                <p className="text-xs text-fg-secondary">{row.reasons.length > 0 ? row.reasons.join(", ") : "Not suggested by this plan."}</p>
              </div>
            </div>
            <Field label="Sections">
              <Textarea rows={3} value={row.sections} onChange={(e) => updateRow(row.dept, { sections: e.target.value })} disabled={!row.checked} />
            </Field>
            <Field label="Due date" error={dateProblem(row) ?? undefined}>
              <Input type="date" min={today} value={row.dueDate} onChange={(e) => updateRow(row.dept, { dueDate: e.target.value })} disabled={!row.checked} className="w-44" />
            </Field>
          </div>
        ))}
        {leadTimeLeft !== null ? (
          <InlineAlert variant={leadTimeLeft < 0 ? "danger" : "info"}>
            {leadTimeLeft < 0
              ? `The latest due date is ${plural(-leadTimeLeft, "day")} after the event; move it earlier.`
              : `${plural(leadTimeLeft, "day")} of lead time left after the latest due date, for the quote and payment.`}
          </InlineAlert>
        ) : null}
        {/* It appears as departments are ticked and unticked: read out when it does. */}
        {listProblem ? (
          <InlineAlert variant="danger" live>
            {listProblem}
          </InlineAlert>
        ) : null}
      </PanelBody>
      <PanelActions
        error={error}
        onCancel={onClose}
        submitLabel="Confirm routing"
        disabled={!check.ok || !datesOk || !listCheck.ok}
        onSubmit={submit}
      />
    </>
  )
}

export { ConfirmRoutingPanel }
