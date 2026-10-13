"use client"

/**
 * Conditions for a decision: the department's own templates, click to add, plus free text, all
 * in one reorderable, removable list (workstream 4C's review panel).
 */
import * as React from "react"
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

interface ConditionBuilderProps {
  templates: string[]
  value: string[]
  onChange: (next: string[]) => void
}

function ConditionBuilder({ templates, value, onChange }: ConditionBuilderProps) {
  const [freeText, setFreeText] = React.useState("")

  function add(text: string) {
    const trimmed = text.trim()
    if (!trimmed || value.includes(trimmed)) return
    onChange([...value, trimmed])
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= value.length) return
    const next = [...value]
    const tmp = next[i]
    next[i] = next[j]
    next[j] = tmp
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      {templates.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Templates</p>
          <div className="flex flex-wrap gap-1.5">
            {templates.map((text) => (
              <Button key={text} type="button" variant="secondary" size="sm" disabled={value.includes(text)} onClick={() => add(text)}>
                <PlusIcon data-icon="inline-start" />
                {text}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <Field label="Add a condition">
        <div className="flex items-center gap-2">
          <Input
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                add(freeText)
                setFreeText("")
              }
            }}
            placeholder="Type a condition and press Add"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              add(freeText)
              setFreeText("")
            }}
          >
            Add
          </Button>
        </div>
      </Field>

      {value.length === 0 ? (
        <p className="text-sm text-fg-secondary">No conditions added.</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {value.map((text, i) => (
            <li key={`${text}-${i}`} className="flex items-start justify-between gap-2 rounded-control border border-line-subtle bg-surface-2 px-3 py-2">
              <span className="text-sm text-fg">{text}</span>
              <div className="flex shrink-0 items-center gap-1">
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move "${text}" up`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUpIcon />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move "${text}" down`} disabled={i === value.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDownIcon />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove "${text}"`} onClick={() => remove(i)}>
                  <Trash2Icon />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export { ConditionBuilder }
