/**
 * S5 · Riverfront Summer 5K. Special event, Quote sent. Every special-event plan is done, the
 * pre-application meeting was held, the community notice is done, both departments approved,
 * the coordination meeting (Jun 21) and walkthrough (Jul 2) are already scheduled by the Clerk
 * even though their cards stay locked until Permitted (plan 3.3: these are explicit
 * `scheduledFor` values, not derived from the catalogue's default due-date rule). The quote
 * went out Apr 30, and the applicant re-uploaded the insurance certificate that same day, so it
 * is back in "submitted" pending a fresh check from Health & Legal.
 */
import type { EventAnswers } from "@/lib/types";
import type { SeedScript } from "../../types";
import { addOns, cityServices, routeLocation, sampleFile, singleSchedule, step, taskId } from "../helpers";
import { RIVERFRONT_5K_ROUTE } from "@/lib/data/streets";

const CASE_ID = "PMT-27-0097";

const answers: EventAnswers = {
  eventType: "race_parade",
  name: "Riverfront Summer 5K",
  description: "A 5K road race looping from City Hall Plaza along Main Street and River Road.",
  location: routeLocation(RIVERFRONT_5K_ROUTE, "Downtown loop: City Hall Plaza, Main Street and River Road"),
  schedule: singleSchedule("2027-07-11", "07:00", "11:00", { setupStart: "06:00", teardownEnd: "11:30" }),
  attendance: 1200,
  addOns: addOns({
    amplifiedSound: true,
    cityServices: cityServices({ barricades: 40, policeOfficers: 8, policeHours: 5 }),
  }),
};

const preSubmitDocs: Array<[string, string]> = [
  ["insurance_certificate", "riverfront-running-club-insurance-certificate.pdf"],
  ["traffic_control_plan", "riverfront-5k-traffic-control-plan.pdf"],
  ["security_medical_plan", "riverfront-5k-security-medical-plan.pdf"],
  ["emergency_plan", "riverfront-5k-emergency-plan.pdf"],
];

const preSubmitForms: Array<[string, Record<string, unknown>]> = [
  ["sound_details", { equipment: "Finish-line PA system", soundCheckTime: "06:30" }],
  ["city_services_request", { barricades: 40, policeOfficers: 8, policeHours: 5, trash: true, power: false }],
  ["site_plan", { drawnOn: "step 2 map", notes: "Water stations at miles 1, 2 and 3.1" }],
  ["accessibility_plan", { accessibleRoute: true, restrooms: 6 }],
  ["cleanup_plan", { crew: 4, sweepStartsAt: "11:00" }],
];

export const S5: SeedScript = {
  id: CASE_ID,
  key: "S5",
  applicantId: "riverfront-running-club",
  createdAt: "2027-03-08T09:00",
  answers,
  steps: [
    step("2027-03-08T09:00", "applicant", { type: "create_board" }),
    ...preSubmitDocs.map(([catalogId, name], i) =>
      step(`2027-03-08T09:${String(10 + i * 5).padStart(2, "0")}`, "applicant", {
        type: "complete_task",
        taskId: taskId(CASE_ID, catalogId),
        files: [sampleFile(name)],
      }),
    ),
    ...preSubmitForms.map(([catalogId, form], i) =>
      step(`2027-03-08T09:${String(35 + i * 5).padStart(2, "0")}`, "applicant", {
        type: "complete_task",
        taskId: taskId(CASE_ID, catalogId),
        form,
      }),
    ),
    step("2027-03-08T10:00", "applicant", { type: "submit" }),
    step("2027-03-10T09:00", "clerk", { type: "accept_complete" }),
    step("2027-03-10T09:05", "clerk", {
      type: "confirm_routing",
      reviewers: [
        {
          dept: "pws",
          sections: [
            "Sound details",
            "City services request",
            "Site plan",
            "Traffic control plan",
            "Security and medical plan",
            "Emergency plan",
            "Cleanup plan",
          ],
          dueDate: "2027-04-14",
        },
        { dept: "hl", sections: ["Certificate of insurance", "Accessibility plan"], dueDate: "2027-04-14" },
      ],
    }),
    step("2027-03-17T10:00", "clerk", {
      type: "schedule_meeting",
      taskId: taskId(CASE_ID, "pre_application_meeting"),
      date: "2027-03-17",
    }),
    step("2027-03-17T10:05", "clerk", { type: "complete_city_task", taskId: taskId(CASE_ID, "pre_application_meeting") }),
    step("2027-03-20T09:00", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE_ID, "community_notification"),
      files: [sampleFile("riverfront-5k-posted-notice.jpg", { type: "image/jpeg", size: 980_000 })],
    }),
    step("2027-03-21T09:00", "clerk", { type: "verify_document", taskId: taskId(CASE_ID, "community_notification") }),
    step("2027-04-10T09:00", "pws", {
      type: "review_decide",
      decision: "approve_with_conditions",
      conditions: ["Route closed 6 to 11:30 am", "8 officers on the route", "40 barricades", "Finish-line sound off by 11 am"],
      feeLines: [],
    }),
    step("2027-04-10T09:05", "hl", { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }),
    step("2027-04-30T09:00", "clerk", { type: "send_quote", conditions: [], feeLines: [] }),
    step("2027-04-30T09:10", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE_ID, "insurance_certificate"),
      files: [sampleFile("race-day-insurance-certificate.pdf")],
    }),
    step("2027-04-30T09:15", "clerk", {
      type: "schedule_meeting",
      taskId: taskId(CASE_ID, "coordination_meeting"),
      date: "2027-06-21",
    }),
    step("2027-04-30T09:20", "pws", {
      type: "schedule_meeting",
      taskId: taskId(CASE_ID, "site_walkthrough"),
      date: "2027-07-02",
    }),
  ],
  expect: { tier: "special", state: "quote_sent" },
  notes: "Two parties up at once: the applicant (sign, pay) and Health & Legal (re-verify insurance).",
};
