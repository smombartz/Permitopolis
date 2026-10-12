/**
 * F4 · Oak Avenue block party. Reviewed by exception, Quote sent: every sign-off and review is
 * in; the applicant has not paid, so it sits in the Clerk's payments list.
 */
import type { EventAnswers } from "@/lib/types";
import type { SeedScript } from "../../types";
import { addOns, cityServices, sampleFile, singleSchedule, step, streetsLocation, taskId } from "../helpers";

const CASE_ID = "PMT-27-0080";

const answers: EventAnswers = {
  eventType: "block_party",
  name: "Oak Avenue block party",
  description: "A block party for the 100 block of Oak Avenue.",
  location: streetsLocation(["oak-100"], "100 block of Oak Avenue"),
  schedule: singleSchedule("2027-06-05", "13:00", "19:00"),
  attendance: 80,
  addOns: addOns({ cityServices: cityServices({ barricades: 2 }) }),
};

export const F4: SeedScript = {
  id: CASE_ID,
  key: "F4",
  applicantId: "oak-avenue-block-captain",
  createdAt: "2027-03-20T09:00",
  answers,
  steps: [
    step("2027-03-20T09:00", "applicant", { type: "create_board" }),
    step("2027-03-20T09:05", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE_ID, "insurance_certificate"),
      files: [sampleFile("oak-avenue-block-captain-insurance-certificate.pdf")],
    }),
    step("2027-03-20T09:10", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE_ID, "city_services_request"),
      form: { barricades: 2, trash: false, power: false, policeOfficers: 0, policeHours: 0 },
    }),
    ...Array.from({ length: 8 }, (_, i) =>
      step(`2027-03-${String(21 + i).padStart(2, "0")}T18:00`, "neighbor", { type: "simulate_signoff" }),
    ),
    step("2027-04-09T09:00", "applicant", { type: "submit" }),
    step("2027-04-12T09:00", "clerk", { type: "accept_complete" }),
    step("2027-04-12T09:05", "clerk", {
      type: "confirm_routing",
      reviewers: [
        { dept: "pws", sections: ["City services request"], dueDate: "2027-04-26" },
        { dept: "hl", sections: ["Certificate of insurance"], dueDate: "2027-04-26" },
      ],
    }),
    step("2027-04-19T09:00", "pws", { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }),
    step("2027-04-19T09:05", "hl", { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }),
    step("2027-04-22T09:00", "clerk", { type: "send_quote", conditions: [], feeLines: [] }),
  ],
  expect: { tier: "reviewed", state: "quote_sent" },
  notes: "Quote sent Thu, Apr 22: the hold runs 14 days, to May 6, so it is still held on the demo date.",
};
