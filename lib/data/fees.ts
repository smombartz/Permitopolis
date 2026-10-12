/**
 * Fee schedule and cancellation schedule. Placeholders for the demo.
 * The Clerk's settings screen edits a copy held in the store's config.
 */
import type { CancellationBand, FeeSchedule } from "@/lib/rules/types";

export const FEE_SCHEDULE: FeeSchedule = {
  applicationFee: { instant: 0, reviewed: 50, special: 250 },
  shelterPerHour: 25,
  fieldPerHour: 20,
  cityHallPlazaPerDay: 300,
  greatLawnPerDay: 200,
  streetClosurePerBlockPerDay: 150,
  routeClosurePerMile: 400,
  amplifiedSoundPerDay: 40,
  alcoholLicensePerDay: 100,
  vendorPermitEach: 75,
  structureInspectionEach: 60,
  policePerOfficerHour: 85,
  barricadeEachPerDay: 15,
  cleanupCrewPerWorkerHour: 60,
  deposit: { instant: 0, reviewed: 250, special: 1000 },
};

/** Deposits are always refunded in full, whatever the band. */
export const CANCELLATION_SCHEDULE: CancellationBand[] = [
  {
    minDaysBefore: 30,
    refundRate: 1,
    processingFee: 10,
    keepsApplicationFee: false,
    label: "30 or more days before: full refund minus a $10 processing fee",
  },
  {
    minDaysBefore: 10,
    refundRate: 0.5,
    processingFee: 0,
    keepsApplicationFee: true,
    label: "10 to 29 days before: 50% of space and permit fees; the application fee is kept",
  },
  {
    minDaysBefore: 0,
    refundRate: 0,
    processingFee: 0,
    keepsApplicationFee: true,
    label: "Under 10 days: no refund of fees",
  },
];
