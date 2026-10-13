/**
 * Background cases, the four off-path endings (plan 6.2): Denied, Withdrawn, Cancelled and
 * Hold expired, one each, every reason stated in its activity log through the action's
 * `reason` or `message` payload.
 */
import type { EventAnswers } from "@/lib/types";
import type { SeedScript } from "../../types";
import { addOns, inventoryLocation, sampleFile, singleSchedule, step, taskId } from "../helpers";

/** B22 · Redline Motorsports Expo: Denied. */
const CASE22 = "PMT-27-0046";
const b22Answers: EventAnswers = {
  eventType: "performance_rally",
  name: "Redline Motorsports Expo",
  description: "An indoor-outdoor motorsports expo with amplified announcements.",
  location: inventoryLocation(["field-1", "field-2"]),
  schedule: singleSchedule("2027-08-07", "10:00", "19:00"),
  attendance: 500,
  addOns: addOns({ amplifiedSound: true }),
};

export const B22: SeedScript = {
  id: CASE22,
  key: "B22",
  applicantId: "redline-motorsports-expo",
  createdAt: "2027-03-01T09:00",
  answers: b22Answers,
  steps: [
    step("2027-03-01T09:00", "applicant", { type: "create_board" }),
    step("2027-03-01T09:05", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE22, "insurance_certificate"),
      files: [sampleFile("redline-motorsports-insurance-certificate.pdf")],
    }),
    step("2027-03-01T09:10", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE22, "sound_details"),
      form: { equipment: "PA announcer system and engine noise", soundCheckTime: "09:00" },
    }),
    step("2027-03-01T09:30", "applicant", { type: "submit" }),
    step("2027-03-03T09:00", "clerk", { type: "accept_complete" }),
    step("2027-03-03T09:05", "clerk", {
      type: "confirm_routing",
      reviewers: [{ dept: "pws", sections: ["Sound details"], dueDate: "2027-03-17" }],
    }),
    step("2027-03-10T09:00", "pws", {
      type: "review_decide",
      decision: "deny",
      conditions: [],
      feeLines: [],
      internalNote: "Engine noise levels cannot be mitigated enough for two fields of spectators.",
    }),
    step("2027-03-12T09:00", "clerk", {
      type: "deny",
      reason: "Public Works & Safety could not approve the sound plan for this location.",
    }),
  ],
  expect: { tier: "reviewed", state: "in_review", ending: "denied" },
};

/** B23 · Sunnyvale Block Association: Withdrawn, before a permit exists. */
const CASE23 = "PMT-27-0048";
const b23Answers: EventAnswers = {
  eventType: "picnic_party",
  name: "Sunnyvale Block Association summer kickoff",
  location: inventoryLocation(["field-1"]),
  schedule: singleSchedule("2027-06-10", "16:00", "20:00"),
  attendance: 150,
  addOns: addOns({ amplifiedSound: true }),
};

export const B23: SeedScript = {
  id: CASE23,
  key: "B23",
  applicantId: "sunnyvale-block-association",
  createdAt: "2027-04-22T09:00",
  answers: b23Answers,
  steps: [
    step("2027-04-22T09:00", "applicant", { type: "create_board" }),
    step("2027-04-22T09:05", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE23, "insurance_certificate"),
      files: [sampleFile("sunnyvale-block-assn-insurance-certificate.pdf")],
    }),
    step("2027-04-22T09:10", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE23, "sound_details"),
      form: { equipment: "Bluetooth speaker", soundCheckTime: "15:30" },
    }),
    step("2027-04-22T09:30", "applicant", { type: "submit" }),
    step("2027-04-24T09:00", "applicant", { type: "withdraw" }),
  ],
  expect: { tier: "reviewed", state: "submitted", ending: "withdrawn" },
  notes: "Withdrawn two days after submitting, before the Clerk even accepted it.",
};

/** B24 · Evergreen Wedding Planners: Cancelled, after a permit was issued. */
const CASE24 = "PMT-27-0050";
const b24Answers: EventAnswers = {
  eventType: "picnic_party",
  name: "Evergreen Wedding Planners reception",
  location: inventoryLocation(["shelter-1"]),
  schedule: singleSchedule("2027-06-15", "16:00", "22:00"),
  attendance: 60,
  addOns: addOns({}),
};

export const B24: SeedScript = {
  id: CASE24,
  key: "B24",
  applicantId: "evergreen-wedding-planners",
  createdAt: "2027-03-10T09:00",
  answers: b24Answers,
  steps: [
    step("2027-03-10T09:00", "applicant", { type: "create_board" }),
    step("2027-03-10T09:05", "applicant", { type: "book_and_pay", method: "card" }),
    step("2027-05-01T09:00", "applicant", { type: "cancel" }),
  ],
  expect: { tier: "instant", state: "permitted", ending: "cancelled" },
  notes: "Cancelled 45 days out: 30+ days before gets a full refund minus the $10 processing fee.",
};

/** B25 · North Permitopolis Chamber of Commerce: Hold expired, quote never paid. */
const CASE25 = "PMT-27-0052";
const b25Answers: EventAnswers = {
  eventType: "market_festival",
  name: "North Permitopolis Chamber mixer",
  location: inventoryLocation(["field-2"]),
  schedule: singleSchedule("2027-07-01", "17:00", "20:00"),
  attendance: 200,
  addOns: addOns({ foodVending: { vendors: 2, vendorNames: ["Chamber Taco Cart", "Chamber Lemonade Stand"] } }),
};

export const B25: SeedScript = {
  id: CASE25,
  key: "B25",
  applicantId: "north-permitopolis-chamber",
  createdAt: "2027-03-01T09:00",
  answers: b25Answers,
  steps: [
    step("2027-03-01T09:00", "applicant", { type: "create_board" }),
    step("2027-03-01T09:05", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE25, "insurance_certificate"),
      files: [sampleFile("chamber-mixer-insurance-certificate.pdf")],
    }),
    step("2027-03-01T09:10", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE25, "vendor_list"),
      form: { vendors: [{ name: "Chamber Taco Cart", serves: "Tacos" }, { name: "Chamber Lemonade Stand", serves: "Lemonade" }] },
    }),
    step("2027-03-01T09:30", "applicant", { type: "submit" }),
    step("2027-03-03T09:00", "clerk", { type: "accept_complete" }),
    step("2027-03-03T09:05", "clerk", {
      type: "confirm_routing",
      reviewers: [{ dept: "hl", sections: ["Certificate of insurance", "Vendor list"], dueDate: "2027-03-17" }],
    }),
    step("2027-03-10T09:00", "hl", { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }),
    step("2027-04-12T09:00", "clerk", { type: "send_quote", conditions: [], feeLines: [] }),
  ],
  expect: { tier: "reviewed", state: "quote_sent", ending: "hold_expired" },
  notes: "Quote sent Mon, Apr 12 + 14 days = the hold expires Apr 26, which has already passed on the demo date.",
};
