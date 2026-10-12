/**
 * Background cases, Closeout and Closed (plan 6.2). B17 carries the $0 fee-line stress row.
 * All log_closeout calls pass `actuals: []` and use `extraLines` only, since a seed script
 * cannot know the real fee-line ids that estimateFees() will assign at replay time.
 */
import type { EventAnswers } from "@/lib/types";
import type { SeedScript } from "../../types";
import { addOns, inventoryLocation, sampleFile, singleSchedule, step, taskId } from "../helpers";

/** B17 · Permitopolis University Greek Council: Closeout, hours logged, waiting on the Clerk. */
const CASE17 = "PMT-27-0036";
const b17Answers: EventAnswers = {
  eventType: "picnic_party",
  name: "Permitopolis University Greek Council philanthropy day",
  location: inventoryLocation(["shelter-4"]),
  schedule: singleSchedule("2027-04-20", "11:00", "18:00"),
  attendance: 200,
  addOns: addOns({ amplifiedSound: true }),
};

export const B17: SeedScript = {
  id: CASE17,
  key: "B17",
  applicantId: "campus-greek-council",
  createdAt: "2027-03-01T09:00",
  answers: b17Answers,
  steps: [
    step("2027-03-01T09:00", "applicant", { type: "create_board" }),
    step("2027-03-01T09:05", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE17, "insurance_certificate"),
      files: [sampleFile("campus-greek-council-insurance-certificate.pdf")],
    }),
    step("2027-03-01T09:10", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE17, "sound_details"),
      form: { equipment: "Portable PA system", soundCheckTime: "10:30" },
    }),
    step("2027-03-01T09:30", "applicant", { type: "submit" }),
    step("2027-03-03T09:00", "clerk", { type: "accept_complete" }),
    step("2027-03-03T09:05", "clerk", {
      type: "confirm_routing",
      reviewers: [
        { dept: "pws", sections: ["Sound details"], dueDate: "2027-03-17" },
        { dept: "hl", sections: ["Certificate of insurance"], dueDate: "2027-03-17" },
      ],
    }),
    step("2027-03-10T09:00", "pws", { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }),
    step("2027-03-10T09:05", "hl", { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }),
    step("2027-03-12T09:00", "clerk", { type: "send_quote", conditions: [], feeLines: [] }),
    step("2027-03-13T09:00", "applicant", { type: "accept_and_sign", signature: "Spencer Quigley" }),
    step("2027-03-13T09:05", "applicant", { type: "pay", amount: 440, method: "card", kind: "quote" }),
    step("2027-03-14T09:00", "clerk", { type: "issue_permit" }),
    step("2027-04-21T09:00", "pws", {
      type: "log_closeout",
      cleanup: "pass",
      notes: "Site left clean; no issues.",
      actuals: [],
      extraLines: [{ dept: "clerk", label: "Courtesy fee waiver", qty: 1, unit: "flat", unitPrice: 0, kind: "fee" }],
    }),
  ],
  expect: { tier: "reviewed", state: "closeout" },
  notes: "Stress row: a $0 fee line (a waived courtesy charge). Reconcile and close still need to run.",
};

/** B18 · Thunderbird Motorcycle Club: Closeout, a failed cleanup inspection. */
const CASE18 = "PMT-27-0038";
const b18Answers: EventAnswers = {
  eventType: "race_parade",
  name: "Thunderbird Motorcycle Club poker run",
  description: "A charity poker run with a short police-escorted street closure.",
  location: { mode: "streets", inventoryIds: [], segmentIds: ["elm-100"], miles: 0.08, label: "100 block of Elm Street" },
  schedule: singleSchedule("2027-04-10", "09:00", "13:00"),
  attendance: 180,
  addOns: addOns({}),
};

