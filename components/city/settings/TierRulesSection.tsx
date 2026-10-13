"use client";

/**
 * Settings, section 1: the tier thresholds and lead times. Every edit calls `setConfig()` only
 * once it passes `validateTierRules()`; an invalid value stays on screen with its error and is
 * never saved. The "What this changes" panel computes both the open Drafts and the six demo
 * scenarios straight from `classify()` under the edited values (lib/view/settings.ts), so it
 * reads right even while the edit is invalid and unsaved. The store re-classifies every open
 * Draft with each saved edit (`setConfig()`), so a draft's own board and wizard already show the
 * new tier; the panel compares against the rules as they were when the section opened.
 */
import * as React from "react";
import { Section } from "@/components/ui/section";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StickyAside } from "@/components/ui/sticky-aside";
import { EmptyState } from "@/components/ui/empty-state";
import { SlidersHorizontalIcon } from "lucide-react";
import { CaseId, TierBadge } from "@/components/domain";
import { DEFAULT_CONFIG } from "@/lib/rules";
import type { RulesConfig } from "@/lib/rules/types";
import { plural } from "@/lib/format";
import type { EventCase, Tier } from "@/lib/types";
import {
  applyTierRules,
  openDraftTierChanges,
  scenarioPreviewLine,
  scenarioTierPreviews,
  tierRulesAreValid,
  tierRulesFromConfig,
  validateTierRules,
  type ScenarioPreviewRow,
  type TierChangeRow,
  type TierRulesEdits,
} from "@/lib/view/settings";

const LEAD_TIME_TIERS: Tier[] = ["instant", "reviewed", "special"];

interface TierRulesSectionProps {
  cfg: RulesConfig;
  cases: EventCase[];
  setConfig: (patch: Partial<RulesConfig>) => void;
}

