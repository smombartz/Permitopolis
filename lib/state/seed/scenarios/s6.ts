/**
 * S6 · Main Street Food Truck Festival. Special event, the whole history through permit, paid
 * $9,645 Mar 13. The event (Apr 24) has already happened by the demo date, so the engine opens
 * Closeout on its own (Apr 25) as the clock advances during replay; no log_closeout is scripted.
 *
 * The PRD's board on load is "Coming up: final bill or refund, feedback. Everything else Done",
 * so the history also holds the meetings, the community notice, the vendors' food permits and
 * the work orders. "Carry your permit" is finished by the engine when the event day passes.
 */
import type { EventAnswers } from "@/lib/types";
import type { SeedScript } from "../../types";
import { MAIN_1ST_TO_4TH } from "@/lib/data/streets";
import { addOns, cityServices, sampleFile, singleSchedule, step, streetsLocation, taskId, vendorNames } from "../helpers";

const CASE_ID = "PMT-27-0031";
const VENDORS = vendorNames("Food Truck", 25);

const answers: EventAnswers = {
  eventType: "market_festival",
  name: "Main Street Food Truck Festival",
  description: "A one-day food truck festival with a stage and beer garden on Main Street.",
  location: streetsLocation(MAIN_1ST_TO_4TH, "Main Street, 1st to 4th Avenue"),
  schedule: singleSchedule("2027-04-24", "12:00", "21:00"),
  attendance: 3000,
  addOns: addOns({
    alcohol: true,
    foodVending: { vendors: 25, vendorNames: VENDORS },
    tentsStages: { count: 1 },
    cookingGenerators: true,
    cityServices: cityServices({ barricades: 20, policeOfficers: 11, policeHours: 6, trash: true, power: true }),
  }),
};

/** The work orders issue_permit creates for this plan: a closed street, police, barricades, trash and power. */
const WORK_ORDERS = ["barricades", "police", "closure", "trash", "power"];

const preSubmitDocs: Array<[string, string]> = [
  ["insurance_certificate", "main-street-alliance-insurance-certificate.pdf"],
  ["structure_specs", "main-street-festival-stage-specs.pdf"],
  ["traffic_control_plan", "main-street-festival-traffic-control-plan.pdf"],
  ["security_medical_plan", "main-street-festival-security-medical-plan.pdf"],
  ["emergency_plan", "main-street-festival-emergency-plan.pdf"],
];

const preSubmitForms: Array<[string, Record<string, unknown>]> = [
  ["alcohol_details", { beerGarden: true, servers: 6, liquorLiabilityCarrier: "Permitopolis Mutual" }],
  ["vendor_list", { vendors: VENDORS.map((name) => ({ name, serves: "Varies by truck" })) }],
  ["cooking_generator_safety", { generators: 6, fireExtinguishersPerTruck: 1 }],
  ["city_services_request", { barricades: 20, policeOfficers: 11, policeHours: 6, trash: true, power: true }],
  ["site_plan", { drawnOn: "step 2 map", notes: "Stage at 3rd Avenue; beer garden fenced at 2nd Avenue" }],
  ["accessibility_plan", { accessibleRoute: true, restrooms: 10 }],
  ["cleanup_plan", { crew: 6, sweepStartsAt: "21:30" }],
];

