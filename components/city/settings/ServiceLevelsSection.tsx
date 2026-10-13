"use client";

/**
 * Settings, section 6: the review days, request response days, verification days and the
 * meeting and notice offsets from cfg.sla, editable. Each field names what it drives; every
 * edit calls `setConfig()` at once (these are defaults a later case-by-case choice can still
 * override, e.g. the Clerk's own due date on `confirm_routing`, so there is no invalid value to
 * guard against here the way a tier threshold needs).
 */
import * as React from "react";
import { Section } from "@/components/ui/section";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { RulesConfig } from "@/lib/rules/types";
import { TIER_LABEL, type Tier } from "@/lib/types";

interface ServiceLevelsSectionProps {
  cfg: RulesConfig;
  setConfig: (patch: Partial<RulesConfig>) => void;
}

type Sla = RulesConfig["sla"];

function ServiceLevelsSection({ cfg, setConfig }: ServiceLevelsSectionProps) {
  function set(patch: Partial<Sla>) {
    setConfig({ sla: { ...cfg.sla, ...patch } });
  }

  function setDays(key: Exclude<keyof Sla, "reviewDays" | "rollWeekendsBack">, value: number) {
    set({ [key]: Number.isFinite(value) && value >= 0 ? value : 0 } as Partial<Sla>);
  }

  function setReviewDays(tier: Tier, value: number) {
    set({ reviewDays: { ...cfg.sla.reviewDays, [tier]: Number.isFinite(value) && value >= 0 ? value : 0 } });
  }

  return (
    <Section title="Service levels" description="How long each step is expected to take by default. A case can still get its own due date; these are only what a new one starts from.">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-fg">Review</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Intake" hint="Days the Clerk's intake check is expected to take before a case is accepted or routed.">
              <Input type="number" min={0} value={cfg.sla.intakeDays} onChange={(e) => setDays("intakeDays", Number(e.target.value))} />
            </Field>
            {(["instant", "reviewed", "special"] as const).map((tier) => (
              <Field key={tier} label={`${TIER_LABEL[tier]} review`} hint="Days a review of this tier gets by default when routing is confirmed.">
                <Input type="number" min={0} value={cfg.sla.reviewDays[tier]} onChange={(e) => setReviewDays(tier, Number(e.target.value))} />
              </Field>
            ))}
            <Field label="Request response" hint="Days the applicant gets to answer a request for information.">
              <Input type="number" min={0} value={cfg.sla.requestResponseDays} onChange={(e) => setDays("requestResponseDays", Number(e.target.value))} />
            </Field>
            <Field label="Verification" hint="Days a reviewer gets to verify a submitted card before it is overdue.">
              <Input type="number" min={0} value={cfg.sla.verificationDays} onChange={(e) => setDays("verificationDays", Number(e.target.value))} />
            </Field>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-line-subtle pt-5">
          <h3 className="text-sm font-bold text-fg">Meetings and notices</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Pre-application meeting" hint="Days after acceptance the pre-application meeting is set for, by default.">
              <Input
                type="number"
                min={0}
                value={cfg.sla.preApplicationMeetingDaysAfterAcceptance}
                onChange={(e) => setDays("preApplicationMeetingDaysAfterAcceptance", Number(e.target.value))}
              />
            </Field>
            <Field label="Coordination meeting" hint="Days before the event the coordination meeting is set for, by default.">
              <Input type="number" min={0} value={cfg.sla.coordinationMeetingDaysBefore} onChange={(e) => setDays("coordinationMeetingDaysBefore", Number(e.target.value))} />
            </Field>
            <Field label="Walkthrough" hint="Days before the event the walkthrough is set for, by default.">
              <Input type="number" min={0} value={cfg.sla.walkthroughDaysBefore} onChange={(e) => setDays("walkthroughDaysBefore", Number(e.target.value))} />
            </Field>
            <Field label="Community notice" hint="Days before the event the community notice is due.">
              <Input type="number" min={0} value={cfg.sla.communityNoticeDaysBefore} onChange={(e) => setDays("communityNoticeDaysBefore", Number(e.target.value))} />
            </Field>
            <Field label="Vendor health permit" hint="Days before the event a vendor's health permit is due.">
              <Input type="number" min={0} value={cfg.sla.vendorHealthPermitDaysBefore} onChange={(e) => setDays("vendorHealthPermitDaysBefore", Number(e.target.value))} />
            </Field>
            <Field label="Food and vendor permits" hint="Days before the event food and vendor permits are due.">
              <Input type="number" min={0} value={cfg.sla.vendorFoodPermitsDaysBefore} onChange={(e) => setDays("vendorFoodPermitsDaysBefore", Number(e.target.value))} />
            </Field>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-line-subtle pt-5">
          <h3 className="text-sm font-bold text-fg">Closeout</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Closeout" hint="Days after the event closeout is expected to finish.">
              <Input type="number" min={0} value={cfg.sla.closeoutDaysAfterEvent} onChange={(e) => setDays("closeoutDaysAfterEvent", Number(e.target.value))} />
            </Field>
            <Field label="Final bill" hint="Days the applicant gets to pay a final bill after it is invoiced.">
              <Input type="number" min={0} value={cfg.sla.finalBillDaysAfterInvoice} onChange={(e) => setDays("finalBillDaysAfterInvoice", Number(e.target.value))} />
            </Field>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Switch id="roll-weekends-back" checked={cfg.sla.rollWeekendsBack} onCheckedChange={(checked) => set({ rollWeekendsBack: checked })} />
            <Label htmlFor="roll-weekends-back" className="normal-case">
              Push a due date landing on a weekend back to the Friday before
            </Label>
          </div>
        </div>
      </div>
    </Section>
  );
}

export { ServiceLevelsSection };
