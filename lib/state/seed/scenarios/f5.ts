/**
 * F5 · Plaza wedding photos. Reviewed, Submitted: the only pre-submit card a plain Reviewed
 * event needs is the insurance certificate, and here it is a clearly wrong file, never
 * accepted by anyone. It competes with S3 for City Hall Plaza on Jun 18, which was complete
 * first (plan 3.3). Submitted Sat, May 1, so its intake check is due Tue, May 4.
 */
import type { EventAnswers } from "@/lib/types";
import type { SeedScript } from "../../types";
import { addOns, areaLocation, badFile, singleSchedule, step, taskId } from "../helpers";

const CASE_ID = "PMT-27-0115";

const answers: EventAnswers = {
  eventType: "picnic_party",
  name: "Plaza wedding photos",
  description: "A short wedding photo session on City Hall Plaza.",
  location: areaLocation("city-hall-plaza", { x: 10, y: 60, w: 20, h: 15 }, 300),
  schedule: singleSchedule("2027-06-18", "17:00", "19:00"),
  attendance: 20,
  addOns: addOns({}),
};

export const F5: SeedScript = {
  id: CASE_ID,
  key: "F5",
  applicantId: "priya-jordan-wedding",
  createdAt: "2027-05-01T09:00",
  answers,
  steps: [
    step("2027-05-01T09:00", "applicant", { type: "create_board" }),
    step("2027-05-01T09:05", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE_ID, "insurance_certificate"),
      files: [badFile("wedding-photographer-contract.jpg")],
    }),
    step("2027-05-01T09:10", "applicant", { type: "submit" }),
  ],
  expect: { tier: "reviewed", state: "submitted" },
  notes: "Competes with S3 for the Plaza on Jun 18; S3 was complete first, so this never gets accepted.",
};
