/**
 * F3 · Movie Night on the Lawn. Reviewed, In review: Health & Legal still has the insurance
 * verification open. Shares the Great Lawn with F2 but at a non-overlapping time (plan 3.3).
 * Routed Tue, Apr 27 with the usual 14 days: Health & Legal's review is due Tue, May 11.
 */
import type { EventAnswers } from "@/lib/types";
import type { SeedScript } from "../../types";
import { addOns, areaLocation, sampleFile, singleSchedule, step, taskId } from "../helpers";

const CASE_ID = "PMT-27-0075";

const answers: EventAnswers = {
  eventType: "picnic_party",
  name: "Movie Night on the Lawn",
  description: "An outdoor movie screening with a projector and folding chairs.",
  location: areaLocation("great-lawn", { x: 15, y: 15, w: 40, h: 30 }, 2000),
  schedule: singleSchedule("2027-06-12", "19:00", "22:30", { setupStart: "17:00" }),
  attendance: 150,
  addOns: addOns({ amplifiedSound: true }),
};

export const F3: SeedScript = {
  id: CASE_ID,
  key: "F3",
  applicantId: "lakeside-film-society",
  createdAt: "2027-04-23T09:00",
  answers,
  steps: [
    step("2027-04-23T09:00", "applicant", { type: "create_board" }),
    step("2027-04-23T09:05", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE_ID, "insurance_certificate"),
      files: [sampleFile("lakeside-film-society-insurance-certificate.pdf")],
    }),
    step("2027-04-23T09:10", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE_ID, "sound_details"),
      form: { equipment: "Outdoor projector speaker system", soundCheckTime: "18:30" },
    }),
    step("2027-04-23T09:30", "applicant", { type: "submit" }),
    step("2027-04-27T09:00", "clerk", { type: "accept_complete" }),
    step("2027-04-27T09:05", "clerk", {
      type: "confirm_routing",
      reviewers: [
        { dept: "pws", sections: ["Sound details"], dueDate: "2027-05-11" },
        { dept: "hl", sections: ["Certificate of insurance"], dueDate: "2027-05-11" },
      ],
    }),
    step("2027-04-29T09:00", "pws", { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }),
  ],
  expect: { tier: "reviewed", state: "in_review" },
  notes: "Health & Legal's insurance verification is still open.",
};
