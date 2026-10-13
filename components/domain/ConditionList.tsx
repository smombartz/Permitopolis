import { cn } from "cn"
import { CheckIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { DEPTS, PARTY_LABEL, type Condition, type Dept } from "@/lib/types"

export function groupConditionsByDept(conditions: Condition[]): Partial<Record<Dept, Condition[]>> {
  const groups: Partial<Record<Dept, Condition[]>> = {}
  for (const condition of conditions) {
    const group = groups[condition.dept] ?? (groups[condition.dept] = [])
    group.push(condition)
  }
  return groups
}

interface ConditionListProps extends React.ComponentProps<"div"> {
  conditions: Condition[]
  /** Shows "I accept" checkboxes (the quote/accept-and-sign screen). Read-only without it. */
  editable?: boolean
  /** Controlled accepted state while editable; falls back to each condition's own flag. */
  acceptedIds?: string[]
  onToggleAccept?: (id: string) => void
  /**
   * Marks the conditions the Clerk's quote carried ("Merged"). City screens set it; it is the
   * Clerk's bookkeeping, so the applicant's quote, the permit and the public check leave it off.
   */
  showMerged?: boolean
}

/** Conditions grouped by department, with accepted marks, merged marks for city staff, and an optional accept checkbox. */
function ConditionList({ conditions, editable = false, acceptedIds, onToggleAccept, showMerged = false, className, ...props }: ConditionListProps) {
  const groups = groupConditionsByDept(conditions)
  return (
    <div data-slot="condition-list" className={cn("flex flex-col gap-5", className)} {...props}>
      {DEPTS.filter((dept) => (groups[dept]?.length ?? 0) > 0).map((dept) => (
        <div key={dept} className="flex flex-col gap-2">
          <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">{PARTY_LABEL[dept]}</p>
          <ul className="flex flex-col gap-2">
            {(groups[dept] ?? []).map((condition) => {
              const accepted = editable
                ? (acceptedIds?.includes(condition.id) ?? condition.acceptedByApplicant)
                : condition.acceptedByApplicant
              return (
                <li
                  key={condition.id}
                  className="flex items-start gap-2.5 rounded-control border border-line-subtle bg-surface-2 px-3 py-2.5"
                >
                  {editable ? (
                    // The PRD's visible "I accept": the checkbox is named by it and by the condition.
                    <label className="mt-0.5 flex shrink-0 cursor-pointer items-center gap-1.5 text-xs font-semibold text-fg pointer-coarse:min-h-11">
                      <Checkbox
                        checked={accepted}
                        onCheckedChange={() => onToggleAccept?.(condition.id)}
                        aria-label={`I accept: ${condition.text}`}
                      />
                      I accept
                    </label>
                  ) : (
                    <CheckIcon
                      className={cn("mt-0.5 size-4 shrink-0", accepted ? "text-success-fg" : "text-fg-label")}
                      aria-hidden="true"
                    />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="text-sm text-fg">{condition.text}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {showMerged && condition.mergedByClerk ? <Badge variant="secondary">Merged</Badge> : null}
                      {accepted ? (
                        <Badge variant="success">Accepted</Badge>
                      ) : !editable ? (
                        <Badge variant="outline">Not yet accepted</Badge>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

export { ConditionList }
