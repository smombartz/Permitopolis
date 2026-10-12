/**
 * Background cases, In review and Needs info (plan 6.2). B05 carries the 90+ character event
 * name and an overdue Public Works & Safety review; B06 is flagged sent to commission; B07's
 * Health & Legal review is overdue; B08 is an applicant overdue on a request; B09 carries the
 * 60+ character organization name and was asked by the Clerk at intake.
 */
import type { EventAnswers } from "@/lib/types";
import type { SeedScript } from "../../types";
import { addOns, areaLocation, inventoryLocation, sampleFile, singleSchedule, step, taskId, vendorNames } from "../helpers";

/** B05 · St. Agnes Parish: In review, Public Works & Safety overdue. */
const CASE05 = "PMT-27-0012";
const LONG_NAME =
  "St. Agnes Parish Annual Multicultural Heritage Festival, Craft Fair and Community Potluck Celebration";
const b05Vendors = vendorNames("Parish Food Table", 5);

const b05Answers: EventAnswers = {
  eventType: "market_festival",
  name: LONG_NAME,
  description: "A parish-wide heritage festival with craft tables and a potluck.",
  location: areaLocation("great-lawn", { x: 20, y: 20, w: 50, h: 40 }, 4000),
  // A Sunday: the Great Lawn is the farmers market's (F2) every Saturday morning.
  schedule: singleSchedule("2027-07-18", "11:00", "17:00"),
  attendance: 300,
  addOns: addOns({ tentsStages: { count: 3 }, foodVending: { vendors: 5, vendorNames: b05Vendors } }),
};

export const B05: SeedScript = {
  id: CASE05,
  key: "B05",
  applicantId: "st-agnes-parish",
  createdAt: "2027-03-01T09:00",
  answers: b05Answers,
  steps: [
    step("2027-03-01T09:00", "applicant", { type: "create_board" }),
    step("2027-03-01T09:05", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE05, "insurance_certificate"),
      files: [sampleFile("st-agnes-parish-insurance-certificate.pdf")],
    }),
    step("2027-03-01T09:10", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE05, "structure_specs"),
      files: [sampleFile("st-agnes-parish-tent-layout.pdf")],
    }),
    step("2027-03-01T09:15", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE05, "vendor_list"),
      form: { vendors: b05Vendors.map((name) => ({ name, serves: "Home-cooked dishes" })) },
    }),
    step("2027-03-01T10:00", "applicant", { type: "submit" }),
    step("2027-03-10T09:00", "clerk", { type: "accept_complete" }),
    step("2027-03-10T09:05", "clerk", {
      type: "confirm_routing",
      reviewers: [
        { dept: "pws", sections: ["Structure specs and layout"], dueDate: "2027-03-29" },
        { dept: "hl", sections: ["Certificate of insurance", "Vendor list"], dueDate: "2027-03-29" },
      ],
    }),
    step("2027-03-20T09:00", "hl", { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }),
  ],
  expect: { tier: "reviewed", state: "in_review" },
  notes: "Stress row: a 90+ character event name. Public Works & Safety's review is overdue (due Mar 29).",
};

/** B06 · Permitopolis Rotary Club: In review, flagged sent to commission. */
const CASE06 = "PMT-27-0014";
const b06Answers: EventAnswers = {
  eventType: "performance_rally",
  name: "Permitopolis Rotary Club charity gala",
  description: "A fundraising gala with a short street closure for valet drop-off.",
  location: inventoryLocation(["field-2"]),
  schedule: singleSchedule("2027-07-30", "17:00", "22:00"),
  attendance: 300,
  addOns: addOns({ amplifiedSound: true, alcohol: true }),
};

export const B06: SeedScript = {
  id: CASE06,
  key: "B06",
  applicantId: "permitopolis-rotary-club",
  createdAt: "2027-03-05T09:00",
  answers: b06Answers,
  steps: [
    step("2027-03-05T09:00", "applicant", { type: "create_board" }),
    step("2027-03-05T09:05", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE06, "insurance_certificate"),
      files: [sampleFile("permitopolis-rotary-insurance-certificate.pdf")],
    }),
    step("2027-03-05T09:10", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE06, "sound_details"),
      form: { equipment: "Stage PA and wireless mics", soundCheckTime: "16:30" },
    }),
    step("2027-03-05T09:15", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE06, "alcohol_details"),
      form: { beerGarden: false, servers: 4, liquorLiabilityCarrier: "Permitopolis Mutual" },
    }),
    step("2027-03-05T09:30", "applicant", { type: "submit" }),
    step("2027-03-08T09:00", "clerk", { type: "accept_complete" }),
    step("2027-03-08T09:05", "clerk", {
      type: "confirm_routing",
      reviewers: [
        { dept: "pws", sections: ["Sound details"], dueDate: "2027-03-22" },
        { dept: "hl", sections: ["Certificate of insurance"], dueDate: "2027-03-22" },
        { dept: "clerk", sections: ["Alcohol details and liquor liability insurance"], dueDate: "2027-03-22" },
      ],
    }),
    step("2027-03-15T09:00", "pws", { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }),
    step("2027-03-15T09:05", "hl", { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }),
    step("2027-03-15T09:05", "clerk", { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }),
    step("2027-03-16T09:00", "clerk", { type: "send_to_commission" }),
  ],
  expect: { tier: "reviewed", state: "in_review" },
};

