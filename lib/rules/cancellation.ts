/**
 * cancellationRefund(): what cancelling today refunds, excluding the deposit
 * (always refunded in full, handled by transition()).
 */
import { daysBetween } from "@/lib/dates";
import type { EventCase, ISODate } from "@/lib/types";
import { DEFAULT_CONFIG } from "./config";
import { round2 } from "./shared";
import type { CancellationResult, RulesConfig } from "./types";

function nextSessionDate(c: EventCase, today: ISODate): ISODate {
  // A session skipped for a blackout is not held, so it is never "the next session".
  const upcoming =
    c.schedule?.occurrences
      .filter((o) => o.billing !== "skipped")
      .map((o) => o.date)
      .filter((d) => d >= today) ?? [];
  if (upcoming.length > 0) return upcoming.sort()[0];
  return c.schedule?.date ?? today;
}

export const cancellationRefund = (c: EventCase, today: ISODate, cfg: RulesConfig = DEFAULT_CONFIG): CancellationResult => {
  const days = daysBetween(today, nextSessionDate(c, today));
  const bands = [...cfg.cancellation].sort((a, b) => b.minDaysBefore - a.minDaysBefore);
  const band = bands.find((b) => days >= b.minDaysBefore) ?? bands.at(-1)!;

  const feeLines = c.feeLines.filter((l) => l.kind === "fee");
  const lineFees = round2(feeLines.reduce((sum, l) => sum + l.estimate, 0));
  // A series is billed session by session, so its fee lines cover sessions nobody has paid for
  // yet. The band applies to the fees that were paid: "full refund minus $10" of thirteen $20
  // sessions is $250, which a cap at the $20 paid would turn into $20 with no processing fee.
  const totalFees = c.schedule?.recurrence ? Math.min(lineFees, feesPaid(c)) : lineFees;
  const applicationFee = feeLines.find((l) => l.label === "Application fee")?.estimate ?? 0;
  const eligible = band.keepsApplicationFee ? Math.max(0, totalFees - applicationFee) : totalFees;

  const refund = Math.max(0, round2(eligible * band.refundRate - band.processingFee));
  const kept = round2(totalFees - refund);

  return { refund, kept, rule: band.label };
};

/** What the applicant has paid toward the fees themselves: every payment, less the deposit and a late fee, which the quote takes in full. */
function feesPaid(c: EventCase): number {
  const paid = c.payments.reduce((sum, p) => sum + p.amount, 0);
  const notFees = c.feeLines.filter((l) => l.kind !== "fee").reduce((sum, l) => sum + l.estimate, 0);
  return Math.max(0, round2(paid - notFees));
}
