"use client";

import * as React from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AvailabilityBadge, BillingBadge, DateText } from "@/components/domain";
import { DateGateBanner } from "@/components/wizard/DateGateBanner";
import { DatePickerPopover } from "@/components/wizard/DatePickerPopover";
import { fmtDate } from "@/lib/format";
import { blankSchedule, defaultRecurrence, removeAddOnForTrigger, scheduleOnDate, sessionCountLabel, weekdayName, type ResultPanel } from "@/lib/view/wizard";
import type { EventAnswers, Occurrence, Schedule } from "@/lib/types";

export interface StepWhenProps {
  answers: EventAnswers;
  onChange: (patch: Partial<EventAnswers>) => void;
  /** Sets or clears `flags.lateFee` on the draft; a no-op before a draft exists (there is nothing to gate yet). */
  onLateFee: (on: boolean) => void;
  /** The applicant has chosen the late fee. */
  lateFee: boolean;
  panel: ResultPanel;
  today: string;
}

/** Step 3: date, times, repeat and the live availability + lead-time gate. */
function StepWhen({ answers, onChange, onLateFee, lateFee, panel, today }: StepWhenProps) {
  const schedule = answers.schedule;

  function patchSchedule(patch: Partial<Schedule>) {
    const base = schedule ?? blankSchedule(today);
    onChange({ schedule: { ...base, ...patch, occurrences: [] } });
  }

  // A series follows its first date to a new weekday (see scheduleOnDate).
  function handleDateChange(date: string) {
    onChange({ schedule: scheduleOnDate(schedule, date, answers.eventType) });
  }

  function toggleRepeat(checked: boolean) {
    if (!schedule) return;
    patchSchedule({ recurrence: checked ? defaultRecurrence(schedule.date) : undefined });
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
                <DateText date={occ.date} />
                {occ.billing === "skipped" ? (
                  <BillingBadge billing="skipped" />
                ) : (
                  <AvailabilityBadge availability={occ.availability} />
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <DateGateBanner
        gate={gate}
        leadTimeDays={panel.leadTimeDays}
        lateFee={lateFee}
        onNewDate={handleDateChange}
        onDropAddOn={(id) => onChange({ addOns: removeAddOnForTrigger(answers.addOns, id) })}
        onLateFee={onLateFee}
      />
    </div>
  );
}

export { StepWhen };
