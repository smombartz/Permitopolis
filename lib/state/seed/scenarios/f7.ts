/**
 * F7 · Company picnic. Instant, then a damage report at closeout: Public Works & Safety logs
 * the cleanup as "issues" with an extra line for a broken picnic table, which opens Closeout
 * with a Clerk exception task instead of the usual Instant straight-to-Closed.
 */
import type { EventAnswers } from "@/lib/types";
import type { SeedScript } from "../../types";
import { addOns, inventoryLocation, singleSchedule, step } from "../helpers";

const CASE_ID = "PMT-27-0017";

const answers: EventAnswers = {
  eventType: "picnic_party",
  name: "Brightline Logistics company picnic",
  description: "An annual company picnic for staff and families.",
  location: inventoryLocation(["shelter-4"]),
  schedule: singleSchedule("2027-04-17", "11:00", "17:00"),
  attendance: 80,
  addOns: addOns({}),
};

export const F7: SeedScript = {
  id: CASE_ID,
  key: "F7",
  applicantId: "brightline-logistics",
  createdAt: "2027-04-01T09:00",
  answers,
  steps: [
    step("2027-04-01T09:00", "applicant", { type: "create_board" }),
    step("2027-04-01T09:05", "applicant", { type: "book_and_pay", method: "card" }),
    step("2027-04-17T19:00", "pws", {
      type: "log_closeout",
      cleanup: "issues",
      notes: "One picnic table at Shelter 4 was broken during the event; recommend repair.",
      actuals: [],
      extraLines: [{ dept: "pws", label: "Broken picnic table repair", qty: 1, unit: "item", unitPrice: 95 }],
    }),
  ],
  expect: { tier: "instant", state: "closeout" },
  notes: "Clerk's Instant-exception tab: reconcile_close still needs to run.",
};
