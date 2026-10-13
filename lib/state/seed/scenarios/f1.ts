/**
 * F1 · Downtown Art Walk. Special, Submitted and complete: gives the Clerk its first intake
 * work (accept, route, schedule the pre-application consultation). Submitted Fri, Apr 30, so its
 * three-day intake check is due today, Mon, May 3: on the Clerk's desk, not overdue.
 */
import type { EventAnswers } from "@/lib/types";
import type { SeedScript } from "../../types";
import { addOns, sampleFile, singleSchedule, step, streetsLocation, taskId } from "../helpers";

const CASE_ID = "PMT-27-0121";
// Reuses the three Main Street segments between 1st and 4th for "2nd to 5th" is a different
// stretch; build it explicitly from the next three blocks instead.
const SEGMENTS = ["main-2-3", "main-3-4", "main-4-5"];

const answers: EventAnswers = {
  eventType: "market_festival",
  name: "Downtown Art Walk",
  description: "A juried outdoor art walk along Main Street.",
  location: streetsLocation(SEGMENTS, "Main Street, 2nd to 5th Avenue"),
  schedule: singleSchedule("2027-07-23", "11:00", "19:00", { setupStart: "09:00", teardownEnd: "20:00" }),
  attendance: 400,
  addOns: addOns({}),
};

const docs: Array<[string, string]> = [
  ["insurance_certificate", "downtown-art-walk-insurance-certificate.pdf"],
  ["traffic_control_plan", "downtown-art-walk-traffic-control-plan.pdf"],
  ["security_medical_plan", "downtown-art-walk-security-medical-plan.pdf"],
  ["emergency_plan", "downtown-art-walk-emergency-plan.pdf"],
];

export const F1: SeedScript = {
  id: CASE_ID,
  key: "F1",
  applicantId: "downtown-art-walk-committee",
  createdAt: "2027-04-30T09:00",
  answers,
  steps: [
    step("2027-04-30T09:00", "applicant", { type: "create_board" }),
    ...docs.map(([catalogId, name], i) =>
      step(`2027-04-30T09:${String(5 + i * 5).padStart(2, "0")}`, "applicant", {
        type: "complete_task",
        taskId: taskId(CASE_ID, catalogId),
        files: [sampleFile(name)],
      }),
    ),
    step("2027-04-30T09:30", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE_ID, "site_plan"),
      form: { drawnOn: "step 2 map", notes: "Booths along both sidewalks, center lane kept clear" },
    }),
    step("2027-04-30T09:35", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE_ID, "accessibility_plan"),
      form: { accessibleRoute: true, restrooms: 2 },
    }),
    step("2027-04-30T09:40", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE_ID, "cleanup_plan"),
      form: { crew: 2, sweepStartsAt: "20:00" },
    }),
    step("2027-04-30T10:00", "applicant", { type: "submit" }),
  ],
  expect: { tier: "special", state: "submitted" },
  notes: "Thin Clerk queue filler: accept, route, schedule the pre-application meeting.",
};