function TierRulesSection({ cfg, cases, setConfig }: TierRulesSectionProps) {
  const [edits, setEdits] = React.useState<TierRulesEdits>(() => tierRulesFromConfig(cfg));
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const errors = validateTierRules(edits);

  // Each valid edit calls setConfig() at once (the brief's "editing calls setConfig"), so the
  // live `cfg` prop already carries every change saved so far: it is never "the old value" to
  // diff against. `baseline` is the config as this section opened, captured once, so the panel
  // keeps showing the session's cumulative effect instead of collapsing to "unchanged" the
  // moment each keystroke's edit is saved. Restoring defaults moves the baseline too, so the
  // next edit is measured from the defaults, not from whatever was open before the restore.
  const [baseline, setBaseline] = React.useState<RulesConfig>(cfg);

  function commit(next: TierRulesEdits) {
    setEdits(next);
    if (tierRulesAreValid(validateTierRules(next))) {
      const nextCfg = applyTierRules(cfg, next);
      setConfig({ thresholds: nextCfg.thresholds, leadTimeDays: nextCfg.leadTimeDays });
    }
  }

  function updateLeadTime(tier: Tier, value: number) {
    commit({ ...edits, leadTimeDays: { ...edits.leadTimeDays, [tier]: value } });
  }

  function restoreDefaults() {
    const defaults = tierRulesFromConfig(DEFAULT_CONFIG);
    setEdits(defaults);
    setBaseline(DEFAULT_CONFIG);
    setConfig({ thresholds: DEFAULT_CONFIG.thresholds, leadTimeDays: DEFAULT_CONFIG.leadTimeDays });
  }

  const editedCfg = applyTierRules(cfg, edits);
  const draftChanges = openDraftTierChanges(cases, baseline, editedCfg);
  const scenarioRows = scenarioTierPreviews(cases, baseline, editedCfg);

  return (
    <Section
      title="Tier rules"
      description="The thresholds that decide Instant, Reviewed or Special, and how much notice each tier needs. Editing one re-classifies every open Draft live."
      actions={
        <Button type="button" variant="secondary" onClick={() => setConfirmOpen(true)}>
          Restore defaults
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Reviewed at" hint="This many people or more makes an event Reviewed, not Instant." error={errors.reviewedAttendance}>
              <Input type="number" min={0} value={edits.reviewedAttendance} onChange={(e) => commit({ ...edits, reviewedAttendance: Number(e.target.value) })} />
            </Field>
            <Field label="Special at" hint="This many people or more makes an event a Special event." error={errors.specialAttendance}>
              <Input type="number" min={0} value={edits.specialAttendance} onChange={(e) => commit({ ...edits, specialAttendance: Number(e.target.value) })} />
            </Field>
            <Field
              label="Block-party limit"
              hint="Fewer people than this, on one residential block with no food or vending, skips review as a block party."
              error={errors.blockPartyMaxAttendance}
            >
              <Input
                type="number"
                min={0}
                value={edits.blockPartyMaxAttendance}
                onChange={(e) => commit({ ...edits, blockPartyMaxAttendance: Number(e.target.value) })}
              />
            </Field>
            <Field
              label="Heavy resources: barricades"
              hint="More than this many barricades (or any police staffing) counts as heavy city resources, which makes the event Special."
              error={errors.heavyBarricades}
            >
              <Input type="number" min={0} value={edits.heavyBarricades} onChange={(e) => commit({ ...edits, heavyBarricades: Number(e.target.value) })} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {LEAD_TIME_TIERS.map((tier) => (
              <Field key={tier} label={`${TIER_LABEL_SHORT[tier]} lead time`} hint="Days of notice required before the event." error={errors.leadTimeDays?.[tier]}>
                <Input type="number" min={0} value={edits.leadTimeDays[tier]} onChange={(e) => updateLeadTime(tier, Number(e.target.value))} />
              </Field>
            ))}
          </div>
        </div>

        <WhatThisChangesPanel draftChanges={draftChanges} scenarioRows={scenarioRows} />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Restore the default tier rules?"
        body="This resets the thresholds and lead times above to the prototype's defaults. Fees, templates and service levels are not affected."
        confirmLabel="Restore defaults"
        onConfirm={restoreDefaults}
      />
    </Section>
  );
}

const TIER_LABEL_SHORT: Record<Tier, string> = { instant: "Instant", reviewed: "Reviewed", special: "Special" };

interface WhatThisChangesPanelProps {
  draftChanges: TierChangeRow[];
  scenarioRows: ScenarioPreviewRow[];
}

function WhatThisChangesPanel({ draftChanges, scenarioRows }: WhatThisChangesPanelProps) {
  const changedScenarios = scenarioRows.filter((r) => r.before !== r.after).length;
  return (
    <StickyAside aria-label="What this changes" className="w-full lg:w-auto">
      <div className="flex flex-col gap-5">
        <div>
          <h3 className="text-sm font-bold text-fg">What this changes</h3>
          <p className="text-xs text-fg-secondary">Under the values at left, before anything is relied on.</p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">
            {draftChanges.length === 0 ? "Open Drafts" : `${plural(draftChanges.length, "open Draft")} would change tier`}
          </p>
          {draftChanges.length === 0 ? (
            <EmptyState icon={SlidersHorizontalIcon} title="No open Drafts change tier" text="Every open Draft keeps the tier it has now." className="py-4" />
          ) : (
            <ul className="flex flex-col gap-2">
              {draftChanges.map((row) => (
                <li key={row.caseId} className="flex items-center justify-between gap-3 text-sm">
                  {/* Named, not linked: a Draft is the applicant's alone, and the city has no page for one. */}
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-fg">{row.name || "Untitled event"}</span>
                    <CaseId id={row.caseId} />
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs">
                    <TierBadge tier={row.before} />
                    <span aria-hidden="true" className="text-fg-tertiary">{/* guard-allow-tertiary: decorative arrow; the tier badges carry the meaning. */}
                      →
                    </span>
                    <TierBadge tier={row.after} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-line-subtle pt-4">
          <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">The six demo scenarios</p>
          <p className="text-xs text-fg-secondary">{changedScenarios === 0 ? "All unchanged." : `${plural(changedScenarios, "scenario")} would change tier.`}</p>
          <ul className="flex flex-col gap-1 text-sm">
            {scenarioRows.map((row) => (
              <li key={row.id} className={row.before !== row.after ? "font-medium text-fg" : "text-fg-secondary"}>
                {scenarioPreviewLine(row)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </StickyAside>
  );
}

export { TierRulesSection };
