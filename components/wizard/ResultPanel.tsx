"use client";

import * as React from "react";
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
  className?: string;
}

/**
 * The wizard's live result panel: everything classify(), whatIf(), estimateFees() and
 * dateGate() say about the plan right now. Shown in a `StickyAside` on wide screens and in a
 * bottom sheet below 1024px (the wrapper decides which; this is only the content, so it reads
 * the same in both).
 */
function ResultPanel({ panel, onApplyWhatIf, className }: ResultPanelProps) {
  const previousTier = React.useRef(panel.tier);
  const [highlight, setHighlight] = React.useState(false);
  const [announcement, setAnnouncement] = React.useState("");

  React.useEffect(() => {
    if (previousTier.current !== panel.tier) {
      previousTier.current = panel.tier;
      setHighlight(true);
      setAnnouncement(panel.summary);
      const timeout = setTimeout(() => setHighlight(false), 900);
      return () => clearTimeout(timeout);
    }
  }, [panel.tier, panel.summary]);

  const fees = panel.fees;
  const isSeries = fees.sessions !== undefined;

  return (
    <div data-slot="wizard-result-panel" className={cn("flex flex-col gap-5", className)}>
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>

      <div className="flex flex-col gap-2">
        <div
          className={cn(
            "inline-flex w-fit rounded-full transition-shadow duration-300",
            highlight && "shadow-[0_0_0_4px_var(--pill)]",
          )}
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
          <FeeTable lines={fees.lines} />
        </div>
      ) : null}
    </div>
  );
}

export { ResultPanel };
