import Link from "next/link";
import { CountBadge } from "@/components/ui/count-badge";
import { CaseId, DateText, EventTitle, StateChip, TierBadge, WaitingOnChips } from "@/components/domain";
import { CommissionBadge } from "@/components/domain/CommissionBadge";
import { StalledBadge } from "@/components/domain/StalledBadge";
import { routes } from "@/lib/routes";
import { fmtDaysToGo } from "@/lib/format";
import { eventDate, isStalled } from "@/lib/state";
import type { EventCase, ISODate } from "@/lib/types";
import { applicantNameOf } from "@/lib/data/people";
import { boardCardWaiting } from "@/lib/view/cityLists";

function PipelineCard({ c, today, from, showStateChip }: { c: EventCase; today: ISODate; from: string; showStateChip: boolean }) {
  const date = eventDate(c, today);
  const waiting = boardCardWaiting(c, today);
  return (
    <li>
      <Link
        href={routes.city.case(c.id, { from })}
        className="flex flex-col gap-2 rounded-panel border border-line-subtle bg-surface-1 p-3 outline-none transition-colors duration-[var(--dur-fast)] ease-frost hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        <div className="flex items-start justify-between gap-2">
          <EventTitle name={c.name} applicantName={applicantNameOf(c)} className="flex-1" />
          <div className="flex shrink-0 items-center gap-1.5">
            {isStalled(c, today) ? <StalledBadge /> : null}
            {c.flags.sentToCommission ? <CommissionBadge /> : null}
            <TierBadge tier={c.tier} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs text-fg-secondary">
          <CaseId id={c.id} />
          {date ? (
            <span className="flex items-center gap-1.5">
              <DateText date={date} short className="text-xs" />
              <span aria-hidden="true">·</span>
              <span>{fmtDaysToGo(date, today)}</span>
            </span>
          ) : (
            <span>No date yet</span>
          )}
        </div>
        {/* Grouped by state, the column already says it; grouped by deadline, the card carries its own state chip. */}
        {showStateChip && !c.ending ? <StateChip state={c.state} /> : null}
        {c.ending ? <StateChip state={c.state} ending={c.ending} /> : <WaitingOnChips items={waiting} emptyText="Nothing waiting" />}
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
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((column) => (
        // Flexible, so the columns share the width of a 1280px window
        // (cards truncate); the row still scrolls sideways when they cannot.
        <div key={column.key} data-state={column.key} className="flex min-w-44 flex-1 basis-0 flex-col gap-2 rounded-panel border border-line-subtle bg-surface-2 p-2">
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
