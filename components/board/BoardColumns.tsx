"use client"

import { useRouter } from "next/navigation"
import { StackedTaskCard, TaskCard } from "@/components/domain/TaskCard"
import { CountBadge } from "@/components/ui/count-badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useIsNarrow } from "@/components/shell"
import type { BoardColumn } from "@/lib/state/types"
import type { EventCase, ISODate, Task } from "@/lib/types"
import {
  COLUMN_LABEL,
  boardColumnsGrouped,
  directLinkHref,
  opensSessionSchedule,
  phaseGroups,
  unlockHintFor,
  type ColumnEntry,
  type StackedCards,
} from "@/lib/view/board"

const COLUMN_ORDER: BoardColumn[] = ["do_now", "with_city", "coming_up", "done"]

const EMPTY_TEXT: Record<BoardColumn, string> = {
  do_now: "Nothing to do right now.",
  with_city: "Nothing waiting on the city.",
  coming_up: "Nothing coming up yet.",
  done: "Nothing done yet.",
}

interface EntryListProps {
  entries: ColumnEntry[]
  today: ISODate
  emptyText: string
  onSelect: (task: Task) => void
  onSelectStack: (stack: StackedCards) => void
  grid?: boolean
}

function EntryList({ entries, today, emptyText, onSelect, onSelectStack, grid = false }: EntryListProps) {
  if (entries.length === 0) {
    return <p className="rounded-panel border border-dashed border-line-subtle bg-surface-soft px-3 py-6 text-center text-xs text-fg-secondary">{emptyText}</p>
  }
  return (
    <div className={grid ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-3"}>
      {entries.map((entry) =>
        entry.kind === "stack" ? (
          <StackedTaskCard key={entry.catalogId} title={entry.title} done={entry.done} total={entry.total} onSelect={() => onSelectStack(entry)} />
        ) : (
          <TaskCard
            key={entry.task.id}
            task={entry.task}
            today={today}
            unlockHint={unlockHintFor(entry.task.catalogId)}
            onSelect={() => onSelect(entry.task)}
          />
        ),
      )}
    </div>
  )
}

interface BoardColumnsProps {
  c: EventCase
  today: ISODate
  grouping: "columns" | "phase"
  activeTab: BoardColumn
  onActiveTabChange: (col: BoardColumn) => void
  onOpenCard: (taskId: string) => void
  onOpenStack: (stack: StackedCards) => void
  onOpenSeriesSchedule: () => void
}

/**
 * The board's four columns (PRD "Applicant to-do board"), or the phase swimlanes the toggle
 * switches to. Below 768px the columns become tabs with counts (useIsNarrow, not CSS, so a
 * render test without a stylesheet still sees exactly one layout).
 */
function BoardColumns({ c, today, grouping, activeTab, onActiveTabChange, onOpenCard, onOpenStack, onOpenSeriesSchedule }: BoardColumnsProps) {
  const router = useRouter()
  const narrow = useIsNarrow()

  function handleSelect(task: Task) {
    const link = directLinkHref(c, task)
    if (link) {
      router.push(link)
      return
    }
    if (opensSessionSchedule(c, task)) {
      onOpenSeriesSchedule()
      return
    }
    onOpenCard(task.id)
  }

  if (grouping === "phase") {
    const groups = phaseGroups(c)
    return (
      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <div key={group.phase} className="flex flex-col gap-3">
            <div className="flex items-center gap-2 border-b border-line-subtle pb-2">
              <h3 className="text-sm font-bold text-fg">{group.label}</h3>
              <CountBadge count={group.entries.length} />
            </div>
            <EntryList entries={group.entries} today={today} emptyText="" onSelect={handleSelect} onSelectStack={onOpenStack} grid />
          </div>
        ))}
      </div>
    )
  }

  const grouped = boardColumnsGrouped(c)

  if (narrow) {
    return (
      <Tabs value={activeTab} onValueChange={(v) => onActiveTabChange(v as BoardColumn)}>
        {/* Two rows of two: four nowrap tabs with their counts need about 450px, and a phone has 335. */}
        <TabsList className="grid w-full grid-cols-2 gap-1 group-data-horizontal/tabs:h-auto">
          {COLUMN_ORDER.map((col) => (
            <TabsTrigger key={col} value={col} className="h-9 gap-1.5 px-2 text-xs">
              {COLUMN_LABEL[col]}
              <CountBadge count={grouped[col].length} />
            </TabsTrigger>
          ))}
        </TabsList>
        {COLUMN_ORDER.map((col) => (
          <TabsContent key={col} value={col} className="pt-3">
            <EntryList entries={grouped[col]} today={today} emptyText={EMPTY_TEXT[col]} onSelect={handleSelect} onSelectStack={onOpenStack} />
          </TabsContent>
        ))}
      </Tabs>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      {COLUMN_ORDER.map((col) => (
        <div key={col} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-fg">{COLUMN_LABEL[col]}</h3>
            <CountBadge count={grouped[col].length} />
          </div>
          <EntryList entries={grouped[col]} today={today} emptyText={EMPTY_TEXT[col]} onSelect={handleSelect} onSelectStack={onOpenStack} />
        </div>
      ))}
    </div>
  )
}

export { BoardColumns, EntryList }
