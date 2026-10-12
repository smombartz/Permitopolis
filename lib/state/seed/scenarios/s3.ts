/**
 * S3 · Jazz in the Plaza. Reviewed, Needs info. Submitted Apr 16; hold placed Apr 19; Health &
 * Legal verifies insurance Apr 21; Public Works & Safety approves with three conditions Apr 28;
 * Health & Legal verifies the vendor list and asks for the vendor's health permit Apr 30, due
 * May 5, with its clock paused since then.
 *
 * Per plan 3.3: the request pins the existing vendor_health_permit:1 card rather than creating
 * a new "Respond to a request" card.
 */
import type { EventAnswers } from "@/lib/types";
import type { SeedScript } from "../../types";
import { addOns, areaLocation, sampleFile, singleSchedule, step, taskId } from "../helpers";

const CASE_ID = "PMT-27-0118";

const answers: EventAnswers = {
  eventType: "performance_rally",
  name: "Jazz in the Plaza",
  description: "An evening of live jazz with one food vendor on City Hall Plaza.",
  location: areaLocation("city-hall-plaza", { x: 40, y: 30, w: 50, h: 30 }, 1500),
  schedule: singleSchedule("2027-06-18", "18:00", "21:00", { setupStart: "16:00", teardownEnd: "22:00" }),
  attendance: 150,
  addOns: addOns({
    amplifiedSound: true,
    foodVending: { vendors: 1, vendorNames: ["Rolling Dumpling Co."] },
  }),
};

export const S3: SeedScript = {
  id: CASE_ID,
  key: "S3",
  applicantId: "downtown-arts-collective",
  createdAt: "2027-04-16T09:00",
  answers,
  steps: [
    step("2027-04-16T09:00", "applicant", { type: "create_board" }),
    step("2027-04-16T09:05", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE_ID, "insurance_certificate"),
      files: [sampleFile("downtown-arts-collective-insurance-certificate.pdf")],
    }),
    step("2027-04-16T09:10", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE_ID, "sound_details"),
      form: { equipment: "Two powered speakers on stands, one wireless handheld mic", soundCheckTime: "17:00" },
    }),
    step("2027-04-16T09:15", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE_ID, "vendor_list"),
      form: { vendors: [{ name: "Rolling Dumpling Co.", serves: "Dumplings and noodle bowls" }] },
    }),
    step("2027-04-16T09:30", "applicant", { type: "submit" }),
    step("2027-04-19T10:00", "clerk", { type: "accept_complete" }),
    step("2027-04-19T10:05", "clerk", {
      type: "confirm_routing",
      reviewers: [
        { dept: "pws", sections: ["Sound details"], dueDate: "2027-05-03" },
        {
          dept: "hl",
          sections: ["Certificate of insurance", "Vendor list", "Health permit: Rolling Dumpling Co."],
          dueDate: "2027-05-03",
        },
      ],
    }),
    step("2027-04-21T11:00", "hl", { type: "verify_document", taskId: taskId(CASE_ID, "insurance_certificate") }),
    step("2027-04-28T14:00", "pws", {
      type: "review_decide",
      decision: "approve_with_conditions",
      conditions: [
        "Sound ends at 9 pm",
        "Speakers face away from the residences on Elm Street",
        "No more than 85 dB at 50 feet",
      ],
      feeLines: [],
    }),
    step("2027-04-30T09:00", "hl", { type: "verify_document", taskId: taskId(CASE_ID, "vendor_list") }),
    step("2027-04-30T09:05", "hl", {
      type: "request_info",
      taskId: taskId(CASE_ID, "vendor_health_permit", 1),
      message: "Please upload Rolling Dumpling Co.'s current health permit",
      dueDate: "2027-05-05",
    }),
  ],
  expect: { tier: "reviewed", state: "needs_info" },
  notes: "Board assertion: 1 in Do now, 0 With the city, 3 Coming up, 4 Done on May 3.",
};
