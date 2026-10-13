"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Chip, ChipDot } from "@/components/ui/chip";
import { InlineAlert } from "@/components/ui/inline-alert";
import { KeyValueList } from "@/components/ui/key-value";
import { FeeTable, TierBadge, DEPT_ICON } from "@/components/domain";
import { fmtDate, fmtMoney } from "@/lib/format";
import { classify, planTimeline, type RulesConfig } from "@/lib/rules";
import { groupTasksByPhase, missingFields, primaryButtonReady, type ResultPanel } from "@/lib/view/wizard";
import type { EventAnswers, ISODate, Task, WizardStep } from "@/lib/types";

export interface StepPlanProps {
  answers: EventAnswers;
  panel: ResultPanel;
  cfg: RulesConfig;
  today: ISODate;
  lateFee: boolean;
  tasks: Task[];
  /** The draft already has its board (the applicant came back to change the plan). */
  hasBoard: boolean;
  personaName: string;
  onStepLink: (step: WizardStep) => void;
  onPrimaryAction: () => void;
  primaryError: string | null;
  accountCreated: boolean;
  onCreateAccount: () => void;
}

/** Step 5: the plan at a glance, the account step, and the primary "finish" action. */
function StepPlan({
  answers,
  panel,
  cfg,
  today,
  lateFee,
  tasks,
  hasBoard,
  personaName,
  onStepLink,
  onPrimaryAction,
  primaryError,
  accountCreated,
  onCreateAccount,
}: StepPlanProps) {
  const timeline = planTimeline(answers, classify(answers, cfg), today, cfg);
  const phaseGroups = groupTasksByPhase(tasks);
  const missing = missingFields(answers);
  const ready = primaryButtonReady(answers, panel.dateGate, lateFee);

  const isInstant = panel.tier === "instant";
  // A series pays its first session at booking (`dueNow`); a single event pays in full.
  const dueNow = panel.fees.dueNow ?? panel.fees.total;
  const primaryLabel = isInstant ? `Book and pay ${fmtMoney(dueNow)}` : hasBoard ? "Update my to-do board" : "Create my to-do board";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-h5 font-bold text-fg">Your plan at a glance</h2>
        <p className="mt-1 text-sm text-fg-secondary">Everything the plan above decides, in one place.</p>
      </div>

      <div className="flex flex-col gap-2 rounded-panel border border-line-subtle bg-surface-1 p-4">
        <TierBadge tier={panel.tier} className="h-8 text-sm" />
        <p className="text-sm text-fg-secondary">{panel.summary}</p>
        {panel.triggers.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {panel.triggers.map((trigger) => (
              <Chip key={trigger.id}>
                <ChipDot className="text-fg-tertiary" /> {/* guard-allow-tertiary: a dot, not text */}
                {trigger.label}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>

      {panel.components.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">One Permitopolis event permit. It covers:</p>
          <ul className="flex flex-col gap-1">
            {panel.components.map((component) => (
              <li key={component.id} className="text-sm text-fg-secondary">
                {component.label} <span className="text-fg-label">&middot; {component.approvedBy}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {panel.reviewers.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Reviewing departments</p>
          {panel.reviewers.map((reviewer) => {
            const Icon = DEPT_ICON[reviewer.dept];
            return (
              <div key={reviewer.dept} className="flex items-start gap-2 text-sm">
                <Icon className="mt-0.5 size-4 shrink-0 text-fg-label" aria-hidden="true" />
                <p className="text-fg-secondary">{reviewer.checks}</p>
              </div>
            );
          })}
        </div>
      ) : null}

      {timeline.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Timeline</p>
          <KeyValueList columns={2} items={timeline.map((step) => ({ label: step.label, value: fmtDate(step.date) }))} />
        </div>
      ) : null}

      {phaseGroups.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Documents and actions to come</p>
          {phaseGroups.map((group) => (
            <div key={group.phase} className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-fg-label">{group.label}</p>
              <ul className="flex flex-col gap-1">
                {group.tasks.map((task) => (
                  <li key={task.id} className="text-sm text-fg-secondary">
                    {task.title}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Fee estimate</p>
        <FeeTable lines={panel.fees.lines} />
      </div>

      <div className="flex flex-col gap-2 rounded-panel border border-line-subtle bg-surface-1 p-4">
        <p className="text-sm font-semibold text-fg">Create your account</p>
        <p className="text-xs text-fg-secondary">Prefilled from {personaName}. This is only visual in the demo.</p>
        <Button type="button" variant="secondary" size="sm" className="w-fit" disabled={accountCreated} onClick={onCreateAccount}>
          {accountCreated ? `Account created for ${personaName}` : "Create your account"}
        </Button>
      </div>

      {missing.length > 0 ? (
        <InlineAlert variant="warning">
          <div className="flex flex-col gap-1.5">
            <p>Still missing:</p>
            <ul className="flex flex-col gap-1">
              {missing.map((field) => (
                <li key={field.key}>
                  <button type="button" className="font-medium text-fg-accent underline-offset-4 hover:underline" onClick={() => onStepLink(field.step)}>
                    {field.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </InlineAlert>
      ) : null}

      {primaryError ? <InlineAlert variant="danger">{primaryError}</InlineAlert> : null}

      <Button type="button" size="lg" disabled={!ready} onClick={onPrimaryAction}>
        {primaryLabel}
      </Button>
      {!ready && missing.length === 0 ? (
        <p className="text-xs text-fg-secondary">
          {!panel.dateGate.leadTimeOk ? "This date doesn't meet the lead time yet." : "That date isn't available yet."}
        </p>
      ) : null}
    </div>
  );
}

export { StepPlan };
