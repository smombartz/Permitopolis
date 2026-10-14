/**
 * Background cases, Draft and Submitted (plan 6.2). B01 is the "one activity entry" stress
 * row; B03 is both "missing insurance" and the Clerk-overdue intake row (6 days old against a
 * 3-day intake SLA).
 */
import type { EventAnswers } from "@/lib/types";
import { EMPTY_ADDONS } from "@/lib/types";
import type { SeedScript } from "../../types";
import { addOns, badFile, inventoryLocation, sampleFile, singleSchedule, step, taskId } from "../helpers";

/** B01 · Central High Robotics Club: a Draft with only a name. */
const b01Answers: EventAnswers = {
  eventType: "performance_rally",
  name: "Central High Robotics Showcase",
  location: null,
  schedule: null,
  attendance: null,
  addOns: EMPTY_ADDONS,
};

export const B01: SeedScript = {
  id: "PMT-27-0002",
  key: "B01",
  applicantId: "central-high-robotics-club",
  createdAt: "2027-05-01T10:00",
  answers: b01Answers,
  wizardStep: "what",
  steps: [],
  expect: { tier: "instant", state: "draft" },
  notes: "Stress row: a case with a single activity entry (creation only).",
};

/** B02 · Riverside Garden Society: complete answers, but the date gate fails (10 days, needs 30). */
const b02Answers: EventAnswers = {
  eventType: "picnic_party",
  name: "Riverside Garden Society spring mixer",
  description: "A live-music garden mixer for members.",
  location: inventoryLocation(["field-3"]),
  schedule: singleSchedule("2027-05-13", "16:00", "20:00"),
  attendance: 60,
  addOns: addOns({ amplifiedSound: true }),
};

export const B02: SeedScript = {
  id: "PMT-27-0004",
  key: "B02",
  applicantId: "riverside-garden-society",
  createdAt: "2027-05-02T10:00",
  answers: b02Answers,
  wizardStep: "plan",
  steps: [],
  expect: { tier: "reviewed", state: "draft" },
  notes: "Date gate fails: Standard needs 30 days, only 10 remain.",
};

/** B03 · Maple Grove Preschool: Submitted, insurance left as a wrong file, 6 days old at intake. */
const CASE03 = "PMT-27-0006";
const b03Answers: EventAnswers = {
  eventType: "picnic_party",
  name: "Maple Grove Preschool spring fair",
  description: "A spring carnival with a bounce house tent.",
  location: inventoryLocation(["field-1"]),
  // Fri, May 28: 31 days after it was submitted. A Standard event needs 30.
  schedule: singleSchedule("2027-05-28", "10:00", "14:00"),
  attendance: 120,
  addOns: addOns({ tentsStages: { count: 2 } }),
};

export const B03: SeedScript = {
  id: CASE03,
  key: "B03",
  applicantId: "maple-grove-preschool",
  createdAt: "2027-04-27T09:00",
  answers: b03Answers,
  steps: [
    step("2027-04-27T09:00", "applicant", { type: "create_board" }),
    step("2027-04-27T09:05", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE03, "structure_specs"),
      files: [sampleFile("maple-grove-preschool-tent-layout.pdf")],
    }),
    step("2027-04-27T09:10", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE03, "insurance_certificate"),
      files: [badFile("spring-fair-flyer.jpg")],
    }),
    step("2027-04-27T09:20", "applicant", { type: "submit" }),
  ],
  expect: { tier: "reviewed", state: "submitted" },
  notes: "Clerk-overdue intake: 6 days old against a 3-day intakeDays SLA; insurance is a wrong file.",
};

/** B04 · North Side Chess Club: Submitted, waiting on the Clerk, nothing unusual. */
const CASE04 = "PMT-27-0008";
const b04Answers: EventAnswers = {
  eventType: "performance_rally",
  name: "North Side Chess Club open tournament",
  location: inventoryLocation(["field-2"]),
  // Sat, Jun 5: 36 days after it was submitted. A Standard event needs 30.
  schedule: singleSchedule("2027-06-05", "09:00", "17:00"),
  attendance: 150,
  addOns: addOns({}),
};

export const B04: SeedScript = {
  id: CASE04,
  key: "B04",
  applicantId: "north-side-chess-club",
  createdAt: "2027-04-30T09:00",
  answers: b04Answers,
  steps: [
    step("2027-04-30T09:00", "applicant", { type: "create_board" }),
    step("2027-04-30T09:05", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE04, "insurance_certificate"),
      files: [sampleFile("north-side-chess-club-insurance-certificate.pdf")],
    }),
    step("2027-04-30T09:15", "applicant", { type: "submit" }),
  ],
  expect: { tier: "reviewed", state: "submitted" },
};
