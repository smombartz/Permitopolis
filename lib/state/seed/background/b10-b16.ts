/**
 * Background cases, Quote sent, Permitted and Event day (plan 6.2). B12 carries the
 * diacritics-and-apostrophe stress row; B13 is a 20+ session series; B14 is a Special event
 * with work orders, carries the over-10-mile route, and is padded past 30 activity entries;
 * B16 is the one Event-day case the demo date requires, with a session skipped for the
 * Memorial Day blackout.
 */
import type { Action } from "../../actions";
import type { EventAnswers } from "@/lib/types";
import type { SeedScript } from "../../types";
import { RIVERFRONT_5K_ROUTE } from "@/lib/data/streets";
import {
  addOns,
  cityServices,
  inventoryLocation,
  sampleFile,
  singleSchedule,
  step,
  taskId,
  weeklySchedule,
} from "../helpers";

/** B10 · Oakhill Homeowners Association: Quote sent, the hold expires tomorrow (May 4). */
const CASE10 = "PMT-27-0022";
const b10Answers: EventAnswers = {
  eventType: "picnic_party",
  name: "Oakhill Homeowners Association spring cleanup day",
  location: inventoryLocation(["field-2"]),
  schedule: singleSchedule("2027-05-15", "09:00", "13:00"),
  attendance: 150,
  addOns: addOns({ cityServices: cityServices({ barricades: 3 }) }),
};

export const B10: SeedScript = {
  id: CASE10,
  key: "B10",
  applicantId: "oakhill-homeowners-association",
  createdAt: "2027-04-05T09:00",
  answers: b10Answers,
  steps: [
    step("2027-04-05T09:00", "applicant", { type: "create_board" }),
    step("2027-04-05T09:05", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE10, "insurance_certificate"),
      files: [sampleFile("oakhill-hoa-insurance-certificate.pdf")],
    }),
    step("2027-04-05T09:10", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE10, "city_services_request"),
      form: { barricades: 3, trash: true, power: false, policeOfficers: 0, policeHours: 0 },
    }),
    step("2027-04-05T09:30", "applicant", { type: "submit" }),
    step("2027-04-07T09:00", "clerk", { type: "accept_complete" }),
    step("2027-04-07T09:05", "clerk", {
      type: "confirm_routing",
      reviewers: [
        { dept: "pws", sections: ["City services request"], dueDate: "2027-04-19" },
        { dept: "hl", sections: ["Certificate of insurance"], dueDate: "2027-04-19" },
      ],
    }),
    step("2027-04-15T09:00", "pws", { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }),
    step("2027-04-15T09:05", "hl", { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }),
    step("2027-04-20T09:00", "clerk", { type: "send_quote", conditions: [], feeLines: [] }),
  ],
  expect: { tier: "reviewed", state: "quote_sent" },
  notes: "Hold placed Apr 20 + 14 days = expires May 4, tomorrow on the demo date.",
};

/** B11 · Greenfield Charter School: Quote sent, paid and waiting on Health & Legal's insurance check. */
const CASE11 = "PMT-27-0024";
const b11Answers: EventAnswers = {
  eventType: "performance_rally",
  name: "Greenfield Charter School spring showcase",
  location: inventoryLocation(["field-3"]),
  schedule: singleSchedule("2027-06-04", "17:00", "20:00"),
  attendance: 250,
  addOns: addOns({ amplifiedSound: true }),
};

export const B11: SeedScript = {
  id: CASE11,
  key: "B11",
  applicantId: "greenfield-charter-school",
  createdAt: "2027-03-25T09:00",
  answers: b11Answers,
  steps: [
    step("2027-03-25T09:00", "applicant", { type: "create_board" }),
    step("2027-03-25T09:05", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE11, "insurance_certificate"),
      files: [sampleFile("greenfield-charter-insurance-certificate.pdf")],
    }),
    step("2027-03-25T09:10", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE11, "sound_details"),
      form: { equipment: "Field PA system", soundCheckTime: "16:30" },
    }),
    step("2027-03-25T09:30", "applicant", { type: "submit" }),
    step("2027-03-27T09:00", "clerk", { type: "accept_complete" }),
    step("2027-03-27T09:05", "clerk", {
      type: "confirm_routing",
      reviewers: [
        { dept: "pws", sections: ["Sound details"], dueDate: "2027-04-10" },
        { dept: "hl", sections: ["Certificate of insurance"], dueDate: "2027-04-10" },
      ],
    }),
    step("2027-04-01T09:00", "pws", { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }),
    step("2027-04-01T09:05", "hl", { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }),
    step("2027-04-10T09:00", "clerk", { type: "send_quote", conditions: [], feeLines: [] }),
    step("2027-04-11T09:00", "applicant", { type: "accept_and_sign", signature: "Edith Vance" }),
    step("2027-04-11T09:05", "applicant", { type: "pay", amount: 395, method: "card", kind: "quote" }),
    step("2027-04-30T09:00", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE11, "insurance_certificate"),
      files: [sampleFile("greenfield-charter-insurance-certificate-v2.pdf")],
    }),
  ],
  expect: { tier: "reviewed", state: "quote_sent" },
  notes: "Paid, but the re-uploaded insurance certificate is back in 'submitted' pending a fresh check.",
};

