"use client";

import * as React from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtMoney } from "@/lib/format";
import type { DateGate } from "@/lib/rules";
import type { ISODate, TriggerId } from "@/lib/types";
import { lateFeeCarriesDate, leadTimeGapText, triggerDropLabel } from "@/lib/view/wizard";

export interface DateGateBannerProps {
  gate: DateGate;
  /** The notice the tier needs, for "19 days left, 30 needed". */
  leadTimeDays: number;
  /** The applicant has chosen the late fee (`flags.lateFee` on the draft). */
  lateFee: boolean;
  onNewDate: (date: ISODate) => void;
  onDropAddOn: (id: TriggerId) => void;
  /** Sets or clears the late fee on the draft. */
  onLateFee: (on: boolean) => void;
}

/**
 * The date gate and its three fixes: a new date, dropping an add-on, or the late fee. Shown on
 * step 3, where the date is chosen, and on step 5 above the primary button, because the gate is
 * usually tripped on step 4 (turning on sound makes the event Reviewed, which needs 30 days).
 * Once the late fee is chosen and it lets the date stand, the banner says so and offers the
 * way back. Renders nothing while the gate passes.
 */
function DateGateBanner({ gate, leadTimeDays, lateFee, onNewDate, onDropAddOn, onLateFee }: DateGateBannerProps) {
  if (gate.ok || gate.fixes.length === 0) return null;

  if (lateFeeCarriesDate(gate, lateFee)) {
    return (
      <Banner variant="success" data-slot="date-gate-banner">
        <div className="flex flex-col gap-2">
          <p>A {fmtMoney(gate.lateFeeAmount)} late fee is added, so this date can stand.</p>
          <div>
            <Button type="button" variant="secondary" size="sm" onClick={() => onLateFee(false)}>
              Remove the late fee
            </Button>
          </div>
        </div>
      </Banner>
    );
  }

  return (
    <Banner variant="warning" data-slot="date-gate-banner">
      <div className="flex flex-col gap-2">
        <p>{!gate.leadTimeOk ? leadTimeGapText(gate.daysUntil, leadTimeDays) : "That date isn't available."}</p>
        <div className="flex flex-wrap gap-2">
          {gate.fixes.includes("new_date") ? (
            <Button type="button" variant="secondary" size="sm" onClick={() => onNewDate(gate.earliestDate)}>
              Use {fmtDate(gate.earliestDate)}
            </Button>
          ) : null}
          {gate.fixes.includes("drop_addon")
            ? gate.droppable.map((id) => (
                <Button key={id} type="button" variant="secondary" size="sm" onClick={() => onDropAddOn(id)}>
                  Drop {triggerDropLabel(id)}
                </Button>
              ))
            : null}
          {gate.fixes.includes("late_fee") ? (
            <Button type="button" variant="secondary" size="sm" onClick={() => onLateFee(true)}>
              Pay a {fmtMoney(gate.lateFeeAmount)} late fee
            </Button>
          ) : null}
        </div>
      </div>
    </Banner>
  );
}

export { DateGateBanner };
