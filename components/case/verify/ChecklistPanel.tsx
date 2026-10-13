import { cn } from "cn"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import type { ChecklistItem } from "@/lib/view/verify"

interface ChecklistPanelProps {
  items: ChecklistItem[]
  /** Which items the verifier has flipped from the computed result; keyed by item id. */
  overrides: Record<string, boolean>
  onToggle: (id: string) => void
}

/**
 * Every checklist item, pre-evaluated from the preview's facts: a pass or fail badge and the
 * evidence behind it. The verifier confirms or overrides each one with its checkbox before
 * deciding, so a disagreement with the computed result is always visible, never silent.
 */
function ChecklistPanel({ items, overrides, onToggle }: ChecklistPanelProps) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((it) => {
        const checked = overrides[it.id] ?? it.pass
        return (
          <li
            key={it.id}
            className={cn(
              "flex items-start gap-2.5 rounded-control border px-3 py-2.5",
              checked ? "border-line-subtle bg-surface-2" : "border-danger-border bg-danger-surface/40",
            )}
          >
            <Checkbox checked={checked} onCheckedChange={() => onToggle(it.id)} aria-label={`Looks right: ${it.label}`} className="mt-0.5" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-fg">{it.label}</p>
                <Badge variant={checked ? "success" : "danger"}>{checked ? "Passes" : "Fails"}</Badge>
              </div>
              <p className="text-xs text-fg-secondary">{it.evidence}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export { ChecklistPanel }