/** B12 · Renée O'Connell: Permitted, event within the next 7 days. Stress row: diacritics + apostrophe. */
const CASE12 = "PMT-27-0026";
const b12Answers: EventAnswers = {
  eventType: "picnic_party",
  name: "Renée O'Connell's family reunion",
  location: inventoryLocation(["shelter-1"]),
  schedule: singleSchedule("2027-05-09", "11:00", "16:00"),
  attendance: 28,
  addOns: addOns({}),
};

export const B12: SeedScript = {
  id: CASE12,
  key: "B12",
  applicantId: "renee-oconnell",
  createdAt: "2027-04-15T09:00",
  answers: b12Answers,
  steps: [
    step("2027-04-15T09:00", "applicant", { type: "create_board" }),
    step("2027-04-15T09:05", "applicant", { type: "book_and_pay", method: "card" }),
  ],
  expect: { tier: "instant", state: "permitted" },
};

/** B13 · Northgate Swim Club: Permitted, a 20+ session series. */
const CASE13 = "PMT-27-0028";
const b13Answers: EventAnswers = {
  eventType: "class_meetup",
  name: "Northgate Swim Club dryland training",
  location: inventoryLocation(["field-2"]),
  schedule: weeklySchedule("2027-05-04", "17:00", "18:30", "2027-09-21"),
  attendance: 25,
  addOns: addOns({}),
};

export const B13: SeedScript = {
  id: CASE13,
  key: "B13",
  applicantId: "northgate-swim-club",
  createdAt: "2027-04-01T09:00",
  answers: b13Answers,
  steps: [
    step("2027-04-01T09:00", "applicant", { type: "create_board" }),
    step("2027-04-01T09:05", "applicant", { type: "book_and_pay", method: "card" }),
  ],
  expect: { tier: "instant", state: "permitted" },
};

/** B14 · Cascade Trail Runners: Permitted Special event with work orders. Stress rows: a route
 *  over 10 miles (four laps of the Riverfront loop) and 30+ activity entries. */
const CASE14 = "PMT-27-0030";
const FOUR_LAPS = [...RIVERFRONT_5K_ROUTE, ...RIVERFRONT_5K_ROUTE, ...RIVERFRONT_5K_ROUTE, ...RIVERFRONT_5K_ROUTE];

const b14Answers: EventAnswers = {
  eventType: "race_parade",
  name: "Four Bridges Ultra",
  description: "A four-lap ultramarathon over the Riverfront loop.",
  location: { mode: "route", inventoryIds: [], segmentIds: FOUR_LAPS, miles: 12.4, label: "Four laps of the Riverfront loop" },
  schedule: singleSchedule("2027-08-14", "06:00", "14:00", { setupStart: "05:00", teardownEnd: "14:30" }),
  attendance: 600,
  addOns: addOns({ cityServices: cityServices({ barricades: 30, policeOfficers: 6, policeHours: 4 }) }),
};

const b14Notes = (dept: "pws" | "hl" | "clerk", text: string, at: string): ReturnType<typeof step> =>
  step(at, dept, { type: "add_note", text } satisfies Action);

