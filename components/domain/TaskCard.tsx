import { cn } from "cn"
import { CheckIcon, LockIcon } from "lucide-react"
import { DueDate } from "@/components/domain/DueDate"
import { Money } from "@/components/domain/Money"
import { PartyChip } from "@/components/domain/PartyChip"
import { TaskKindLabel } from "@/components/domain/TaskKindLabel"
import { Progress } from "@/components/ui/progress"
import { taskDueDate } from "@/lib/state"
import { PARTY_LABEL, type ISODate, type Task } from "@/lib/types"

const INTERACTIVE_FOCUS =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"

interface TaskCardProps {
  task: Task
  today: ISODate
  /** Plain-language unlock hint for a locked card, e.g. "Unlocks when your quote is ready." */
  unlockHint?: string
  onSelect?: () => void
  className?: string
}

/**
 * The applicant board's card anatomy (PRD "Applicant to-do board"): kind icon and label,
 * title, why line, reviewer chip, due date, sign-off progress or a payment amount, a
 * dashed border plus unlock hint while locked, the reviewer's message while a request is
 * pinned, and a check once done.
 */
function TaskCard({ task, today, unlockHint, onSelect, className }: TaskCardProps) {
  const locked = task.status === "locked"
  const done = task.status === "done"
  const pinned = Boolean(task.request) && task.request?.resolved === false
  // A pinned request carries its own, sooner date; the engine's helper knows which one applies.
  const dueDate = taskDueDate(task)
  const interactive = Boolean(onSelect)
  const progress = task.kind === "sign_off" ? task.payload.progress : undefined
  const amount = task.kind === "payment" ? task.payload.amount : undefined

  const cardClassName = cn(
    "flex w-full flex-col gap-2 rounded-panel border p-3.5 text-left transition-colors duration-[var(--dur-fast)] ease-frost",
    interactive && INTERACTIVE_FOCUS,
    locked && "border-dashed border-line-subtle bg-surface-soft",
    pinned && !locked && "border-indigo-650 bg-pill",
    !locked && !pinned && "border-line-subtle bg-surface-1",
    interactive && !locked && !pinned && "hover:border-indigo-650/40 hover:bg-surface-strong",
    className
  )

  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <TaskKindLabel kind={task.kind} />
        {done ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-success-fg">
            <CheckIcon className="size-3.5" aria-hidden="true" /> Done
          </span>
        ) : locked ? (
          <LockIcon className="size-3.5 shrink-0 text-fg-label" aria-hidden="true" />
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-fg">{task.title}</p>
        {pinned && task.request ? (
          <p className="text-xs text-fg-secondary">
            <span className="font-semibold text-fg">{PARTY_LABEL[task.request.from]} asks:</span>{" "}
            {task.request.message}
          </p>
        ) : (
          <p className="text-xs text-fg-secondary">{task.why}</p>
        )}
      </div>

      {progress ? (
        <Progress value={progress.done} max={progress.total} label={`${progress.done} of ${progress.total} neighbors`} />
      ) : null}

      {typeof amount === "number" ? <Money amount={amount} className="text-sm font-semibold text-fg" /> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">{task.reviewer ? <PartyChip party={task.reviewer} /> : null}</div>
        {locked ? (
          <span className="text-xs text-fg-secondary">{unlockHint ?? "Locked for now"}</span>
        ) : !done && dueDate ? (
          <DueDate date={dueDate} today={today} />
        ) : null}
      </div>
    </>
  )

  if (interactive) {
    return (
      <button type="button" onClick={onSelect} data-slot="task-card" data-status={task.status} className={cardClassName}>
        {content}
      </button>
    )
  }
  return (
    <div data-slot="task-card" data-status={task.status} className={cardClassName}>
      {content}
    </div>
  )
}

interface StackedTaskCardProps {
  /** "Vendor health permits" style title. */
  title: string
  done: number
  total: number
  onSelect?: () => void
  className?: string
}

/** The repeated-card stack, e.g. "Vendor health permits · 25 of 25", that expands in its own sheet. */
function StackedTaskCard({ title, done, total, onSelect, className }: StackedTaskCardProps) {
  const interactive = Boolean(onSelect)
  const complete = done >= total
  const cardClassName = cn(
    "flex w-full items-center justify-between gap-3 rounded-panel border border-line-subtle bg-surface-1 p-3.5 text-left transition-colors duration-[var(--dur-fast)] ease-frost",
    interactive && cn(INTERACTIVE_FOCUS, "hover:border-indigo-650/40 hover:bg-surface-strong"),
    className
  )
  const content = (
    <>
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-fg">{title}</p>
        <p className="text-xs text-fg-secondary">
          {done} of {total}
        </p>
      </div>
      {complete ? <CheckIcon className="size-4 shrink-0 text-success-fg" aria-hidden="true" /> : null}
    </>
  )

  if (interactive) {
    return (
      <button type="button" onClick={onSelect} data-slot="stacked-task-card" className={cardClassName}>
        {content}
      </button>
    )
  }
  return (
    <div data-slot="stacked-task-card" className={cardClassName}>
      {content}
    </div>
  )
}

export { TaskCard, StackedTaskCard }
