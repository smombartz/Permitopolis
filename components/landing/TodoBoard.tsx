import { Panel } from "@/components/ui/panel";
import { Chip } from "@/components/ui/chip";
import { TaskCard } from "@/components/domain";
import { boardColumns } from "@/lib/state";
import { DEFAULT_DEMO_TODAY } from "@/lib/rules";
import { TIER_LABEL, type EventCase } from "@/lib/types";
import { SectionHeading } from "./SectionHeading";

const JAZZ_IN_THE_PLAZA_ID = "PMT-27-0118";

interface TodoBoardProps {
  seed: EventCase[];
}

/**
 * Your to-do board (plan 7, row 6): an alternating feature block (copy on the right this
 * time, after the hero's copy-on-the-left), illustrated with real `TaskCard`s from Jazz in
 * the Plaza's own board — the plan becomes exactly these cards, not a mockup of them.
 */
function TodoBoard({ seed }: TodoBoardProps) {
  const jazz = seed.find((c) => c.id === JAZZ_IN_THE_PLAZA_ID);
  if (!jazz) return null;
  const columns = boardColumns(jazz);
  const doNow = columns.do_now[0];
  const done = columns.done.slice(0, 2);
  const comingUp = columns.coming_up.slice(0, 1);

  return (
    <section className="page-container flex flex-col items-center gap-12 py-[var(--section-space)] lg:flex-row-reverse lg:items-start lg:gap-16">
      <div className="flex max-w-[480px] flex-col gap-5">
        <SectionHeading
          eyebrow="Your to-do board"
          title="The plan becomes a board"
          lead="Every document to upload and every action to take lands on one board, each card saying why it's needed and when it's due."
        />
        <p className="text-sm text-fg-secondary">
          These are {jazz.name}&rsquo;s real cards on the demo date — a reviewer&rsquo;s request pinned to the top,
          what&rsquo;s already done, and what&rsquo;s still coming.
        </p>
      </div>
      <Panel variant="frosted" className="flex w-full max-w-[520px] flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-fg">{jazz.name}</h3>
          <Chip variant="neutral">{TIER_LABEL[jazz.tier]}</Chip>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-hidden="true">
          {doNow ? <TaskCard task={doNow} today={DEFAULT_DEMO_TODAY} /> : null}
          {done.map((task) => (
            <TaskCard key={task.id} task={task} today={DEFAULT_DEMO_TODAY} />
          ))}
          {comingUp.map((task) => (
            <TaskCard key={task.id} task={task} today={DEFAULT_DEMO_TODAY} />
          ))}
        </div>
        <p className="sr-only">
          {jazz.name}&rsquo;s board: {doNow ? `${doNow.title} is due now. ` : ""}
          {done.map((t) => t.title).join(", ")} are done. {comingUp.map((t) => t.title).join(", ")} is coming up.
        </p>
      </Panel>
    </section>
  );
}

export { TodoBoard };
