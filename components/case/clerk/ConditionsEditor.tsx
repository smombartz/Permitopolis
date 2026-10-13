"use client"

/** The consolidation panel's merged conditions list: one row per condition, editable, reorderable, from any department. */
import * as React from "react"
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PartyChip } from "@/components/domain"
import { CONDITION_TEMPLATES } from "@/lib/data/templates"
import { DEPTS, PARTY_LABEL, type Dept } from "@/lib/types"
import type { ConditionRow } from "@/lib/view/clerkTools"

const SELECT_CLASS =
  "h-9 w-full rounded-control border border-line-subtle bg-surface-1 px-2.5 text-sm text-fg outline-none focus-visible:border-focus-ring focus-visible:shadow-focus-halo"

interface ConditionsEditorProps {
  rows: ConditionRow[]
  conflictIds: Set<string>
  onUpdate: (id: string, patch: Partial<Pick<ConditionRow, "dept" | "text">>) => void
  onRemove: (id: string) => void
  onMove: (id: string, direction: -1 | 1) => void
  onAdd: (row: ConditionRow) => void
}

let rowSeq = 0
function nextRowId(): string {
  rowSeq += 1
  return `new-condition-${rowSeq}`
}

/** A flat list of departments or template phrases, same options everywhere: a plain native select, not Radix (no groups or icons here). */
function DeptSelect({ value, onChange, ariaLabel, className }: { value: Dept; onChange: (dept: Dept) => void; ariaLabel?: string; className?: string }) {
  return (
    <select aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value as Dept)} className={className ?? SELECT_CLASS}>
      {DEPTS.map((d) => (
        <option key={d} value={d}>
          {PARTY_LABEL[d]}
        </option>
      ))}
    </select>
  )
}

/** The add-a-condition row: a department, a template to start from (optional), and free text. */
function AddConditionRow({ onAdd }: { onAdd: (row: ConditionRow) => void }) {
  const [dept, setDept] = React.useState<Dept>("clerk")
  const [text, setText] = React.useState("")
  const templates = CONDITION_TEMPLATES[dept] ?? []

  function add() {
    if (text.trim().length === 0) return
    onAdd({ id: nextRowId(), dept, text: text.trim() })
    setText("")
  }

  return (
    <div className="flex flex-col gap-2 rounded-panel border border-dashed border-line-subtle p-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Department" className="w-40">
          <DeptSelect value={dept} onChange={setDept} />
        </Field>
        {templates.length > 0 ? (
          <Field label="Start from a template" className="min-w-48 flex-1">
            <select
              aria-label="Start from a template"
              value=""
              onChange={(e) => e.target.value && setText(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Pick wording to start from</option>
              {templates.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>
      <div className="flex items-end gap-2">
        <Field label="Condition" className="flex-1">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Sound ends at 9 pm" />
        </Field>
        <Button type="button" variant="secondary" onClick={add} disabled={text.trim().length === 0}>
          <PlusIcon data-icon="inline-start" />
          Add condition
        </Button>
      </div>
    </div>
  )
}

/** The merged conditions list, grouped by nothing in particular (order is the Clerk's own): each row keeps its department, can be edited, moved, or removed. Conflicting rows carry a warning badge. */
function ConditionsEditor({ rows, conflictIds, onUpdate, onRemove, onMove, onAdd }: ConditionsEditorProps) {
  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? <p className="text-sm text-fg-secondary">No conditions yet.</p> : null}
      {rows.map((row, index) => (
        <div key={row.id} className="flex flex-col gap-2 rounded-panel border border-line-subtle bg-surface-1 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <PartyChip party={row.dept} />
            {conflictIds.has(row.id) ? <Badge variant="warning">Conflicts</Badge> : null}
            <div className="ml-auto flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Move up" disabled={index === 0} onClick={() => onMove(row.id, -1)}>
                <ArrowUpIcon />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Move down" disabled={index === rows.length - 1} onClick={() => onMove(row.id, 1)}>
                <ArrowDownIcon />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove condition" onClick={() => onRemove(row.id)}>
                <Trash2Icon />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <DeptSelect value={row.dept} onChange={(dept) => onUpdate(row.id, { dept })} ariaLabel="Department" className={`${SELECT_CLASS} w-40`} />
            <Input aria-label="Condition text" className="min-w-48 flex-1" value={row.text} onChange={(e) => onUpdate(row.id, { text: e.target.value })} />
          </div>
        </div>
      ))}
      <AddConditionRow onAdd={onAdd} />
    </div>
  )
}

export { ConditionsEditor }
