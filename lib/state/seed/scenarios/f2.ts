/**
 * F2 · Riverside Farmers Market. Standard series, In review: Public Works & Safety (tents) and
 * Health & Legal (vendor list) both have the review routed but not yet decided. Routed Mon,
 * Apr 26 with the usual 14 days, so both reviews are due Mon, May 10: in the coming week.
 *
 * Plan 3.3: shares the Great Lawn with F3 (Movie Night), but the two never overlap in time —
 * the market runs 8 am-1 pm, Movie Night 7-10:30 pm with setup from 5 pm.
 */
import type { EventAnswers } from "@/lib/types";
import type { SeedScript } from "../../types";
import { addOns, areaLocation, sampleFile, step, taskId, vendorNames, weeklySchedule } from "../helpers";

const CASE_ID = "PMT-27-0070";
const VENDORS = vendorNames("Market Stall", 12);

const answers: EventAnswers = {
  eventType: "market_festival",
  name: "Riverside Farmers Market",
  description: "A weekly Saturday farmers market on the Great Lawn.",
  location: areaLocation("great-lawn", { x: 10, y: 10, w: 100, h: 60 }, 6000),
  schedule: weeklySchedule("2027-06-05", "08:00", "13:00", "2027-09-25"),
  attendance: 300,
  addOns: addOns({
    tentsStages: { count: 12 },
    foodVending: { vendors: 12, vendorNames: VENDORS },
  }),
};

export const F2: SeedScript = {
  id: CASE_ID,
  key: "F2",
  applicantId: "riverside-farmers-market-assoc",
  createdAt: "2027-04-22T09:00",
  answers,
  steps: [
    step("2027-04-22T09:00", "applicant", { type: "create_board" }),
    step("2027-04-22T09:05", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE_ID, "insurance_certificate"),
      files: [sampleFile("riverside-farmers-market-insurance-certificate.pdf")],
    }),
    step("2027-04-22T09:10", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE_ID, "structure_specs"),
      files: [sampleFile("riverside-farmers-market-tent-layout.pdf")],
    }),
    step("2027-04-22T09:15", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE_ID, "vendor_list"),
      form: { vendors: VENDORS.map((name) => ({ name, serves: "Produce and crafts" })) },
    }),
    step("2027-04-22T10:00", "applicant", { type: "submit" }),
    step("2027-04-26T09:00", "clerk", { type: "accept_complete" }),
    step("2027-04-26T09:05", "clerk", {
      type: "confirm_routing",
      reviewers: [
        { dept: "pws", sections: ["Structure specs and layout"], dueDate: "2027-05-10" },
        { dept: "hl", sections: ["Certificate of insurance", "Vendor list"], dueDate: "2027-05-10" },
      ],
    }),
  ],
  expect: { tier: "reviewed", state: "in_review" },
};
