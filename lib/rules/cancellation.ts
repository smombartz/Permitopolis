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
  const upcoming = c.schedule?.occurrences.map((o) => o.date).filter((d) => d >= today) ?? [];
  if (upcoming.length > 0) return upcoming.sort()[0];
  return c.schedule?.date ?? today;
}

export const cancellationRefund = (c: EventCase, today: ISODate, cfg: RulesConfig = DEFAULT_CONFIG): CancellationResult => {
  const days = daysBetween(today, nextSessionDate(c, today));
  const bands = [...cfg.cancellation].sort((a, b) => b.minDaysBefore - a.minDaysBefore);
  const band = bands.find((b) => days >= b.minDaysBefore) ?? bands.at(-1)!;

  const feeLines = c.feeLines.filter((l) => l.kind === "fee");
  const totalFees = round2(feeLines.reduce((sum, l) => sum + l.estimate, 0));
  const applicationFee = feeLines.find((l) => l.label === "Application fee")?.estimate ?? 0;
  const eligible = band.keepsApplicationFee ? totalFees - applicationFee : totalFees;

  const refund = Math.max(0, round2(eligible * band.refundRate - band.processingFee));
  const kept = round2(totalFees - refund);

  return { refund, kept, rule: band.label };
};
