"use client"

import Link from "next/link"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import { CalendarPlusIcon, LayoutGridIcon, Rows3Icon } from "lucide-react"
import { BoardColumns, EntryList } from "@/components/board/BoardColumns"
import { BoardMenu } from "@/components/board/BoardMenu"
import { CardSheetContent } from "@/components/board/CardSheet"
import { SeriesScheduleSheet } from "@/components/board/SeriesScheduleSheet"
import { VendorStackSheet } from "@/components/board/VendorStackSheet"
import { CaseHeader } from "@/components/domain/CaseHeader"
import { EndingBanner } from "@/components/domain/EndingBanner"
import { PartyChip } from "@/components/domain/PartyChip"
import { CaseNotFound } from "@/components/shell/CaseNotFound"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Sheet } from "@/components/ui/sheet"
import { PERSONA_BY_ID } from "@/lib/data/people"
import { routes } from "@/lib/routes"
import { eventDate, useDemo } from "@/lib/state"
import type { BoardColumn } from "@/lib/state/types"
import { PARTY_LABEL, type EventCase } from "@/lib/types"
import {
  boardColumnsGrouped,
  dateHoldFootnote,
  reviewerRows,
  waitingOnChipItems,
  type StackedCards,
} from "@/lib/view/board"

type Grouping = "columns" | "phase"

/** Waiting-on chips, the date-hold's extra detail and the reviewers row, around CaseHeader. */
function StatusStrip({ c }: { c: EventCase }) {
  const today = useDemo((s) => s.demoToday)
  const waitingChips = waitingOnChipItems(c, today)
  const footnote = dateHoldFootnote(c)
  const rows = reviewerRows(c)

  return (
    <div className="flex flex-col gap-3 rounded-panel border border-line-subtle bg-surface-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold tracking-[.1em] text-fg-label uppercase">Waiting on</span>
          {waitingChips.length === 0 ? (
            <span className="text-sm text-fg-secondary">Nobody right now</span>
          ) : (
            waitingChips.map((item) => <PartyChip key={item.party} party={item.party} label={item.label} />)
          )}
        </div>
        {footnote ? <span className="text-sm text-fg-secondary">{footnote}</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-line-subtle pt-3 text-sm">
        {rows.map((row) => (
          <span key={row.dept} className="flex items-center gap-1.5">
            <span className="font-semibold text-fg">{PARTY_LABEL[row.dept]}</span>
            <span className="text-fg-secondary">{row.label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function DraftNotPlannedYet({ c }: { c: EventCase }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-h4 font-bold text-fg">{c.name || "Untitled event"}</h1>
        <Button asChild variant="secondary">
          <Link href={routes.events()}>Back to My events</Link>
        </Button>
      </div>
      <EmptyState
        icon={CalendarPlusIcon}
        title="This event is still being planned"
        text="Continue the wizard to see your tier, permits and to-do cards."
        action={
          <Button asChild>
            <Link href={routes.apply({ caseId: c.id })}>Continue in the wizard</Link>
          </Button>
        }
      />
    </div>
  )
}

/** The applicant board (PRD "Applicant to-do board"): /events/[id]. */
function BoardScreen() {
  const params = useParams<{ id: string }>()
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : ""
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const cases = useDemo((s) => s.cases)
  const today = useDemo((s) => s.demoToday)
  const c = cases.find((candidate) => candidate.id === id)

  const grouping: Grouping = searchParams.get("group") === "phase" ? "phase" : "columns"
  const cardParam = searchParams.get("card")

  function withParams(patch: Record<string, string | null>): string {
    const next = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    const qs = next.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  const activeTab = (searchParams.get("tab") as BoardColumn | null) ?? "do_now"

  if (!c) {
    return <CaseNotFound id={id} backHref={routes.events()} backLabel="Back to My events" />
  }

  if (c.state === "draft" && c.tasks.length === 0) {
    return <DraftNotPlannedYet c={c} />
  }

  const applicantName = PERSONA_BY_ID[c.applicantId]?.name ?? "The applicant"
  const grouped = boardColumnsGrouped(c)
  const stack: StackedCards | undefined = cardParam?.startsWith("stack:")
    ? Object.values(grouped)
        .flat()
        .find((entry): entry is StackedCards => entry.kind === "stack" && `stack:${entry.catalogId}` === cardParam)
    : undefined
  const openSeries = cardParam === "series"
  const openTask = cardParam && !openSeries && !stack ? c.tasks.find((t) => t.id === cardParam) : undefined
  const sheetOpen = Boolean(openTask || stack || openSeries)

  function closeSheet() {
    router.replace(withParams({ card: null }))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <CaseHeader
          className="flex-1"
          name={c.name || "Untitled event"}
          tier={c.tier}
          caseId={c.id}
          applicantName={applicantName}
          eventDate={eventDate(c, today)}
          today={today}
          state={c.state}
          ending={c.ending}
          hold={c.dateHold}
        />
        <BoardMenu c={c} />
      </div>

      {c.ending ? <EndingBanner ending={c.ending} reason={c.endingReason} /> : <StatusStrip c={c} />}

      {!c.ending ? (
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-fg">Board</h2>
          <SegmentedControl
            aria-label="Group cards by"
            value={grouping}
            onChange={(value) => router.replace(withParams({ group: value === "columns" ? null : value }))}
            options={[
              { value: "columns", label: "By status", icon: <LayoutGridIcon className="size-3.5" aria-hidden="true" /> },
              { value: "phase", label: "By phase", icon: <Rows3Icon className="size-3.5" aria-hidden="true" /> },
            ]}
          />
        </div>
      ) : (
        <h2 className="text-base font-bold text-fg">Done</h2>
      )}

      {c.ending ? (
        <EntryList
          entries={grouped.done}
          today={today}
          emptyText="Nothing was finished before this ended."
          onSelect={(task) => router.replace(withParams({ card: task.id }))}
          onSelectStack={(entry) => router.replace(withParams({ card: `stack:${entry.catalogId}` }))}
        />
      ) : (
        <BoardColumns
          c={c}
          today={today}
          grouping={grouping}
          activeTab={activeTab}
          onActiveTabChange={(col) => router.replace(withParams({ tab: col }))}
          onOpenCard={(taskId) => router.replace(withParams({ card: taskId }))}
          onOpenStack={(entry) => router.replace(withParams({ card: `stack:${entry.catalogId}` }))}
          onOpenSeriesSchedule={() => router.replace(withParams({ card: "series" }))}
        />
      )}

      <Sheet open={sheetOpen} onOpenChange={(open) => !open && closeSheet()}>
        {openTask ? <CardSheetContent c={c} task={openTask} onClose={closeSheet} /> : null}
        {stack ? (
          <VendorStackSheet
            stack={stack}
            onSelectTask={(taskId) => router.replace(withParams({ card: taskId }))}
          />
        ) : null}
        {openSeries ? <SeriesScheduleSheet c={c} /> : null}
      </Sheet>
    </div>
  )
}

export { BoardScreen }