export const B18: SeedScript = {
  id: CASE18,
  key: "B18",
  applicantId: "thunderbird-motorcycle-club",
  createdAt: "2027-02-05T09:00",
  answers: b18Answers,
  steps: [
    step("2027-02-05T09:00", "applicant", { type: "create_board" }),
    step("2027-02-05T09:05", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE18, "insurance_certificate"),
      files: [sampleFile("thunderbird-mc-insurance-certificate.pdf")],
    }),
    step("2027-02-05T09:10", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE18, "traffic_control_plan"),
      files: [sampleFile("poker-run-traffic-control-plan.pdf")],
    }),
    step("2027-02-05T09:15", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE18, "security_medical_plan"),
      files: [sampleFile("poker-run-security-medical-plan.pdf")],
    }),
    step("2027-02-05T09:20", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE18, "emergency_plan"),
      files: [sampleFile("poker-run-emergency-plan.pdf")],
    }),
    step("2027-02-05T09:25", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE18, "cleanup_plan"),
      form: { crew: 2, sweepStartsAt: "13:00" },
    }),
    step("2027-02-05T10:00", "applicant", { type: "submit" }),
    step("2027-02-07T09:00", "clerk", { type: "accept_complete" }),
    step("2027-02-07T09:05", "clerk", {
      type: "confirm_routing",
      reviewers: [
        {
          dept: "pws",
          sections: ["Traffic control plan", "Security and medical plan", "Emergency plan", "Cleanup plan"],
          dueDate: "2027-02-28",
        },
        { dept: "hl", sections: ["Certificate of insurance"], dueDate: "2027-02-28" },
      ],
    }),
    step("2027-02-15T09:00", "pws", { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }),
    step("2027-02-15T09:05", "hl", { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }),
    step("2027-02-17T09:00", "clerk", { type: "send_quote", conditions: [], feeLines: [] }),
    step("2027-02-18T09:00", "applicant", { type: "accept_and_sign", signature: "Rosa Beaumont" }),
    step("2027-02-18T09:05", "applicant", { type: "pay", amount: 400, method: "card", kind: "quote" }),
    step("2027-02-19T09:00", "clerk", { type: "issue_permit" }),
    step("2027-04-11T09:00", "pws", {
      type: "log_closeout",
      cleanup: "issues",
      notes: "Trash left along the route; a follow-up sweep is needed.",
      actuals: [],
      extraLines: [{ dept: "pws", label: "Extra cleanup crew", qty: 2, unit: "worker-hour", unitPrice: 60, kind: "fee" }],
    }),
  ],
  expect: { tier: "special", state: "closeout" },
};

/** B19 · Summit Ridge Running Club: Closed, a refund. */
const CASE19 = "PMT-27-0040";
const b19Answers: EventAnswers = {
  eventType: "race_parade",
  name: "Summit Ridge Running Club downtown dash",
  location: { mode: "route", inventoryIds: [], segmentIds: ["main-1-2", "main-2-3"], miles: 0.2, label: "Main Street, 1st to 3rd Avenue" },
  schedule: singleSchedule("2027-03-05", "07:00", "09:00", { setupStart: "06:00", teardownEnd: "09:30" }),
  attendance: 300,
  addOns: addOns({}),
};

export const B19: SeedScript = {
  id: CASE19,
  key: "B19",
  applicantId: "summit-ridge-running-club",
  createdAt: "2027-01-05T09:00",
  answers: b19Answers,
  steps: [
    step("2027-01-05T09:00", "applicant", { type: "create_board" }),
    step("2027-01-05T09:05", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE19, "insurance_certificate"),
      files: [sampleFile("summit-ridge-insurance-certificate.pdf")],
    }),
    step("2027-01-05T09:10", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE19, "traffic_control_plan"),
      files: [sampleFile("downtown-dash-traffic-control-plan.pdf")],
    }),
    step("2027-01-05T09:15", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE19, "security_medical_plan"),
      files: [sampleFile("downtown-dash-security-medical-plan.pdf")],
    }),
    step("2027-01-05T09:20", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE19, "emergency_plan"),
      files: [sampleFile("downtown-dash-emergency-plan.pdf")],
    }),
    step("2027-01-05T09:25", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE19, "cleanup_plan"),
      form: { crew: 2, sweepStartsAt: "09:00" },
    }),
    step("2027-01-05T10:00", "applicant", { type: "submit" }),
    step("2027-01-07T09:00", "clerk", { type: "accept_complete" }),
    step("2027-01-07T09:05", "clerk", {
      type: "confirm_routing",
      reviewers: [
        {
          dept: "pws",
          sections: ["Traffic control plan", "Security and medical plan", "Emergency plan", "Cleanup plan"],
          dueDate: "2027-01-21",
        },
        { dept: "hl", sections: ["Certificate of insurance"], dueDate: "2027-01-21" },
      ],
    }),
    step("2027-01-15T09:00", "pws", { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }),
    step("2027-01-15T09:05", "hl", { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }),
    step("2027-01-17T09:00", "clerk", { type: "send_quote", conditions: [], feeLines: [] }),
    step("2027-01-18T09:00", "applicant", { type: "accept_and_sign", signature: "Niko Alexopoulos" }),
    step("2027-01-18T09:05", "applicant", { type: "pay", amount: 530, method: "card", kind: "quote" }),
    step("2027-01-19T09:00", "clerk", { type: "issue_permit" }),
    step("2027-03-06T09:00", "pws", {
      type: "log_closeout",
      cleanup: "pass",
      notes: "Clean sweep, nothing beyond the plan.",
      actuals: [],
      extraLines: [],
    }),
    step("2027-03-07T09:00", "clerk", { type: "reconcile_close" }),
    step("2027-03-08T09:00", "applicant", { type: "submit_feedback", rating: 5, comment: "Smooth process, great route support." }),
  ],
  expect: { tier: "special", state: "closed" },
  notes: "Nothing ran over the estimate, so the full deposit comes back as a refund.",
};

