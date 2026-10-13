import { TriangleAlertIcon } from "lucide-react"
import { KeyValueList } from "@/components/ui/key-value"
import { FormAnswers } from "@/components/domain"
import { fmtFileType } from "@/lib/format"
import type { VerificationPreview } from "@/lib/view/verify"
import type { Task } from "@/lib/types"

const PREVIEW_EYEBROW: Record<VerificationPreview["kind"], string> = {
  certificate: "Document preview",
  permit: "Document preview",
  plan: "Document preview",
  form: "Submitted plan",
  photo: "Attached photo",
  generic: "Attachment",
  unreadable: "Document preview",
}

/**
 * The mock preview every verification panel shows on its own: a certificate, a permit or a
 * plan drawn from `buildVerificationPreview()`'s facts, never a real file. Wrong where the
 * upload itself is wrong: the facts are left out and the reason is shown instead.
 */
function DocumentPreview({ preview, task }: { preview: VerificationPreview; task: Pick<Task, "catalogId" | "payload"> }) {
  if (preview.looksWrong) {
    return (
      <div className="flex flex-col gap-2 rounded-panel border border-dashed border-danger-border bg-danger-surface/40 p-4">
        <div className="flex items-start gap-2 text-sm font-semibold text-danger-fg">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {preview.unreadableReason}
        </div>
        <p className="text-xs text-fg-secondary">
          {preview.file ? `${preview.file.name} · ${preview.file.size} · ${fmtFileType(preview.file.type)}` : "Nothing was uploaded."}
        </p>
      </div>
    )
  }

  const hasFacts = preview.facts.length > 0
  return (
    <div className="flex flex-col gap-3 rounded-panel border border-line-subtle bg-surface-2 p-4">
      <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">{PREVIEW_EYEBROW[preview.kind]}</p>
      {hasFacts ? (
        <KeyValueList items={preview.facts.map((f) => ({ label: f.label, value: f.value }))} />
      ) : (
        <FormAnswers task={task} />
      )}
      {preview.file ? (
        <p className="border-t border-line-subtle pt-2 text-xs text-fg-label">
          {preview.file.name} · {preview.file.size}
        </p>
      ) : null}
    </div>
  )
}

export { DocumentPreview }
