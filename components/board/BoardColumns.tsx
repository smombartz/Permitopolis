"use client"

import { cn } from "cn"
import { useRouter } from "next/navigation"
import { StackedTaskCard, TaskCard } from "@/components/domain/TaskCard"
import { CountBadge } from "@/components/ui/count-badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useIsNarrow } from "@/components/shell"
import { fmtDateShort, plural } from "@/lib/format"
import type { BoardColumn } from "@/lib/state/types"
import type { EventCase, ISODate, Task } from "@/lib/types"
import {
  COLUMN_LABEL,
  boardColumnsGrouped,
  directLinkHref,
  opensSessionSchedule,
  phaseGroups,
  unlockHintFor,
  withCityColumnSummary,
  withCityInfo,
  type ColumnEntry,
  type StackedCards,
  type WithCityInfo,
} from "@/lib/view/board"

const COLUMN_ORDER: BoardColumn[] = ["do_now", "with_city", "coming_up", "done"]

const EMPTY_TEXT: Record<BoardColumn, string> = {
  do_now: "Nothing to do right now.",
  with_city: "Nothing waiting on the city.",
  coming_up: "Nothing coming up yet.",
  done: "Nothing done yet.",
}

/**
 * What a "With the city" card says under itself, so the column is never a black hole (PRD,
 * "Where I'd push on the brief"): who has it, how long, and when it is expected back, or that
 * there is no expected date yet. Before the case is routed the City Clerk's intake has it, and
 * the note says so and names the department it goes to next.
 */
function WithCityNote({ info }: { info: WithCityInfo }) {
  const holder = info.atIntake ? "at intake with the City Clerk" : `with ${info.deptLabel}`
  const next = info.atIntake && info.reviewer !== "clerk" ? `, then ${info.reviewerLabel}` : ""
  const expected = info.expectedBy ? `expected by ${fmtDateShort(info.expectedBy)}` : "no expected date yet"
  return (
    <p className={cn("px-0.5 text-xs", info.overdue ? "font-semibold text-danger-fg" : "text-fg-secondary")}>
      {info.overdue ? `Overdue ${holder}${next} · ${expected}` : `${plural(info.daysWaiting, "day")} ${holder}${next} · ${expected}`}
    </p>
  )
}

/** The "With the city" column's own summary line: who has what, and when it is expected back. */
function WithCitySummary({ c, today }: { c: EventCase; today: ISODate }) {
  const rows = withCityColumnSummary(c, today)
  if (rows.length === 0) return null
  return (
    <div className="flex flex-col gap-0.5 rounded-control bg-surface-soft px-3 py-2 text-xs text-fg-secondary" data-slot="with-city-summary">
      {rows.map((row) => (
        <p key={row.dept}>
          {plural(row.count, "card")} {row.atIntake ? "at intake with the City Clerk" : `with ${row.deptLabel}`},{" "}
          {row.expectedBy ? `expected by ${fmtDateShort(row.expectedBy)}` : "no expected date yet"}
        </p>
      ))}
    </div>
  )
}

interface EntryListProps {
  entries: ColumnEntry[]
  today: ISODate
  emptyText: string
  onSelect: (task: Task) => void
  onSelectStack: (stack: StackedCards) => void
  grid?: boolean
  /** Set only for the "With the city" column: annotates each card with who has it and for how long. */
  cityInfoFor?: (task: Task) => WithCityInfo | null
}

function EntryList({ entries, today, emptyText, onSelect, onSelectStack, grid = false, cityInfoFor }: EntryListProps) {
  if (entries.length === 0) {
    return <p className="rounded-panel border border-dashed border-line-subtle bg-surface-soft px-3 py-6 text-center text-xs text-fg-secondary">{emptyText}</p>
  }
  return (
    <div className={grid ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-3"}>
      {entries.map((entry) =>
        entry.kind === "stack" ? (
          <StackedTaskCard key={entry.catalogId} title={entry.title} done={entry.done} total={entry.total} onSelect={() => onSelectStack(entry)} />
        ) : (
          <div key={entry.task.id} className="flex flex-col gap-1.5">
            <TaskCard task={entry.task} today={today} unlockHint={unlockHintFor(entry.task.catalogId)} onSelect={() => onSelect(entry.task)} />
            {cityInfoFor ? (() => {
              const info = cityInfoFor(entry.task)
              return info ? <WithCityNote info={info} /> : null
            })() : null}
          </div>
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
          <TabsContent key={col} value={col} className="flex flex-col gap-3 pt-3">
            {col === "with_city" ? <WithCitySummary c={c} today={today} /> : null}
            <EntryList
              entries={grouped[col]}
              today={today}
              emptyText={EMPTY_TEXT[col]}
              onSelect={handleSelect}
              onSelectStack={onOpenStack}
              cityInfoFor={col === "with_city" ? (task) => withCityInfo(c, task, today) : undefined}
            />
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
          {col === "with_city" ? <WithCitySummary c={c} today={today} /> : null}
          <EntryList
            entries={grouped[col]}
            today={today}
            emptyText={EMPTY_TEXT[col]}
            onSelect={handleSelect}
            onSelectStack={onOpenStack}
            cityInfoFor={col === "with_city" ? (task) => withCityInfo(c, task, today) : undefined}
          />
        </div>
      ))}
    </div>
  )
}

export { BoardColumns, EntryList }
