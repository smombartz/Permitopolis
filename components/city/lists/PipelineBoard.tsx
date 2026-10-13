import Link from "next/link";
import { CountBadge } from "@/components/ui/count-badge";
import { CaseId, StateChip, TierBadge, WaitingOnChips } from "@/components/domain";
import { routes } from "@/lib/routes";
import { fmtDaysToGo } from "@/lib/format";
import { eventDate } from "@/lib/state";
import { STATE_LABEL, type CaseState, type EventCase, type ISODate } from "@/lib/types";
import { PIPELINE_BOARD_STATES, applicantNameOf, boardCardWaiting } from "@/lib/view/cityLists";

function PipelineCard({ c, today }: { c: EventCase; today: ISODate }) {
  const date = eventDate(c, today);
  const waiting = boardCardWaiting(c, today);
  return (
    <li>
      <Link
        href={routes.city.case(c.id)}
        className="flex flex-col gap-2 rounded-panel border border-line-subtle bg-surface-1 p-3 outline-none transition-colors duration-[var(--dur-fast)] ease-frost hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{c.name}</p>
          <TierBadge tier={c.tier} />
        </div>
        <p className="truncate text-xs text-fg-secondary">{applicantNameOf(c)}</p>
        <div className="flex items-center justify-between gap-2 text-xs text-fg-secondary">
          <CaseId id={c.id} />
          {date ? <span>{fmtDaysToGo(date, today)}</span> : <span>No date yet</span>}
        </div>
        {c.ending ? <StateChip state={c.state} ending={c.ending} /> : <WaitingOnChips items={waiting} emptyText="Nothing waiting" />}
      </Link>
    </li>
  );
}

/** One column per state; columns scroll independently and an empty one stays, with a count of 0. */
function PipelineBoard({ columns, today }: { columns: Record<CaseState, EventCase[]>; today: ISODate }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {PIPELINE_BOARD_STATES.map((state) => {
        const cases = columns[state];
        return (
          <div key={state} className="flex w-72 shrink-0 flex-col gap-2 rounded-panel border border-line-subtle bg-surface-2 p-2">
            <div className="flex items-center justify-between gap-2 px-1 pt-1">
              <h3 className="text-xs font-bold tracking-[.08em] text-fg-label uppercase">{STATE_LABEL[state]}</h3>
              <CountBadge count={cases.length} />
            </div>
            <ul className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
              {cases.length === 0 ? <li className="rounded-control border border-dashed border-line-subtle p-3 text-center text-xs text-fg-secondary">Nothing here</li> : null}
              {cases.map((c) => (
                <PipelineCard key={c.id} c={c} today={today} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export { PipelineBoard };
