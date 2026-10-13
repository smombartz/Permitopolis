"use client";

/**
 * Settings, section 2: the fee schedule, grouped as the brief lists it, plus the late fee rate
 * and the date-hold length. Every edit calls `setConfig()` at once: `estimateFees()` always
 * reads the store's current config, so a new estimate picks the change up immediately, and a
 * quote or estimate already on a case keeps the lines it was given (fee lines live on the case,
 * not on the config).
 */
import * as React from "react";
import { Section } from "@/components/ui/section";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InlineAlert } from "@/components/ui/inline-alert";
import type { RulesConfig } from "@/lib/rules/types";
import { FEE_GROUP_LABEL, FEE_GROUP_ORDER, feeFieldsByGroup, updateFeeField } from "@/lib/view/settings";

interface FeesSectionProps {
  cfg: RulesConfig;
  setConfig: (patch: Partial<RulesConfig>) => void;
}

function FeesSection({ cfg, setConfig }: FeesSectionProps) {
  const groups = feeFieldsByGroup();
  const [lateFeePercent, setLateFeePercent] = React.useState(() => Math.round(cfg.lateFee.rate * 100));
  const [holdDays, setHoldDays] = React.useState(cfg.hold.daysAfterQuote);

  function setFee(id: string, value: number) {
    setConfig({ fees: updateFeeField(cfg.fees, id, value) });
  }

  function setLateFeeRate(percent: number) {
    const clamped = Number.isFinite(percent) && percent >= 0 ? percent : 0;
    setLateFeePercent(clamped);
    setConfig({ lateFee: { ...cfg.lateFee, rate: clamped / 100 } });
  }

  function setHold(days: number) {
    const clamped = Number.isFinite(days) && days >= 0 ? days : 0;
    setHoldDays(clamped);
    setConfig({ hold: { daysAfterQuote: clamped } });
  }

  return (
    <Section title="Fees and deposits" description="The fee schedule behind every estimate and quote, with the late fee rate and how long a quote holds the date.">
      <InlineAlert variant="info">Changes apply to new estimates. A quote or estimate already sent keeps the lines it was given.</InlineAlert>

      <div className="flex flex-col gap-6">
        {FEE_GROUP_ORDER.map((group) => (
          <div key={group} className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-fg">{FEE_GROUP_LABEL[group]}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groups[group].map((field) => (
                <Field key={field.id} label={field.label} hint={field.unit === "flat" ? "Flat amount" : field.unit}>
                  <Input type="number" min={0} step="0.01" value={field.get(cfg.fees)} onChange={(e) => setFee(field.id, Number(e.target.value))} />
                </Field>
              ))}
            </div>
          </div>
        ))}

        <div className="flex flex-col gap-3 border-t border-line-subtle pt-5">
          <h3 className="text-sm font-bold text-fg">Late fee and date hold</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Late fee" hint="Percent of fees (the deposit excluded), charged when a date inside the lead time is accepted late.">
              <Input type="number" min={0} max={100} value={lateFeePercent} onChange={(e) => setLateFeeRate(Number(e.target.value))} />
            </Field>
            <Field label="Date hold" hint="Days a sent quote holds the date before it expires unpaid.">
              <Input type="number" min={0} value={holdDays} onChange={(e) => setHold(Number(e.target.value))} />
            </Field>
          </div>
        </div>
      </div>
    </Section>
  );
}

export { FeesSection };
