"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { TrafficConeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { Chip } from "@/components/ui/chip";
import { CaseId, EventTitle } from "@/components/domain";
import { applicantNameOf } from "@/lib/data/people";
import { fmtTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useDemo } from "@/lib/state";
import type { EventCase } from "@/lib/types";
import { closedAtNote, closureChecklist, reopenedAtNote, WORK_ORDER_KIND_LABEL, type WorkOrderKind } from "@/lib/view/workOrders";

interface TodayCardProps {
  c: EventCase;
  here: string;
}

/** One event's closure checklist for the day: its work orders, Mark done, and the Closed/Reopened note. */
function TodayCard({ c, here }: TodayCardProps) {
  const [time, setTime] = React.useState("");
  const dispatch = useDemo((s) => s.dispatch);
  const checklist = closureChecklist(c);

  function record(build: (time: string) => string) {
    if (!time) return;
    const result = dispatch(c.id, { type: "add_note", text: build(fmtTime(time)) });
    if (result.ok) toast.success("Note added.");
  }

  return (
    <div className="flex flex-col gap-3 rounded-panel border border-line-subtle bg-surface-1 p-4">
      <div className="flex items-center justify-between gap-3">
        <EventTitle name={c.name} applicantName={applicantNameOf(c)} className="min-w-0" />
        <CaseId id={c.id} />
      </div>
      <ul className="flex flex-col gap-1.5" aria-label={`${c.name}'s closure checklist`}>
        {checklist.map((task) => (
          <li key={task.id} className="flex items-center justify-between gap-3 rounded-control border border-line-subtle bg-surface-2 px-3 py-1.5">
            <span className="text-sm text-fg">{WORK_ORDER_KIND_LABEL[task.catalogId.slice("work_order:".length) as WorkOrderKind] ?? task.title}</span>
            <div className="flex items-center gap-2">
              <Chip variant={task.status === "done" ? "success" : "neutral"}>{task.status === "done" ? "Done" : "Scheduled"}</Chip>
              {task.status === "done" ? null : (
                <Button asChild size="sm" variant="secondary">
                  <Link href={routes.city.case(c.id, { task: task.id, from: here })}>Mark done</Link>
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Field label="Time" hint="Recorded on the activity log as “Closed at” or “Reopened at”.">
        <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
      </Field>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={!time} onClick={() => record(closedAtNote)}>
          Record closed at
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={!time} onClick={() => record(reopenedAtNote)}>
          Record reopened at
        </Button>
      </div>
    </div>
  );
}

interface TodayPanelProps {
  cases: EventCase[];
  here: string;
}

/** The Day-of panel (5C, kept light): today's street closures, each with its checklist. */
function TodayPanel({ cases, here }: TodayPanelProps) {
  if (cases.length === 0) return null;

  return (
    <Section title="Today" description="Street closures on Event day right now." actions={<TrafficConeIcon className="size-5 text-fg-label" aria-hidden />}>
      <div className="flex flex-col gap-3">
        {cases.map((c) => (
          <TodayCard key={c.id} c={c} here={here} />
        ))}
      </div>
    </Section>
  );
}

export { TodayPanel };