/** B20 · Golden Years Senior Center: Closed, an extra invoice beyond the deposit. */
const CASE20 = "PMT-27-0042";
const b20Answers: EventAnswers = {
  eventType: "picnic_party",
  name: "Golden Years Senior Center spring carnival",
  location: inventoryLocation(["field-2"]),
  schedule: singleSchedule("2027-03-15", "11:00", "15:00"),
  attendance: 150,
  addOns: addOns({}),
};

export const B20: SeedScript = {
  id: CASE20,
  key: "B20",
  applicantId: "golden-years-senior-center",
  createdAt: "2027-01-10T09:00",
  answers: b20Answers,
  steps: [
    step("2027-01-10T09:00", "applicant", { type: "create_board" }),
    step("2027-01-10T09:05", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE20, "insurance_certificate"),
      files: [sampleFile("golden-years-insurance-certificate.pdf")],
    }),
    step("2027-01-10T09:30", "applicant", { type: "submit" }),
    step("2027-01-12T09:00", "clerk", { type: "accept_complete" }),
    step("2027-01-12T09:05", "clerk", {
      type: "confirm_routing",
      reviewers: [{ dept: "hl", sections: ["Certificate of insurance"], dueDate: "2027-01-26" }],
    }),
    step("2027-01-18T09:00", "hl", { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }),
    step("2027-01-20T09:00", "clerk", { type: "send_quote", conditions: [], feeLines: [] }),
    step("2027-01-21T09:00", "applicant", { type: "accept_and_sign", signature: "Bernadette Flores" }),
    step("2027-01-21T09:05", "applicant", { type: "pay", amount: 300, method: "card", kind: "quote" }),
    step("2027-01-22T09:00", "clerk", { type: "issue_permit" }),
    step("2027-03-16T09:00", "pws", {
      type: "log_closeout",
      cleanup: "issues",
      notes: "Extra crew was needed to clear food waste after the carnival ran long.",
      actuals: [],
      extraLines: [{ dept: "pws", label: "Extra cleanup crew", qty: 3, unit: "worker-hour", unitPrice: 60, kind: "fee" }],
    }),
    step("2027-03-17T09:00", "clerk", { type: "reconcile_close" }),
  ],
  expect: { tier: "reviewed", state: "closed" },
  notes: "The extra cleanup crew exceeds the deposit, so the final bill asks for more.",
};

/** B21 · Maple Ridge Scouts Troop 214: Closed, an Instant event closed automatically. */
const CASE21 = "PMT-27-0044";
const b21Answers: EventAnswers = {
  eventType: "picnic_party",
  name: "Maple Ridge Scouts Troop 214 campout kickoff",
  location: inventoryLocation(["shelter-1"]),
  schedule: singleSchedule("2027-03-01", "10:00", "15:00"),
  attendance: 40,
  addOns: addOns({}),
};

export const B21: SeedScript = {
  id: CASE21,
  key: "B21",
  applicantId: "maple-ridge-scouts-troop-214",
  createdAt: "2027-02-15T09:00",
  answers: b21Answers,
  steps: [
    step("2027-02-15T09:00", "applicant", { type: "create_board" }),
    step("2027-02-15T09:05", "applicant", { type: "book_and_pay", method: "card" }),
  ],
  expect: { tier: "instant", state: "closed" },
  notes: "Instant events skip Closeout: the engine ticks straight to Closed once the event day passes.",
};
