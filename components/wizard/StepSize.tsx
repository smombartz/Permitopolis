"use client";

import * as React from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/banner";
import {
  addOnEffectText,
  defaultCityServices,
  defaultFoodVending,
  defaultTentsStages,
  locationForSpace,
} from "@/lib/view/wizard";
import { capacityWarning, type RulesConfig } from "@/lib/rules";
import type { EventAnswers } from "@/lib/types";

export interface StepSizeProps {
  answers: EventAnswers;
  onChange: (patch: Partial<EventAnswers>) => void;
  cfg: RulesConfig;
}

function ToggleRow({
  label,
  effect,
  checked,
  onCheckedChange,
  children,
}: {
  label: string;
  effect: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-2 rounded-panel border border-line-subtle bg-surface-1 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor={id} className="normal-case text-sm font-semibold text-fg tracking-normal">
            {label}
          </Label>
          <p className="text-xs text-fg-secondary">{effect}</p>
        </div>
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      </div>
      {checked && children ? <div className="flex flex-col gap-3 border-t border-line-subtle pt-3">{children}</div> : null}
    </div>
  );
}

function parseVendorNames(text: string): string[] {
  return text
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

/**
 * The vendor names, typed as one comma-separated line. The text as typed is kept here: the
 * draft stores the parsed list, and drawing the field from that list would drop every space
 * and comma the moment it was typed ("Rolling Dumpling Co." could not be written at all).
 */
function VendorNamesField({ names, onChange }: { names: string[]; onChange: (names: string[]) => void }) {
  const [text, setText] = React.useState(() => names.join(", "));
  return (
    <Field label="Vendor names" hint="Optional, separated by commas.">
      <Input
        value={text}
        placeholder="Rolling Dumpling Co., Bao Bus"
        onChange={(event) => {
          setText(event.target.value);
          onChange(parseVendorNames(event.target.value));
        }}
      />
    </Field>
  );
}

/** Step 4: expected attendance and every add-on toggle, each with its one-line effect. */
function StepSize({ answers, onChange, cfg }: StepSizeProps) {
  const addOns = answers.addOns;
  const warning = capacityWarning(answers);

  function patchAddOns(patch: Partial<EventAnswers["addOns"]>) {
    onChange({ addOns: { ...addOns, ...patch } });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-h5 font-bold text-fg">How big, and what&apos;s included?</h2>
        <p className="mt-1 text-sm text-fg-secondary">Expected attendance and anything else your event needs.</p>
      </div>

      <Field label="Expected attendance" required>
        <Input
          type="number"
          min={0}
          inputMode="numeric"
          value={answers.attendance ?? ""}
          onChange={(event) => onChange({ attendance: event.target.value === "" ? null : Number(event.target.value) })}
        />
      </Field>

      {warning ? (
        <Banner variant="warning">
          {warning.text}
          {warning.suggestionId ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={() => onChange({ location: locationForSpace(warning.suggestionId!) })}
            >
              Use a larger space
            </Button>
          ) : null}
        </Banner>
      ) : null}

      <div className="flex flex-col gap-3">
        <ToggleRow
          label="Amplified sound"
          effect={addOnEffectText("amplifiedSound", cfg)}
          checked={addOns.amplifiedSound}
          onCheckedChange={(checked) => patchAddOns({ amplifiedSound: checked })}
        />

        <ToggleRow
          label="Alcohol"
          effect={addOnEffectText("alcohol", cfg)}
          checked={addOns.alcohol}
          onCheckedChange={(checked) => patchAddOns({ alcohol: checked })}
        />

        <ToggleRow
          label="Food or vending"
          effect={addOnEffectText("foodVending", cfg)}
          checked={addOns.foodVending !== null}
          onCheckedChange={(checked) => patchAddOns({ foodVending: checked ? defaultFoodVending() : null })}
        >
          <Field label="Number of vendors">
            <Input
              type="number"
              min={1}
              value={addOns.foodVending?.vendors ?? 1}
              onChange={(event) => patchAddOns({ foodVending: { ...addOns.foodVending!, vendors: Math.max(1, Number(event.target.value) || 1) } })}
            />
          </Field>
          <VendorNamesField
            names={addOns.foodVending?.vendorNames ?? []}
            onChange={(vendorNames) => patchAddOns({ foodVending: { ...addOns.foodVending!, vendorNames } })}
          />
        </ToggleRow>

        <ToggleRow
          label="Tents and stages"
          effect={addOnEffectText("tentsStages", cfg)}
          checked={addOns.tentsStages !== null}
          onCheckedChange={(checked) => patchAddOns({ tentsStages: checked ? defaultTentsStages() : null })}
        >
          <Field label="Number of structures">
            <Input
              type="number"
              min={1}
              value={addOns.tentsStages?.count ?? 1}
              onChange={(event) => patchAddOns({ tentsStages: { count: Math.max(1, Number(event.target.value) || 1) } })}
            />
          </Field>
        </ToggleRow>

        <ToggleRow
          label="Cooking or generators"
          effect={addOnEffectText("cookingGenerators", cfg)}
          checked={addOns.cookingGenerators}
          onCheckedChange={(checked) => patchAddOns({ cookingGenerators: checked })}
        />

        <ToggleRow
          label="Fireworks or drones"
          effect={addOnEffectText("fireworksDrones", cfg)}
          checked={addOns.fireworksDrones}
          onCheckedChange={(checked) => patchAddOns({ fireworksDrones: checked })}
        />

        <ToggleRow
          label="Admission charged"
          effect={addOnEffectText("admission", cfg)}
          checked={addOns.admission}
          onCheckedChange={(checked) => patchAddOns({ admission: checked })}
        />

        <ToggleRow
          label="City services needed"
          effect={addOnEffectText("cityServices", cfg)}
          checked={addOns.cityServices !== null}
          onCheckedChange={(checked) => patchAddOns({ cityServices: checked ? defaultCityServices() : null })}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Barricades">
              <Input
                type="number"
                min={0}
                value={addOns.cityServices?.barricades ?? 0}
                onChange={(event) => patchAddOns({ cityServices: { ...addOns.cityServices!, barricades: Number(event.target.value) || 0 } })}
              />
            </Field>
            <Field label="Police officers">
              <Input
                type="number"
                min={0}
                value={addOns.cityServices?.policeOfficers ?? 0}
                onChange={(event) => patchAddOns({ cityServices: { ...addOns.cityServices!, policeOfficers: Number(event.target.value) || 0 } })}
              />
            </Field>
            <Field label="Police hours">
              <Input
                type="number"
                min={0}
                value={addOns.cityServices?.policeHours ?? 0}
                onChange={(event) => patchAddOns({ cityServices: { ...addOns.cityServices!, policeHours: Number(event.target.value) || 0 } })}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="city-services-trash"
                checked={addOns.cityServices?.trash ?? false}
                onCheckedChange={(checked) => patchAddOns({ cityServices: { ...addOns.cityServices!, trash: checked } })}
              />
              <Label htmlFor="city-services-trash" className="normal-case text-sm font-normal text-fg-secondary tracking-normal">
                Trash
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="city-services-power"
                checked={addOns.cityServices?.power ?? false}
                onCheckedChange={(checked) => patchAddOns({ cityServices: { ...addOns.cityServices!, power: checked } })}
              />
              <Label htmlFor="city-services-power" className="normal-case text-sm font-normal text-fg-secondary tracking-normal">
                Power
              </Label>
            </div>
          </div>
        </ToggleRow>
      </div>
    </div>
  );
}

export { StepSize };
