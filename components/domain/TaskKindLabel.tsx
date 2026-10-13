import { cn } from "cn"
import { TASK_KIND_ICON } from "@/components/domain/icons"
import type { TaskKind } from "@/lib/types"

export const TASK_KIND_LABEL: Record<TaskKind, string> = {
  document: "Document",
  form: "Form",
  action: "Action",
  payment: "Payment",
  sign_off: "Sign-off",
  meeting: "Meeting",
  review: "Review",
  inspection: "Inspection",
}

interface TaskKindLabelProps extends React.ComponentProps<"span"> {
  kind: TaskKind
}

/** A task card's kind strip: icon plus the plain-language kind. */
function TaskKindLabel({ kind, className, ...props }: TaskKindLabelProps) {
  const Icon = TASK_KIND_ICON[kind]
  return (
    <span
      data-slot="task-kind-label"
      className={cn("inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[.08em] text-fg-label uppercase", className)}
      {...props}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {TASK_KIND_LABEL[kind]}
    </span>
  )
}

export { TaskKindLabel }
