import Link from "next/link";
import { CountBadge } from "@/components/ui/count-badge";
import { Truncate } from "@/components/ui/truncate";
import { CaseId, DateText, StateChip, TierBadge, WaitingOnChips } from "@/components/domain";
import { CommissionBadge } from "@/components/domain/CommissionBadge";
import { StalledBadge } from "@/components/domain/StalledBadge";
import { routes } from "@/lib/routes";
import { fmtDaysToGo } from "@/lib/format";
import { eventDate, isStalled } from "@/lib/state";
import type { EventCase, ISODate } from "@/lib/types";
import { applicantNameOf } from "@/lib/data/people";
import { boardCardWaiting } from "@/lib/view/cityLists";

/**
 * A board card reads top to bottom, one fact to a line: the event, when it is, what kind of
 * case it is, then (under a hairline) whose move it is. Nothing sits side by side but chips.
 */
function PipelineCard({ c, today, from, showStateChip }: { c: EventCase; today: ISODate; from: string; showStateChip: boolean }) {
  const date = eventDate(c, today);
  const waiting = boardCardWaiting(c, today);
  return (
    <li>
      <Link
        href={routes.city.case(c.id, { from })}
        className="flex flex-col gap-3 rounded-panel border border-line-subtle bg-surface-1 p-3 outline-none transition-colors duration-[var(--dur-fast)] ease-frost hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <Truncate text={c.name} lines={2} className="text-sm font-semibold text-fg" />
          <Truncate text={applicantNameOf(c)} className="text-xs text-fg-secondary" />
          <CaseId id={c.id} className="text-xs" />
        </div>
        {date ? (
          <div className="flex flex-col text-xs">
            <DateText date={date} short className="text-xs" />
            <span className="text-fg-label">{fmtDaysToGo(date, today)}</span>
          </div>
        ) : (
          <span className="text-xs text-fg-label">No date yet</span>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <TierBadge tier={c.tier} />
          {/* Grouped by state, the column already says it; grouped by deadline, the card carries its own state chip. An ending always shows. */}
          {c.ending ? <StateChip state={c.state} ending={c.ending} /> : showStateChip ? <StateChip state={c.state} /> : null}
          {isStalled(c, today) ? <StalledBadge /> : null}
          {c.flags.sentToCommission ? <CommissionBadge /> : null}
        </div>
        {/* A case that has ended waits on nobody. */}
        {c.ending ? null : (
          <div data-slot="card-waiting" className="border-t border-line-subtle pt-3">
            <WaitingOnChips items={waiting} emptyText="Nothing waiting" className="flex-col items-start text-xs [&>[data-slot=party-chip]]:max-w-full" />
          </div>
        )}
      </Link>
    </li>
  );
}

export interface BoardColumnSpec {
  key: string;
  label: string;
  cases: EventCase[];
}

/**
 * One column per `columns` entry (state, or the PRD-push deadline buckets); columns scroll
 * independently and an empty one stays, with a count of 0. `from` is this list's own URL: a
 * case opened from a card comes back to it. `showStateChip` puts the state on each card
 * instead of leaving it to the column, for a grouping that is not by state.
 */
function PipelineBoard({ columns, today, from, showStateChip = false }: { columns: BoardColumnSpec[]; today: ISODate; from: string; showStateChip?: boolean }) {
  return (
    // Wider than the page column: the board takes the window's width less the gutters, and
    // centers in it once its columns reach their widest (safe: never past the scroll start).
    <div className="page-bleed flex justify-center-safe gap-3 overflow-x-auto pb-2">
      {columns.map((column) => (
        // Flexible, so the columns share that width, but never under 240px (a card stays
        // readable, and the row scrolls sideways when all seven cannot fit) or over 320px (a
        // lone column under a State filter does not stretch its cards back into long rows).
        <div key={column.key} data-state={column.key} className="flex min-w-60 max-w-80 flex-1 basis-0 flex-col gap-2 rounded-panel border border-line-subtle bg-surface-2 p-2">
          <div className="flex items-center justify-between gap-2 px-1 pt-1">
            <h2 className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">{column.label}</h2>
            <CountBadge count={column.cases.length} />
          </div>
          <ul className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
            {/* An empty column, as the applicant's board draws one. */}
            {column.cases.length === 0 ? <li className="rounded-panel border border-dashed border-line-subtle bg-surface-soft px-3 py-6 text-center text-xs text-fg-secondary">Nothing here</li> : null}
            {column.cases.map((c) => (
              <PipelineCard key={c.id} c={c} today={today} from={from} showStateChip={showStateChip} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export { PipelineBoard };
