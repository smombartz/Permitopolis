import { CheckIcon, ChevronRightIcon, ClockIcon, LockIcon, Undo2Icon } from "lucide-react"
import { SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { DateText } from "@/components/domain/DateText"
import { taskDueDate } from "@/lib/state"
import type { Task } from "@/lib/types"
import type { StackedCards } from "@/lib/view/board"

const STATUS_ICON: Record<Task["status"], typeof CheckIcon> = {
  locked: LockIcon,
  todo: ClockIcon,
  submitted: ClockIcon,
  changes_requested: Undo2Icon,
  done: CheckIcon,
}

/** The status in words, beside its icon: an icon and its color alone say nothing to many readers. */
const STATUS_TEXT: Record<Task["status"], string> = {
  locked: "Locked",
  todo: "To do",
  submitted: "With the city",
  changes_requested: "Changes requested",
  done: "Done",
}

interface VendorStackSheetProps {
  stack: StackedCards
  onSelectTask: (taskId: string) => void
}

/** A stacked group of per-vendor cards ("Vendor health permits · 25 of 25"), expanded. */
function VendorStackSheet({ stack, onSelectTask }: VendorStackSheetProps) {
  return (
    <SheetContent>
      <SheetHeader>
        <SheetTitle>{stack.title}</SheetTitle>
        <SheetDescription>
          {stack.done} of {stack.total} done
        </SheetDescription>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-5 py-4">
        {stack.tasks.map((task) => {
          const Icon = STATUS_ICON[task.status]
          const due = taskDueDate(task)
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => onSelectTask(task.id)}
              className="flex min-h-11 items-center justify-between gap-2 rounded-control border border-line-subtle bg-surface-2 px-3 py-3 text-left text-sm outline-none transition-colors duration-[var(--dur-fast)] ease-frost hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Icon className={task.status === "done" ? "size-3.5 shrink-0 text-success-fg" : "size-3.5 shrink-0 text-fg-label"} aria-hidden="true" />
                {task.title}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-fg-secondary">
                <span className={task.status === "done" ? "font-medium text-success-fg" : "font-medium text-fg-secondary"}>{STATUS_TEXT[task.status]}</span>
                {due ? <DateText date={due} short className="text-xs text-fg-secondary" /> : null}
                <ChevronRightIcon className="size-3.5 shrink-0" aria-hidden="true" />
              </span>
            </button>
          )
        })}
      </div>
    </SheetContent>
  )
}

export { VendorStackSheet }
