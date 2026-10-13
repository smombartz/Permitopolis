/**
 * estimateFees(): fee lines, deposit and total from the fee schedule in
 * lib/rules/config.ts. Never hardcodes a rate.
 */
import { SPACE_BY_ID } from "@/lib/data/inventory";
import { hoursOf, round2 } from "./shared";
import { DEFAULT_CONFIG } from "./config";
import type { Classification, FeeEstimate } from "./types";
import type { Dept, EventAnswers, FeeLine } from "@/lib/types";

interface LineSpec {
  dept: Dept;
  label: string;
  qty: number;
  unit: string;
  unitPrice: number;
  kind: FeeLine["kind"];
}

function round2Line(l: LineSpec): Omit<FeeLine, "id"> {
  return { dept: l.dept, label: l.label, qty: l.qty, unit: l.unit, unitPrice: l.unitPrice, estimate: round2(l.qty * l.unitPrice), actual: null, kind: l.kind };
}

export const estimateFees = (
  a: EventAnswers,
  cls: Classification,
  cfg = DEFAULT_CONFIG,
  options?: { lateFee?: boolean; caseId?: string },
): FeeEstimate => {
  const fees = cfg.fees;
  const loc = a.location;
  const sched = a.schedule;
  const isSeries = !!sched?.recurrence;
  const sessions = isSeries ? sched!.occurrences.filter((o) => o.billing !== "skipped").length || 1 : 1;

  const perSession: LineSpec[] = [];
  if (loc && sched) {
    if (loc.mode === "inventory") {
      // Every space booked is billed: two fields for six hours is twelve field-hours. One line
      // per kind of space, the kind read from the inventory.
      const hours = hoursOf(sched);
      const bookable = [
        { kind: "shelter", label: "Shelter reservation", rate: fees.shelterPerHour },
        { kind: "field", label: "Field reservation", rate: fees.fieldPerHour },
      ];
      for (const { kind, label, rate } of bookable) {
        const count = loc.inventoryIds.filter((id) => SPACE_BY_ID[id]?.kind === kind).length;
        if (count > 0 && hours > 0) perSession.push({ dept: "clerk", label, qty: hours * count, unit: "hour", unitPrice: rate, kind: "fee" });
      }
    } else if (loc.mode === "area") {
      const rate = loc.areaId === "great-lawn" ? fees.greatLawnPerDay : fees.cityHallPlazaPerDay;
      const label = loc.areaId === "great-lawn" ? "Great Lawn reservation" : "City Hall Plaza reservation";
      perSession.push({ dept: "clerk", label, qty: 1, unit: "day", unitPrice: rate, kind: "fee" });
    } else if (loc.mode === "streets") {
      const blocks = loc.segmentIds.length;
      if (blocks > 0) perSession.push({ dept: "clerk", label: "Street closure", qty: blocks, unit: "block-day", unitPrice: fees.streetClosurePerBlockPerDay, kind: "fee" });
    } else if (loc.mode === "route") {
      const miles = loc.miles ?? 0;
      if (miles > 0) perSession.push({ dept: "clerk", label: "Route closure", qty: miles, unit: "mile", unitPrice: fees.routeClosurePerMile, kind: "fee" });
    }
    if (a.addOns.amplifiedSound) perSession.push({ dept: "pws", label: "Amplified sound", qty: 1, unit: "day", unitPrice: fees.amplifiedSoundPerDay, kind: "fee" });
    if (a.addOns.alcohol) perSession.push({ dept: "clerk", label: "Temporary alcohol license", qty: 1, unit: "day", unitPrice: fees.alcoholLicensePerDay, kind: "fee" });
  }

  const oneOff: LineSpec[] = [];
  const applicationFee = fees.applicationFee[cls.tier];
  if (applicationFee > 0) oneOff.push({ dept: "clerk", label: "Application fee", qty: 1, unit: "application", unitPrice: applicationFee, kind: "fee" });

  if (a.addOns.foodVending && a.addOns.foodVending.vendors > 0) {
    oneOff.push({ dept: "hl", label: "Food or vendor permit", qty: a.addOns.foodVending.vendors, unit: "vendor", unitPrice: fees.vendorPermitEach, kind: "fee" });
  }
  if (a.addOns.tentsStages && a.addOns.tentsStages.count > 0) {
    oneOff.push({ dept: "pws", label: "Structure fire inspection", qty: a.addOns.tentsStages.count, unit: "structure", unitPrice: fees.structureInspectionEach, kind: "fee" });
  }
  const svc = a.addOns.cityServices;
  if (svc && svc.policeOfficers > 0 && svc.policeHours > 0) {
    oneOff.push({ dept: "pws", label: "Police", qty: svc.policeOfficers * svc.policeHours, unit: "officer-hour", unitPrice: fees.policePerOfficerHour, kind: "fee" });
  }
  if (svc && svc.barricades > 0) {
    oneOff.push({ dept: "pws", label: "Barricades", qty: svc.barricades, unit: "barricade-day", unitPrice: fees.barricadeEachPerDay, kind: "fee" });
  }
  const deposit = fees.deposit[cls.tier];
  if (deposit > 0) oneOff.push({ dept: "clerk", label: "Refundable cleanup deposit", qty: 1, unit: "deposit", unitPrice: deposit, kind: "deposit" });

  let n = 0;
  const idFor = () => {
    n++;
    return options?.caseId ? `${options.caseId}:fee:${n}` : `fee:${n}`;
  };

  const lines: FeeLine[] = [];
  for (const spec of perSession) {
    lines.push({ id: idFor(), ...round2Line({ ...spec, qty: round2(spec.qty * sessions) }) });
  }
  for (const spec of oneOff) {
    lines.push({ id: idFor(), ...round2Line(spec) });
  }

  let lateFeeAmount = 0;
  if (options?.lateFee) {
    const feesExclDeposit = lines.filter((l) => l.kind === "fee").reduce((sum, l) => sum + l.estimate, 0);
    lateFeeAmount = round2(feesExclDeposit * cfg.lateFee.rate);
    if (lateFeeAmount > 0) {
      lines.push({ id: idFor(), dept: "clerk", label: "Late fee", qty: 1, unit: "fee", unitPrice: lateFeeAmount, estimate: lateFeeAmount, actual: null, kind: "late_fee" });
    }
  }

  const feesTotal = round2(lines.filter((l) => l.kind === "fee" || l.kind === "late_fee").reduce((sum, l) => sum + l.estimate, 0));
  const depositTotal = round2(lines.filter((l) => l.kind === "deposit").reduce((sum, l) => sum + l.estimate, 0));
  const total = round2(feesTotal + depositTotal);

  const result: FeeEstimate = { lines, fees: feesTotal, deposit: depositTotal, total };
  if (isSeries) {
    const perSessionTotal = round2(perSession.reduce((sum, l) => sum + l.qty * l.unitPrice, 0));
    result.perSession = perSessionTotal;
    result.perSessionLabels = perSession.map((l) => l.label);
    result.sessions = sessions;
    const oneOffForTierDueNow = cls.tier === "instant" ? 0 : round2(oneOff.reduce((sum, l) => sum + l.qty * l.unitPrice, 0));
    // The late fee is charged once, for taking the booking at short notice, so it is due now.
    result.dueNow = round2(perSessionTotal + oneOffForTierDueNow + lateFeeAmount);
  }
  return result;
};
