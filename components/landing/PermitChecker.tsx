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
import { SECTION_ID } from "./sections";

const EVENT_TYPE_OPTIONS = Object.entries(EVENT_TYPE_LABEL) as [EventType, string][];
const HEADING_ID = "permit-checker-heading";

/**
 * "Check what your event needs": a short form that never touches the store, run straight
 * through the real `classify()` and `estimateFees()` (`heroPreviewResult` in the view-model, which
 * keeps its name from the page's first design). Every change updates the tier, the reasons, the
 * notice needed and the fee estimate in an `aria-live` region, with the what-if line. It is the
 * page's product moment, so it sits on the HUD panel and settles in once as the page opens; it
 * is a working form, so it is not tilted and does not float.
 */
function PermitChecker() {
  const [form, setForm] = React.useState<HeroPreviewForm>(HERO_PREVIEW_DEFAULT);
  const { classification, fees, whatIfs } = heroPreviewResult(form);
  const whatIf = whatIfs[0];

  function patch(next: Partial<HeroPreviewForm>) {
    setForm((prev) => ({ ...prev, ...next }));
  }

  return (
    <Panel
      variant="hud"
      id={SECTION_ID.checker}
      role="group"
      aria-labelledby={HEADING_ID}
      className="anim-material-settle flex scroll-mt-6 flex-col gap-5 p-5 sm:p-6"
    >
      <div className="flex flex-col gap-2">
        <h2 id={HEADING_ID} className="text-card font-bold text-fg">
          Check what your event needs
        </h2>
        <p className="text-sm text-fg-secondary">
          Change the answers to see the tier, the estimated fee and the notice needed. Nothing here is saved.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
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

      <div
        className="flex flex-col gap-3 rounded-panel border border-line-magnetic bg-surface-1 p-4"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="flex items-center justify-between gap-2">
          <TierBadge tier={classification.tier} />
          <p className="flex items-baseline gap-2 text-sm text-fg-label">
            Estimated fee
            <Money amount={fees.total} className="text-base font-bold text-fg" />
          </p>
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
        <p className="text-sm font-semibold text-fg">
          {classification.leadTimeDays === 0
            ? "Book and pay today."
            : `Apply at least ${plural(classification.leadTimeDays, "day")} before the event.`}
        </p>
        {whatIf ? <InlineAlert variant="info">{whatIf.text}</InlineAlert> : null}
      </div>
      <p className="sr-only">{`${fmtNumber(form.attendance)} people.`}</p>
    </Panel>
  );
}

export { PermitChecker };
