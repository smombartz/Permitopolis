"use client"

/**
 * What the applicant submitted for one routed section: its cards' form answers in words and
 * its files, so a reviewer decides with the material in front of them instead of hunting for
 * it on the Documents tab. Shared by every department's review panel (workstream 4C).
 */
import { FormAnswers } from "@/components/domain"
import { fmtFileSize } from "@/lib/format"
import type { ReviewSectionMaterial } from "@/lib/view/reviewTools"

function SubmittedMaterial({ sections }: { sections: ReviewSectionMaterial[] }) {
  if (sections.length === 0) {
    return <p className="text-sm text-fg-secondary">Nothing is routed to this department yet.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {sections.map(({ section, cards }) => (
        <div key={section} className="flex flex-col gap-2 rounded-panel border border-line-subtle bg-surface-1 p-3.5">
          <p className="text-sm font-semibold text-fg">{section}</p>
          {cards.length === 0 ? (
            <p className="text-xs text-fg-secondary">Checked against the application as a whole; no card of its own.</p>
          ) : (
            cards.map((card) => (
              <div key={card.task.id} className="flex flex-col gap-2">
                {card.rows.length > 0 ? <FormAnswers task={card.task} size="xs" /> : null}
                {card.files.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {card.files.map((f, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 rounded-control border border-line-subtle bg-surface-2 px-2.5 py-1.5 text-xs">
                        <span className="min-w-0 truncate text-fg">{f.name}</span>
                        <span className="shrink-0 font-mono text-fg-label">{fmtFileSize(f.size)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {card.rows.length === 0 && card.files.length === 0 ? <p className="text-xs text-fg-secondary">Not yet submitted.</p> : null}
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  )
}

export { SubmittedMaterial }
