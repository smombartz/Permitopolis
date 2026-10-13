"use client";

import * as React from "react";
import { Panel } from "@/components/ui/panel";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Chip } from "@/components/ui/chip";
import { InlineAlert } from "@/components/ui/inline-alert";
import { TierBadge } from "@/components/domain";
import { Money } from "@/components/domain/Money";
import { EVENT_TYPE_LABEL, type EventType } from "@/lib/types";
import { fmtNumber, plural } from "@/lib/format";
import { HERO_PREVIEW_DEFAULT, HERO_WHERE_OPTIONS, heroPreviewResult, type HeroPreviewForm } from "@/lib/view/landing";

const EVENT_TYPE_OPTIONS = Object.entries(EVENT_TYPE_LABEL) as [EventType, string][];

/**
 * The hero's live product visual (plan 7, row 2): a tiny form that never touches the store,
 * run straight through the real `classify()` and `estimateFees()`. Every change updates the
 * tier badge, the reasons, the lead time and the fee estimate, with an `aria-live` region and
 * the what-if line. `components/landing/Hero.tsx` floats and rotates this panel; the panel
 * itself only ever holds its own local form state.
 */
function HeroPreviewPanel() {
  const [form, setForm] = React.useState<HeroPreviewForm>(HERO_PREVIEW_DEFAULT);
  const { classification, fees, whatIfs } = heroPreviewResult(form);
  const whatIf = whatIfs[0];

  function patch(next: Partial<HeroPreviewForm>) {
    setForm((prev) => ({ ...prev, ...next }));
  }

  return (
    <Panel
      variant="hud"
      role="group"
      className="flex w-full max-w-[420px] flex-col gap-5 p-6 shadow-stage"
      aria-label="Try it: describe an event and watch the tier change"
    >
      <div className="flex items-center gap-1.5" aria-hidden="true">
        <span className="size-2.5 rounded-full bg-chrome-red" />
        <span className="size-2.5 rounded-full bg-chrome-amber" />
        <span className="size-2.5 rounded-full bg-chrome-green" />
        <span className="ml-2 font-mono text-[11px] text-fg-tertiary">plan-an-event.tsx</span>{/* guard-allow-tertiary: decorative mock chrome, aria-hidden parent */}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Event type" className="col-span-2">
          <Select value={form.eventType} onValueChange={(value) => patch({ eventType: value as EventType })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPE_OPTIONS.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="col-span-2 flex flex-col gap-1.5">
          <Label>Where</Label>
          <SegmentedControl
            aria-label="Where the event is held"
            value={form.where}
            onChange={(value) => patch({ where: value })}
            options={HERO_WHERE_OPTIONS}
            className="w-full justify-between"
          />
        </div>

        <Field label="How many people">
          <Input
            type="number"
            min={1}
            max={5000}
            value={form.attendance}
            onChange={(event) => patch({ attendance: Math.max(0, Number(event.target.value) || 0) })}
          />
        </Field>

        <div className="flex flex-col justify-end gap-2.5 pb-1">
          <label className="flex items-center justify-between gap-2 text-sm text-fg-secondary">
            Amplified sound
            <Switch size="sm" checked={form.amplifiedSound} onCheckedChange={(checked) => patch({ amplifiedSound: checked })} />
          </label>
          <label className="flex items-center justify-between gap-2 text-sm text-fg-secondary">
            Alcohol
            <Switch size="sm" checked={form.alcohol} onCheckedChange={(checked) => patch({ alcohol: checked })} />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-panel border border-line-magnetic bg-surface-1 p-4" aria-live="polite" aria-atomic="true">
        <div className="flex items-center justify-between gap-2">
          <TierBadge tier={classification.tier} />
          <Money amount={fees.total} className="text-base font-bold text-fg" />
        </div>
        <p className="text-sm text-fg-secondary">{classification.summary}</p>
        {classification.triggers.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Why this tier">
            {classification.triggers.map((trigger) => (
              <li key={trigger.id}>
                <Chip variant="pill">{trigger.label}</Chip>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="font-mono text-[11px] text-fg-label uppercase tracking-[.12em]">
          {classification.leadTimeDays === 0
            ? "Book and pay today"
            : `${plural(classification.leadTimeDays, "day")} lead time`}
        </p>
        {whatIf ? <InlineAlert variant="info">{whatIf.text}</InlineAlert> : null}
      </div>
      <p className="sr-only">{`${fmtNumber(form.attendance)} people.`}</p>
    </Panel>
  );
}

export { HeroPreviewPanel };
