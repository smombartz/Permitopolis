import { cn } from "cn"
import type { Task } from "@/lib/types"
import { formRows } from "@/lib/view/caseDetail"

/**
 * A card's form, read back: the labels the applicant saw, with a list (the vendors of a vendor
 * list) one entry per line. The Documents tab and the Verify and Send back panels both show it.
 * Renders nothing for a card with no form.
 */
function FormAnswers({ task, size = "sm" }: { task: Pick<Task, "catalogId" | "payload">; size?: "xs" | "sm" }) {
  const rows = formRows(task)
  if (rows.length === 0) return null
  return (
    <dl
      data-slot="form-answers"
      className={cn(
        "flex flex-col rounded-control border border-line-subtle bg-surface-2",
        size === "xs" ? "gap-1 px-2.5 py-1.5 text-xs" : "gap-1.5 px-3 py-2 text-sm",
      )}
    >
      {rows.map((row) =>
        row.items ? (
          <div key={row.label} className="flex flex-col gap-1">
            <dt className="text-fg-label">
              {row.label} ({row.items.length})
            </dt>
            <dd>
              <ul className="flex flex-col gap-0.5 text-fg">
                {row.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </dd>
          </div>
        ) : (
          <div key={row.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-fg-label">{row.label}</dt>
            <dd className="text-right text-fg">{row.value}</dd>
          </div>
        ),
      )}
    </dl>
  )
}

export { FormAnswers }
