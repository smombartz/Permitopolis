"use client";

import * as React from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/banner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AvailabilityBadge } from "@/components/domain";
import { DatePickerPopover } from "@/components/wizard/DatePickerPopover";
import { addDaysISO, weekdayOf } from "@/lib/dates";
import { fmtDate, fmtMoney } from "@/lib/format";
import { removeAddOnForTrigger, repeatsByDefault, sessionCountLabel, triggerDropLabel, weekdayName, type ResultPanel } from "@/lib/view/wizard";
import type { EventAnswers, Occurrence, Recurrence, Schedule } from "@/lib/types";

export interface StepWhenProps {
  answers: EventAnswers;
  onChange: (patch: Partial<EventAnswers>) => void;
  /** Sets `flags.lateFee` on the draft; a no-op before a draft exists (there is nothing to gate yet). */
  onLateFee: () => void;
  panel: ResultPanel;
  today: string;
}

const DEFAULT_SESSIONS_OUT = 7 * 11; // about 12 occurrences for a first-time weekly default

function blankSchedule(date: string): Schedule {
  return { date, start: "09:00", end: "17:00", occurrences: [] };
}

/** Step 3: date, times, repeat and the live availability + lead-time gate. */
function StepWhen({ answers, onChange, onLateFee, panel, today }: StepWhenProps) {
  const schedule = answers.schedule;

  function patchSchedule(patch: Partial<Schedule>) {
    const base = schedule ?? blankSchedule(today);
    onChange({ schedule: { ...base, ...patch, occurrences: [] } });
  }

  function handleDateChange(date: string) {
    const base = schedule ?? blankSchedule(date);
    const recurrence: Recurrence | undefined =
      base.recurrence ?? (!schedule && repeatsByDefault(answers.eventType)
        ? { frequency: "weekly", weekday: weekdayOf(date), until: addDaysISO(date, DEFAULT_SESSIONS_OUT) }
        : base.recurrence);
    onChange({ schedule: { ...base, date, recurrence, occurrences: [] } });
  }

  function toggleRepeat(checked: boolean) {
    if (!schedule) return;
    patchSchedule({
      recurrence: checked ? { frequency: "weekly", weekday: weekdayOf(schedule.date), until: addDaysISO(schedule.date, DEFAULT_SESSIONS_OUT) } : undefined,
    });
  }

  const occurrences: Occurrence[] = schedule?.occurrences ?? [];
  const firstOccurrence = occurrences[0];
  const gate = panel.dateGate;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-h5 font-bold text-fg">When?</h2>
        <p className="mt-1 text-sm text-fg-secondary">The date, the hours, and whether it repeats.</p>
      </div>

      <Field label="Date" required>
        <DatePickerPopover value={schedule?.date ?? null} onChange={handleDateChange} today={today} aria-label="Event date" />
      </Field>

      {schedule ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start time">
              <Input type="time" value={schedule.start} onChange={(event) => patchSchedule({ start: event.target.value })} />
            </Field>
            <Field label="End time">
              <Input type="time" value={schedule.end} onChange={(event) => patchSchedule({ end: event.target.value })} />
            </Field>
            <Field label="Setup start" hint="Optional.">
              <Input type="time" value={schedule.setupStart ?? ""} onChange={(event) => patchSchedule({ setupStart: event.target.value || undefined })} />
            </Field>
            <Field label="Teardown end" hint="Optional.">
              <Input type="time" value={schedule.teardownEnd ?? ""} onChange={(event) => patchSchedule({ teardownEnd: event.target.value || undefined })} />
            </Field>
          </div>

          <div className="flex flex-col gap-3 rounded-panel border border-line-subtle bg-surface-1 p-4">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="repeat-toggle" className="normal-case text-sm font-semibold text-fg tracking-normal">
                Repeat
              </Label>
              <Switch id="repeat-toggle" checked={!!schedule.recurrence} onCheckedChange={toggleRepeat} />
            </div>
            {schedule.recurrence ? (
              <div className="flex flex-col gap-3 border-t border-line-subtle pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Frequency">
                    <Select
                      value={schedule.recurrence.frequency}
                      onValueChange={(value) => patchSchedule({ recurrence: { ...schedule.recurrence!, frequency: value as "weekly" | "biweekly" } })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Every two weeks</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Ends on">
                    <DatePickerPopover
                      value={schedule.recurrence.until}
                      onChange={(until) => patchSchedule({ recurrence: { ...schedule.recurrence!, until } })}
                      today={today}
                      minDate={schedule.date}
                      aria-label="Repeat end date"
                    />
                  </Field>
                </div>
                <p className="text-xs text-fg-secondary">
                  Repeats every {weekdayName(schedule.recurrence.weekday)} &middot; {sessionCountLabel(schedule)}
                </p>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <p className="text-sm text-fg-secondary">Pick a date to set the hours and, if this repeats, an end date.</p>
      )}

      {firstOccurrence ? (
        <div className="flex flex-col gap-2">
          <AvailabilityBadge availability={firstOccurrence.availability} />
          {(firstOccurrence.availability.status === "booked" || firstOccurrence.availability.status === "blackout") &&
          firstOccurrence.availability.nextOpen &&
          firstOccurrence.availability.nextOpen.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {firstOccurrence.availability.nextOpen.map((date) => (
                <Button key={date} type="button" variant="secondary" size="sm" onClick={() => handleDateChange(date)}>
                  {fmtDate(date)}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {occurrences.length > 1 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">{sessionCountLabel(schedule!)}</p>
          <ul className="flex flex-col gap-1.5">
            {occurrences.map((occ) => (
              <li key={occ.date} className="flex items-center justify-between gap-2 rounded-control border border-line-subtle bg-surface-1 px-3 py-1.5">
                <span className="text-sm text-fg-secondary">{fmtDate(occ.date)}</span>
                {occ.billing === "skipped" ? (
                  <span className="text-xs font-medium text-fg-label">Skipped</span>
                ) : (
                  <AvailabilityBadge availability={occ.availability} />
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!gate.ok && gate.fixes.length > 0 ? (
        <Banner variant="warning">
          <div className="flex flex-col gap-2">
            <p>
              {!gate.leadTimeOk
                ? `This event needs ${gate.daysUntil >= 0 ? `${gate.daysUntil} more` : "more"} day${gate.daysUntil === 1 ? "" : "s"}' notice than it has.`
                : "That date isn't available."}
            </p>
            <div className="flex flex-wrap gap-2">
              {gate.fixes.includes("new_date") ? (
                <Button type="button" variant="secondary" size="sm" onClick={() => handleDateChange(gate.earliestDate)}>
                  Use {fmtDate(gate.earliestDate)}
                </Button>
              ) : null}
              {gate.fixes.includes("drop_addon")
                ? gate.droppable.map((id) => (
                    <Button key={id} type="button" variant="secondary" size="sm" onClick={() => onChange({ addOns: removeAddOnForTrigger(answers.addOns, id) })}>
                      Drop {triggerDropLabel(id)}
                    </Button>
                  ))
                : null}
              {gate.fixes.includes("late_fee") ? (
                <Button type="button" variant="secondary" size="sm" onClick={onLateFee}>
                  Pay a {fmtMoney(gate.lateFeeAmount)} late fee
                </Button>
              ) : null}
            </div>
          </div>
        </Banner>
      ) : null}
    </div>
  );
}

export { StepWhen };
