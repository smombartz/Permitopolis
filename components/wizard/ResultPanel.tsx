"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Chip, ChipDot } from "@/components/ui/chip";
import { Banner } from "@/components/ui/banner";
import { fmtDate, fmtMoney, plural } from "@/lib/format";
import { FeeTable, TierBadge, DEPT_ICON } from "@/components/domain";
import type { ResultPanel as ResultPanelData } from "@/lib/view/wizard";

export interface ResultPanelProps {
  panel: ResultPanelData;
  /** Clicking a what-if line's button applies that removal. */
  onApplyWhatIf: (triggerId: ResultPanelData["whatIf"][number]["triggerId"]) => void;
  /** The tier just changed: ring the badge. WizardScreen owns the flag, since it is always mounted. */
  highlight?: boolean;
  /** Two columns for the fee estimate: the panel is 320px wide, and narrower in the bottom sheet. */
  compactFees?: boolean;
  className?: string;
}

/**
 * The wizard's live result panel: everything classify(), whatIf(), estimateFees() and
 * dateGate() say about the plan right now. Shown in a `StickyAside` on wide screens and in a
 * bottom sheet below 1024px (the wrapper decides which; this is only the content, so it reads
 * the same in both). A tier change is announced and timed by WizardScreen, which is mounted
 * when this is not (the sheet closed on a phone); `highlight` is its flag.
 */
function ResultPanel({ panel, onApplyWhatIf, highlight = false, compactFees = true, className }: ResultPanelProps) {
  const fees = panel.fees;
  const isSeries = fees.sessions !== undefined;

  return (
    <div data-slot="wizard-result-panel" className={cn("flex flex-col gap-5", className)}>
      <div className="flex flex-col gap-2">
        <div
          className={cn(
            "inline-flex w-fit rounded-full transition-shadow duration-300",
            highlight && "shadow-[0_0_0_4px_var(--pill)]",
          )}
          data-highlight={highlight ? "true" : undefined}
        >
          <TierBadge tier={panel.tier} className="h-8 text-sm" />
        </div>
        <p className="text-sm text-fg-secondary">{panel.summary}</p>
      </div>

      {panel.triggers.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {panel.triggers.map((trigger) => (
            <Chip key={trigger.id}>
              <ChipDot className="text-fg-tertiary" /> {/* guard-allow-tertiary: a dot, not text */}
              {trigger.label}
            </Chip>
          ))}
        </div>
      ) : null}

      {panel.whatIf.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {panel.whatIf.map((w) => (
            <Button key={w.triggerId} type="button" variant="secondary" size="sm" className="justify-start" onClick={() => onApplyWhatIf(w.triggerId)}>
              {w.text}
            </Button>
          ))}
        </div>
      ) : null}

      <p className="text-xs text-fg-secondary">
        Needs {plural(panel.leadTimeDays, "day")} of notice · earliest {fmtDate(panel.dateGate.earliestDate)}
      </p>

      {panel.dateGate.availability.status === "booked" || panel.dateGate.availability.status === "blackout" ? (
        <Banner variant="danger">{panel.dateGate.availability.reason ?? "That date is not available."}</Banner>
      ) : panel.dateGate.availability.status === "impacted" ? (
        <Banner variant="warning">{panel.dateGate.availability.reason}</Banner>
      ) : null}

      {panel.components.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">One Permitopolis event permit. It covers:</p>
          <ul className="flex flex-col gap-1">
            {panel.components.map((component) => (
              <li key={component.id} className="text-sm text-fg-secondary">
                {component.label} <span className="text-fg-label">· {component.approvedBy}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {panel.reviewers.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Reviewers</p>
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

      {fees.lines.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-eyebrow font-bold tracking-[.12em] text-fg-label uppercase">Fee estimate</p>
          {isSeries ? (
            <p className="text-sm text-fg-secondary">
              {fmtMoney(fees.perSession ?? 0)} per session &middot; {plural(fees.sessions ?? 0, "session")} &middot; {fmtMoney(fees.total)} total
            </p>
          ) : null}
          <FeeTable lines={fees.lines} compact={compactFees} />
        </div>
      ) : null}
    </div>
  );
}

export { ResultPanel };