export const S6: SeedScript = {
  id: CASE_ID,
  key: "S6",
  applicantId: "main-street-business-alliance",
  createdAt: "2027-02-01T09:00",
  answers,
  steps: [
    step("2027-02-01T09:00", "applicant", { type: "create_board" }),
    ...preSubmitDocs.map(([catalogId, name], i) =>
      step(`2027-02-01T09:${String(5 + i * 5).padStart(2, "0")}`, "applicant", {
        type: "complete_task",
        taskId: taskId(CASE_ID, catalogId),
        files: [sampleFile(name)],
      }),
    ),
    ...preSubmitForms.map(([catalogId, form], i) =>
      step(`2027-02-01T09:${String(30 + i * 3).padStart(2, "0")}`, "applicant", {
        type: "complete_task",
        taskId: taskId(CASE_ID, catalogId),
        form,
      }),
    ),
    ...VENDORS.map((name, i) =>
      step(`2027-02-01T10:${String(i).padStart(2, "0")}`, "applicant", {
        type: "complete_task",
        taskId: taskId(CASE_ID, "vendor_health_permit", i + 1),
        files: [sampleFile(`${name.toLowerCase().replace(/\s+/g, "-")}-health-permit.pdf`)],
      }),
    ),
    step("2027-02-01T11:00", "applicant", { type: "submit" }),
    step("2027-02-03T09:00", "clerk", { type: "accept_complete" }),
    step("2027-02-03T09:05", "clerk", {
      type: "confirm_routing",
      reviewers: [
        {
          dept: "pws",
          sections: [
            "Structure specs and layout",
            "Cooking and generator safety",
            "City services request",
            "Site plan",
            "Traffic control plan",
            "Security and medical plan",
            "Emergency plan",
            "Cleanup plan",
          ],
          dueDate: "2027-03-17",
        },
        {
          dept: "hl",
          sections: ["Certificate of insurance", "Vendor list", "Vendor health permits", "Accessibility plan"],
          dueDate: "2027-03-17",
        },
        { dept: "clerk", sections: ["Alcohol details and liquor liability insurance"], dueDate: "2027-03-17" },
      ],
    }),
    step("2027-02-08T10:00", "clerk", {
      type: "schedule_meeting",
      taskId: taskId(CASE_ID, "pre_application_meeting"),
      date: "2027-02-08",
    }),
    step("2027-02-08T10:05", "clerk", { type: "complete_city_task", taskId: taskId(CASE_ID, "pre_application_meeting") }),
    step("2027-02-12T09:00", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE_ID, "community_notification"),
      files: [sampleFile("main-street-festival-posted-notice.jpg", { type: "image/jpeg", size: 1_040_000 })],
    }),
    step("2027-02-15T09:00", "clerk", { type: "verify_document", taskId: taskId(CASE_ID, "community_notification") }),
    step("2027-03-10T09:00", "pws", { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }),
    step("2027-03-10T09:05", "hl", { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }),
    step("2027-03-10T09:10", "clerk", { type: "review_decide", decision: "approve", conditions: [], feeLines: [] }),
    step("2027-03-12T09:00", "clerk", { type: "send_quote", conditions: [], feeLines: [] }),
    step("2027-03-13T09:00", "applicant", { type: "accept_and_sign", signature: "Harold Petrov" }),
    step("2027-03-13T09:05", "applicant", { type: "pay", amount: 9645, method: "card", kind: "quote" }),
    step("2027-03-13T09:10", "clerk", { type: "issue_permit" }),
    step("2027-03-15T09:00", "clerk", {
      type: "schedule_meeting",
      taskId: taskId(CASE_ID, "coordination_meeting"),
      date: "2027-04-02",
    }),
    step("2027-03-15T09:05", "pws", {
      type: "schedule_meeting",
      taskId: taskId(CASE_ID, "site_walkthrough"),
      date: "2027-04-16",
    }),
    step("2027-04-02T11:00", "clerk", { type: "complete_city_task", taskId: taskId(CASE_ID, "coordination_meeting") }),
    step("2027-04-16T10:00", "pws", { type: "complete_city_task", taskId: taskId(CASE_ID, "site_walkthrough") }),
    step("2027-04-16T14:00", "applicant", { type: "complete_task", taskId: taskId(CASE_ID, "vendor_food_permits") }),
    ...WORK_ORDERS.map((key, i) =>
      step(`2027-04-23T${String(9 + i).padStart(2, "0")}:00`, "pws", {
        type: "complete_city_task",
        taskId: taskId(CASE_ID, `work_order:${key}`),
      }),
    ),
  ],
  expect: { tier: "special", state: "closeout" },
  notes: "Closeout opens automatically when replay's clock passes Apr 24; no log_closeout yet.",
};
