/**
 * S4 · Maple Street block party. Reviewed by exception, Submitted, no date hold: 9 of 12
 * neighbor sign-offs are in, which is not enough for accept_complete yet.
 */
import type { EventAnswers } from "@/lib/types";
import type { SeedScript } from "../../types";
import { addOns, cityServices, sampleFile, singleSchedule, step, streetsLocation, taskId } from "../helpers";

const CASE_ID = "PMT-27-0126";

const answers: EventAnswers = {
  eventType: "block_party",
  name: "Maple Street block party",
  description: "A block party for the 400 block of Maple Street.",
  location: streetsLocation(["maple-400"], "400 block of Maple Street"),
  schedule: singleSchedule("2027-06-26", "14:00", "20:00"),
  attendance: 120,
  addOns: addOns({ cityServices: cityServices({ barricades: 4 }) }),
};

export const S4: SeedScript = {
  id: CASE_ID,
  key: "S4",
  applicantId: "maple-street-block-captain",
  createdAt: "2027-04-02T09:00",
  answers,
  steps: [
    step("2027-04-02T09:00", "applicant", { type: "create_board" }),
    step("2027-04-02T09:05", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE_ID, "insurance_certificate"),
      files: [sampleFile("maple-street-block-captain-insurance-certificate.pdf")],
    }),
    step("2027-04-02T09:10", "applicant", {
      type: "complete_task",
      taskId: taskId(CASE_ID, "city_services_request"),
      form: { barricades: 4, trash: false, power: false, policeOfficers: 0, policeHours: 0 },
    }),
    ...Array.from({ length: 9 }, (_, i) =>
      step(`2027-04-${String(4 + i).padStart(2, "0")}T18:00`, "neighbor", { type: "simulate_signoff" }),
    ),
    step("2027-04-13T09:00", "applicant", { type: "submit" }),
  ],
  expect: { tier: "reviewed", state: "submitted" },
  notes: "9 of 12 neighbor sign-offs; accept_complete stays disabled until all 12 are in.",
};