/** B07 · East End Baptist Church: In review, Health & Legal overdue. */
const CASE07 = "PMT-27-0016";
const b07Vendors = vendorNames("Fellowship Table", 3);
const b07Answers: EventAnswers = {
  eventType: "picnic_party",
  name: "East End Baptist Church fellowship potluck",
  location: inventoryLocation(["shelter-1"]),
  schedule: singleSchedule("2027-05-25", "12:00", "16:00"),
  attendance: 80,
  addOns: addOns({ foodVending: { vendors: 3, vendorNames: b07Vendors } }),
};

export const B07: SeedScript = {
  id: CASE07,
  key: "B07",
  applicantId: "east-end-baptist-church",
  createdAt: "2027-03-20T09:00",
  answers: b07Answers,
  steps: [
    step("2027-03-20T09:00", "applicant", { type: "create_board" }),
    step("2027-03-20T09:05", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE07, "insurance_certificate"),
      files: [sampleFile("east-end-baptist-insurance-certificate.pdf")],
    }),
    step("2027-03-20T09:10", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE07, "vendor_list"),
      form: { vendors: b07Vendors.map((name) => ({ name, serves: "Potluck dishes" })) },
    }),
    step("2027-03-20T09:30", "applicant", { type: "submit" }),
    step("2027-03-22T09:00", "clerk", { type: "accept_complete" }),
    step("2027-03-22T09:05", "clerk", {
      type: "confirm_routing",
      reviewers: [{ dept: "hl", sections: ["Certificate of insurance", "Vendor list"], dueDate: "2027-04-10" }],
    }),
  ],
  expect: { tier: "reviewed", state: "in_review" },
  notes: "Health & Legal's review is overdue (due Apr 10).",
};

/** B08 · Westside Youth Soccer League: Needs info, the applicant is overdue. */
const CASE08 = "PMT-27-0018";
const b08Answers: EventAnswers = {
  eventType: "performance_rally",
  name: "Westside Youth Soccer League spring tournament",
  location: inventoryLocation(["field-1", "field-2"]),
  schedule: singleSchedule("2027-05-29", "08:00", "18:00"),
  attendance: 200,
  addOns: addOns({}),
};

export const B08: SeedScript = {
  id: CASE08,
  key: "B08",
  applicantId: "westside-youth-soccer-league",
  createdAt: "2027-03-15T09:00",
  answers: b08Answers,
  steps: [
    step("2027-03-15T09:00", "applicant", { type: "create_board" }),
    step("2027-03-15T09:05", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE08, "insurance_certificate"),
      files: [sampleFile("westside-youth-soccer-insurance-certificate.pdf")],
    }),
    step("2027-03-15T09:30", "applicant", { type: "submit" }),
    step("2027-03-17T09:00", "clerk", { type: "accept_complete" }),
    step("2027-03-17T09:05", "clerk", {
      type: "confirm_routing",
      reviewers: [{ dept: "hl", sections: ["Certificate of insurance"], dueDate: "2027-03-31" }],
    }),
    step("2027-03-25T09:00", "hl", {
      type: "request_info",
      taskId: taskId(CASE08, "insurance_certificate"),
      message: "Your certificate of insurance is missing the additional-insured endorsement",
      dueDate: "2027-04-01",
    }),
  ],
  expect: { tier: "reviewed", state: "needs_info" },
  notes: "Applicant-overdue: the request was due Apr 1 and nothing has come back.",
};

/**
 * B09 · Permitopolis Metropolitan Area Interfaith Council for Community Events: Needs info,
 * asked by the Clerk at intake. The organization's name in lib/data/people.ts is the 60+
 * character stress row.
 */
const CASE09 = "PMT-27-0020";
const b09Vendors = vendorNames("Interfaith Food Table", 4);
const b09Answers: EventAnswers = {
  eventType: "market_festival",
  name: "Interfaith Unity Festival",
  location: areaLocation("great-lawn", { x: 5, y: 5, w: 45, h: 35 }, 3500),
  schedule: singleSchedule("2027-06-02", "10:00", "16:00"),
  attendance: 500,
  addOns: addOns({ foodVending: { vendors: 4, vendorNames: b09Vendors } }),
};

export const B09: SeedScript = {
  id: CASE09,
  key: "B09",
  applicantId: "permitopolis-metro-interfaith-council",
  createdAt: "2027-04-20T09:00",
  answers: b09Answers,
  steps: [
    step("2027-04-20T09:00", "applicant", { type: "create_board" }),
    step("2027-04-20T09:05", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE09, "insurance_certificate"),
      files: [sampleFile("interfaith-council-insurance-certificate.pdf")],
    }),
    step("2027-04-20T09:10", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE09, "vendor_list"),
      form: { vendors: b09Vendors.map((name) => ({ name, serves: "Community dishes" })) },
    }),
    step("2027-04-20T09:30", "applicant", { type: "submit" }),
    step("2027-04-22T09:00", "clerk", {
      type: "request_info",
      item: "Proof of nonprofit status for the coordinating council",
      message: "Please upload proof of nonprofit status for the coordinating council",
      dueDate: "2027-05-06",
    }),
  ],
  expect: { tier: "reviewed", state: "needs_info" },
  notes: "Stress row: a 60+ character organization name. The Clerk asked at intake, before accept_complete.",
};