export const B14: SeedScript = {
  id: CASE14,
  key: "B14",
  applicantId: "cascade-trail-runners",
  createdAt: "2027-02-10T09:00",
  answers: b14Answers,
  steps: [
    step("2027-02-10T09:00", "applicant", { type: "create_board" }),
    step("2027-02-10T09:05", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE14, "insurance_certificate"),
      files: [sampleFile("cascade-trail-runners-insurance-certificate.pdf")],
    }),
    step("2027-02-10T09:10", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE14, "traffic_control_plan"),
      files: [sampleFile("four-bridges-ultra-traffic-control-plan.pdf")],
    }),
    step("2027-02-10T09:15", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE14, "security_medical_plan"),
      files: [sampleFile("four-bridges-ultra-security-medical-plan.pdf")],
    }),
    step("2027-02-10T09:20", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE14, "emergency_plan"),
      files: [sampleFile("four-bridges-ultra-emergency-plan.pdf")],
    }),
    step("2027-02-10T09:25", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE14, "city_services_request"),
      form: { barricades: 30, policeOfficers: 6, policeHours: 4, trash: false, power: false },
    }),
    step("2027-02-10T09:30", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE14, "site_plan"),
      form: { drawnOn: "step 2 map", notes: "Four laps with an aid station at each bridge" },
    }),
    step("2027-02-10T09:35", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE14, "cleanup_plan"),
      form: { crew: 4, sweepStartsAt: "14:00" },
    }),
    step("2027-02-10T10:00", "applicant", { type: "submit" }),
    step("2027-02-12T09:00", "clerk", { type: "accept_complete" }),
    step("2027-02-12T09:05", "clerk", {
      type: "confirm_routing",
      reviewers: [
        {
          dept: "pws",
          sections: [
            "Traffic control plan",
            "Security and medical plan",
            "Emergency plan",
            "City services request",
            "Site plan",
            "Cleanup plan",
          ],
          dueDate: "2027-03-05",
        },
        { dept: "hl", sections: ["Certificate of insurance"], dueDate: "2027-03-05" },
      ],
    }),
    b14Notes("pws", "Coordinating with Police traffic unit on lap-start staggering", "2027-02-15T09:00"),
    b14Notes("pws", "Confirmed aid station placement at each bridge crossing", "2027-02-18T09:00"),
    b14Notes("hl", "Insurance carrier confirmed, pending final review", "2027-02-20T09:00"),
    step("2027-02-25T09:00", "pws", {
      type: "review_decide",
      decision: "approve_with_conditions",
      conditions: ["A fire lane of 20 feet stays open at all times", "A certified flagger at every vehicle crossing"],
      feeLines: [],
    }),
    step("2027-02-25T09:05", "hl", { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }),
    b14Notes("clerk", "Consolidated conditions, preparing the quote", "2027-02-26T09:00"),
    step("2027-02-27T09:00", "clerk", { type: "send_quote", conditions: [], feeLines: [] }),
    step("2027-02-28T09:00", "applicant", { type: "accept_and_sign", signature: "Kit Fennimore" }),
    step("2027-02-28T09:05", "applicant", { type: "pay", amount: 3680, method: "card", kind: "quote" }),
    step("2027-03-01T09:00", "clerk", { type: "issue_permit" }),
    b14Notes("pws", "Work order: 30 barricades staged at the start/finish", "2027-03-02T09:00"),
    b14Notes("pws", "Work order: 6 officers confirmed for lap crossings", "2027-03-02T09:05"),
    b14Notes("clerk", "Day-of contact card printed for the organizer", "2027-03-03T09:00"),
    b14Notes("pws", "Walkthrough of the finish-line area completed", "2027-03-10T09:00"),
    b14Notes("hl", "Accessible viewing area confirmed near the finish", "2027-03-11T09:00"),
    b14Notes("clerk", "Reminder sent: permit packet available for pickup", "2027-03-12T09:00"),
    b14Notes("pws", "Road paint for lap markers scheduled", "2027-03-14T09:00"),
    b14Notes("clerk", "Noted date on the Active permits calendar", "2027-03-15T09:00"),
    b14Notes("pws", "Confirmed water station refill schedule with Parks", "2027-03-20T09:00"),
    b14Notes("hl", "Medical tent staffing plan received and filed", "2027-03-21T09:00"),
  ],
  expect: { tier: "special", state: "permitted" },
  notes: "Stress rows: a 12.4-mile route and 30+ activity entries.",
};

/** B15 · Pine Street Neighborhood Association: Permitted, a plain filler. */
const CASE15 = "PMT-27-0032";
const b15Answers: EventAnswers = {
  eventType: "picnic_party",
  name: "Pine Street Neighborhood Association block mixer",
  location: inventoryLocation(["shelter-2"]),
  schedule: singleSchedule("2027-05-08", "17:00", "20:00"),
  attendance: 35,
  addOns: addOns({}),
};

export const B15: SeedScript = {
  id: CASE15,
  key: "B15",
  applicantId: "pine-street-neighborhood-assn",
  createdAt: "2027-04-18T09:00",
  answers: b15Answers,
  steps: [
    step("2027-04-18T09:00", "applicant", { type: "create_board" }),
    step("2027-04-18T09:05", "applicant", { type: "book_and_pay", method: "card" }),
  ],
  expect: { tier: "instant", state: "permitted" },
  notes: "Shelter 2 before May 13 only: May 13 onward is reserved for demo path 2.",
};

/** B16 · Riverside Tai Chi Circle: the one Event-day case the seed needs, Mondays at Field 3.
 *  Its May 31 session falls on the Memorial Day blackout. */
const CASE16 = "PMT-27-0034";
const b16Answers: EventAnswers = {
  eventType: "class_meetup",
  name: "Riverside Tai Chi Circle morning practice",
  location: inventoryLocation(["field-3"]),
  schedule: weeklySchedule("2027-03-01", "07:00", "08:00", "2027-07-26"),
  attendance: 15,
  addOns: addOns({}),
};

export const B16: SeedScript = {
  id: CASE16,
  key: "B16",
  applicantId: "riverside-tai-chi-circle",
  createdAt: "2027-02-20T09:00",
  answers: b16Answers,
  steps: [
    step("2027-02-20T09:00", "applicant", { type: "create_board" }),
    step("2027-02-20T09:05", "applicant", { type: "book_and_pay", method: "card" }),
  ],
  expect: { tier: "instant", state: "event_day" },
  notes: "Today, May 3, is one of its Monday sessions. May 31 is skipped for the Memorial Day blackout.",
};
